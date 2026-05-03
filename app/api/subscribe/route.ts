// Email signup endpoint. Forwards the address to Loops (loops.so) so the
// daily-reminder template can pick it up; the list lives there, not in
// our own database. Failures are surfaced to the client as a generic
// "try again later" so we never leak which provider is upstream.
//
// Required env:
//   LOOPS_API_KEY            — server-side bearer token from Loops dashboard
// Optional:
//   LOOPS_DAILY_AUDIENCE_ID  — if set, the contact is added to that audience
//
import { NextRequest, NextResponse } from "next/server";
import { addSubscriber } from "../../lib/subscribers";
import { DEFAULT_LOCALE, isLocale, type Locale } from "../../lib/i18n";

const LOOPS_ENDPOINT = "https://app.loops.so/api/v1/contacts/create";
// Loops also exposes /update which upserts. Use it so a returning visitor
// who re-submits doesn't see a hard error from a duplicate-email check.
const LOOPS_UPSERT_ENDPOINT = "https://app.loops.so/api/v1/contacts/update";

// Conservative validation: RFC 5322 is overkill for a signup form, and a
// strict regex rejects more legit addresses than it catches typos. We
// just check there's an "@" with non-empty halves and no whitespace.
function isPlausibleEmail(value: string): boolean {
  if (value.length > 254) return false;
  if (/\s/.test(value)) return false;
  const at = value.indexOf("@");
  if (at < 1 || at === value.length - 1) return false;
  if (!value.slice(at + 1).includes(".")) return false;
  return true;
}

type Body = { email?: string; source?: string; locale?: string };

export async function POST(req: NextRequest) {
  const apiKey = process.env.LOOPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, reason: "not_configured" },
      { status: 503 }
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, reason: "bad_json" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const source = (body.source ?? "unknown").slice(0, 64);
  const locale: Locale = isLocale(body.locale) ? body.locale : DEFAULT_LOCALE;
  if (!isPlausibleEmail(email)) {
    return NextResponse.json(
      { ok: false, reason: "bad_email" },
      { status: 400 }
    );
  }

  // Loops payload. `source` and `signupSource` give us a way to filter
  // in their dashboard ("solved" vs "history" etc.). `language` is a
  // custom contact property that the Spanish welcome / daily templates
  // filter on so each locale gets the right copy.
  const payload: Record<string, unknown> = {
    email,
    source,
    signupSource: source,
    language: locale,
    subscribed: true,
  };
  const audienceId = process.env.LOOPS_DAILY_AUDIENCE_ID;
  if (audienceId) {
    payload.mailingLists = { [audienceId]: true };
  }

  // Try create first; on duplicate, fall back to update so the user
  // doesn't see a confusing error after re-subscribing.
  let res = await fetch(LOOPS_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });
  if (res.status === 409) {
    res = await fetch(LOOPS_UPSERT_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
  }

  if (!res.ok) {
    // Log upstream body for debugging, but never relay it to the client.
    const detail = await res.text().catch(() => "");
    console.error(`Loops signup failed (${res.status}): ${detail.slice(0, 500)}`);
    return NextResponse.json(
      { ok: false, reason: "upstream" },
      { status: 502 }
    );
  }

  // Mirror to our own subscriber list. The daily-reminder cron iterates
  // this set because Loops has no list-contacts endpoint. KV failures
  // are swallowed so a transient KV blip doesn't kill the signup —
  // Loops still got the address and the welcome email will fire.
  try {
    await addSubscriber(email, locale);
  } catch (e) {
    console.error("KV addSubscriber failed:", e);
  }

  return NextResponse.json({ ok: true });
}
