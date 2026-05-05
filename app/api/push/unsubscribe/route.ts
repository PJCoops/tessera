// Web Push unsubscribe endpoint. The client calls this after
// `PushSubscription.unsubscribe()` succeeds in the browser, so the
// server-side hash stays in sync with what the browser actually has.
// If the user changes their mind in Settings we don't want to keep
// pushing to a dead endpoint.

import { NextRequest, NextResponse } from "next/server";
import {
  removePushSubscriber,
  isConfigured as kvConfigured,
} from "../../../lib/push-subscribers";
import { DEFAULT_LOCALE, isLocale, LOCALES, type Locale } from "../../../lib/i18n";

type Body = { endpoint?: string; locale?: string };

export async function POST(req: NextRequest) {
  if (!kvConfigured()) {
    return NextResponse.json({ ok: false, reason: "kv_not_configured" }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, reason: "bad_json" }, { status: 400 });
  }

  const endpoint = (body.endpoint ?? "").trim();
  if (!endpoint || !endpoint.startsWith("https://")) {
    return NextResponse.json({ ok: false, reason: "bad_endpoint" }, { status: 400 });
  }

  // Best-effort: remove from the locale they tell us, and also from any
  // other locale's hash in case they've switched language since
  // subscribing. Removal of a non-existent key is a no-op in Redis, so
  // this is safe and slightly cheaper than tracking the original locale.
  const locale: Locale = isLocale(body.locale) ? body.locale : DEFAULT_LOCALE;
  try {
    await Promise.all(
      [locale, ...LOCALES.filter((l) => l !== locale)].map((l) =>
        removePushSubscriber(endpoint, l)
      )
    );
  } catch (e) {
    console.error("KV removePushSubscriber failed:", e);
    return NextResponse.json({ ok: false, reason: "kv_write_failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
