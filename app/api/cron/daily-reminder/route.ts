// Daily reminder fan-out. Triggered by Vercel Cron at 09:00 UTC. Reads
// every subscriber from the KV set for each locale and fires a
// `daily_reminder_<locale>` event into Loops for each address. A Loop
// in the Loops dashboard reacts to that event with the localised email
// body — keeps copy editable without redeploying.
//
// Loops setup the dashboard side needs when adding a new locale:
//   1. Create a Loop triggered by event `daily_reminder_<locale>`
//      (e.g. `daily_reminder_en`, `daily_reminder_es`).
//   2. Optionally filter on contact.language === <locale> as belt-and-
//      braces in case the same address subscribes from both routes.
//
// Migration note: the original implementation fired `daily_reminder`
// (no suffix). After the i18n rollout, English subscribers receive
// `daily_reminder_en` instead — the old Loops trigger will stop firing
// until you point it at the new event name.
//
// Auth: Vercel Cron sends an `Authorization: Bearer ${CRON_SECRET}`
// header automatically when CRON_SECRET is set in env. We verify it
// before doing anything; without that check the route would be a free
// "spam everyone" button on the public internet.
//
// Required env:
//   CRON_SECRET           — random string, set in Vercel Project Settings
//   LOOPS_API_KEY         — same key used by /api/subscribe
//   KV_REST_API_URL       — provided by the Vercel storage integration
//   KV_REST_API_TOKEN     — same
//
// Verbosity: returns a JSON summary of attempts, fails, and skipped so
// you can curl the route manually and see what happened. Cron logs in
// Vercel show the body, so debugging without redeploys is possible.

import { NextRequest, NextResponse } from "next/server";
import { listSubscribers, isConfigured as kvConfigured } from "../../../lib/subscribers";
import { LOCALES, type Locale } from "../../../lib/i18n";

const LOOPS_EVENT_ENDPOINT = "https://app.loops.so/api/v1/events/send";

// One Loops event per locale so each language gets its own template in
// the Loops dashboard — no conditional template logic, just two Loops.
function eventNameFor(locale: Locale): string {
  return `daily_reminder_${locale}`;
}

// Per-request timeout when calling Loops. Long enough for a slow leg,
// short enough not to wedge the cron when Loops degrades.
const LOOPS_TIMEOUT_MS = 8000;

// Fan-out concurrency. Loops doesn't publish a hard rate limit, but
// hammering them with hundreds of parallel events from a serverless
// function is rude and likely to hit a soft limit. Eight at a time is
// a comfortable middle ground for early-stage volumes.
const CONCURRENCY = 8;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, reason: "cron_secret_missing" },
      { status: 503 }
    );
  }
  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. Allow
  // ?key=<secret> as a manual-trigger fallback for testing — same
  // auth strength, easier to curl.
  const auth = req.headers.get("authorization");
  const queryKey = req.nextUrl.searchParams.get("key");
  if (auth !== `Bearer ${secret}` && queryKey !== secret) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.LOOPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, reason: "loops_not_configured" },
      { status: 503 }
    );
  }
  if (!kvConfigured()) {
    return NextResponse.json(
      { ok: false, reason: "kv_not_configured" },
      { status: 503 }
    );
  }

  // Fan out per locale. Each locale's subscriber set is fetched and
  // dispatched against its own event name. Per-locale stats are returned
  // so the cron logs show coverage at a glance.
  const perLocale: Record<string, { attempted: number; succeeded: number; failed: number }> = {};
  const failures: { email: string; locale: Locale; status: number; reason: string }[] = [];
  let totalAttempted = 0;
  let totalSucceeded = 0;

  for (const locale of LOCALES) {
    const emails = await listSubscribers(locale);
    perLocale[locale] = { attempted: emails.length, succeeded: 0, failed: 0 };
    if (emails.length === 0) continue;
    totalAttempted += emails.length;

    const queue = [...emails];
    const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      while (queue.length) {
        const email = queue.shift();
        if (!email) break;
        const result = await sendEvent(email, apiKey, eventNameFor(locale));
        if (result.ok) {
          perLocale[locale].succeeded++;
          totalSucceeded++;
        } else {
          perLocale[locale].failed++;
          failures.push({
            email: maskEmail(email),
            locale,
            status: result.status,
            reason: result.reason,
          });
        }
      }
    });
    await Promise.all(workers);
  }

  return NextResponse.json({
    ok: true,
    attempted: totalAttempted,
    succeeded: totalSucceeded,
    failed: failures.length,
    perLocale,
    // Cap the failure detail in the response so a bad day doesn't
    // produce a 50KB JSON blob in the cron logs.
    failures: failures.slice(0, 20),
  });
}

async function sendEvent(
  email: string,
  apiKey: string,
  eventName: string
): Promise<{ ok: true } | { ok: false; status: number; reason: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), LOOPS_TIMEOUT_MS);
  try {
    const res = await fetch(LOOPS_EVENT_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ email, eventName }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, status: res.status, reason: detail.slice(0, 200) || res.statusText };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      reason: e instanceof Error ? e.message : String(e),
    };
  } finally {
    clearTimeout(t);
  }
}

// Lightly redact the local-part so the cron log doesn't dump full
// addresses for every failure. Keeps debugging useful without leaking
// the list to anyone with log access.
function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 1) return "***" + email.slice(at);
  return email.slice(0, 1) + "***" + email.slice(at);
}
