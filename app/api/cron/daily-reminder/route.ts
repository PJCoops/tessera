// Daily reminder fan-out. Triggered by Vercel Cron at 09:00 UTC. Reads
// every subscriber from the KV set for each locale and fires a Loops
// event for each address. A Loop in the Loops dashboard reacts to that
// event with the localised email body — keeps copy editable without
// redeploying.
//
// Event naming:
//   en → "daily_reminder"      (legacy name; matches the live Loop)
//   es → "daily_reminder_es"
//   any new locale → "daily_reminder_<code>"
//
// English keeps the un-suffixed name so we don't break the existing
// dashboard wiring. New locales get a `_<code>` suffix and their own
// Loop in the dashboard.
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
import webpush from "web-push";
import { listSubscribers, isConfigured as kvConfigured } from "../../../lib/subscribers";
import {
  listPushSubscribers,
  removePushSubscriberFromAll,
  type StoredPushSubscription,
} from "../../../lib/push-subscribers";
import { LOCALES, getDictionary, t, type Locale } from "../../../lib/i18n";
import { puzzleNumber, todayUtc } from "../../../lib/rng";
import { EPOCH } from "../../../lib/epoch";

const LOOPS_EVENT_ENDPOINT = "https://app.loops.so/api/v1/events/send";

// One Loops event per locale so each language gets its own template in
// the Loops dashboard — no conditional template logic, just one Loop
// per language. English keeps the un-suffixed name from the original
// single-locale flow so we don't break the live trigger.
function eventNameFor(locale: Locale): string {
  return locale === "en" ? "daily_reminder" : `daily_reminder_${locale}`;
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
  const perLocale: Record<
    string,
    {
      email: { attempted: number; succeeded: number; failed: number };
      push: { attempted: number; succeeded: number; failed: number; expired: number };
    }
  > = {};
  const failures: { email: string; locale: Locale; status: number; reason: string }[] = [];
  let totalAttempted = 0;
  let totalSucceeded = 0;

  // Configure web-push once. If VAPID env is missing we'll skip push fan-out
  // but still send email — a missing PWA setup shouldn't break email reminders.
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || "mailto:hello@tesserapuzzle.com";
  const pushConfigured = Boolean(vapidPublic && vapidPrivate);
  if (pushConfigured) {
    webpush.setVapidDetails(vapidSubject, vapidPublic!, vapidPrivate!);
  }

  // Today's puzzle number — same arithmetic the client uses, so the
  // notification body matches what the user sees when they tap through.
  const todayNum = puzzleNumber(todayUtc(), EPOCH);

  for (const locale of LOCALES) {
    perLocale[locale] = {
      email: { attempted: 0, succeeded: 0, failed: 0 },
      push: { attempted: 0, succeeded: 0, failed: 0, expired: 0 },
    };

    // ---- Email fan-out (existing behaviour, untouched) ----
    const emails = await listSubscribers(locale);
    perLocale[locale].email.attempted = emails.length;
    if (emails.length > 0) {
      totalAttempted += emails.length;
      const queue = [...emails];
      const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
        while (queue.length) {
          const email = queue.shift();
          if (!email) break;
          const result = await sendEvent(email, apiKey, eventNameFor(locale));
          if (result.ok) {
            perLocale[locale].email.succeeded++;
            totalSucceeded++;
          } else {
            perLocale[locale].email.failed++;
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

    // ---- Push fan-out ----
    if (pushConfigured) {
      const subs = await listPushSubscribers(locale);
      perLocale[locale].push.attempted = subs.length;
      if (subs.length > 0) {
        const dict = getDictionary(locale);
        const localePath = locale === "en" ? "/" : `/${locale}`;
        const payload = JSON.stringify({
          title: t(dict, "push.dailyTitle"),
          body: t(dict, "push.dailyBody", { num: todayNum }),
          url: localePath,
          tag: "tessera-daily",
        });

        const queue = [...subs];
        const workers = Array.from(
          { length: Math.min(CONCURRENCY, queue.length) },
          async () => {
            while (queue.length) {
              const sub = queue.shift();
              if (!sub) break;
              const r = await sendPush(sub, payload);
              if (r.ok) {
                perLocale[locale].push.succeeded++;
              } else if (r.expired) {
                perLocale[locale].push.expired++;
                // Best-effort cleanup of the dead endpoint so we don't
                // keep retrying it tomorrow. Failure here is non-fatal.
                removePushSubscriberFromAll(sub.endpoint, LOCALES).catch(() => {});
              } else {
                perLocale[locale].push.failed++;
              }
            }
          }
        );
        await Promise.all(workers);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    attempted: totalAttempted,
    succeeded: totalSucceeded,
    failed: failures.length,
    pushConfigured,
    todayNum,
    perLocale,
    // Cap the failure detail in the response so a bad day doesn't
    // produce a 50KB JSON blob in the cron logs.
    failures: failures.slice(0, 20),
  });
}

// Send one push. Web-push throws an Error with a `statusCode` field on
// HTTP failures; 404/410 = the subscription is permanently gone (user
// revoked permission, uninstalled the PWA, browser garbage-collected
// the endpoint) and we should drop it from storage.
async function sendPush(
  sub: StoredPushSubscription,
  payload: string
): Promise<{ ok: true } | { ok: false; expired: boolean; status: number; reason: string }> {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: sub.keys },
      payload,
      { TTL: 60 * 60 * 12 } // 12h: don't try to deliver tomorrow's reminder
    );
    return { ok: true };
  } catch (e: unknown) {
    const err = e as { statusCode?: number; body?: string; message?: string };
    const status = err.statusCode ?? 0;
    const expired = status === 404 || status === 410;
    return {
      ok: false,
      expired,
      status,
      reason: (err.body || err.message || "unknown").slice(0, 200),
    };
  }
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
