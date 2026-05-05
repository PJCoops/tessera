// Web Push subscription endpoint. The client calls this after the
// browser permission prompt is accepted and a `PushSubscription` is
// returned by the service worker. We persist it in Upstash so the
// daily-reminder cron can fan out push notifications alongside email.
//
// Storage shape: see `app/lib/push-subscribers.ts`.
//
// We deliberately don't tie subscriptions to a user identity — there
// is no auth on the puzzle. The endpoint URL itself is the identity;
// a single browser produces a unique endpoint per origin per device.

import { NextRequest, NextResponse } from "next/server";
import {
  addPushSubscriber,
  isConfigured as kvConfigured,
  type StoredPushSubscription,
} from "../../../lib/push-subscribers";
import { DEFAULT_LOCALE, isLocale, type Locale } from "../../../lib/i18n";

type Body = {
  subscription?: {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  locale?: string;
};

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

  const sub = body.subscription;
  if (
    !sub ||
    typeof sub.endpoint !== "string" ||
    !sub.endpoint.startsWith("https://") ||
    !sub.keys ||
    typeof sub.keys.p256dh !== "string" ||
    typeof sub.keys.auth !== "string"
  ) {
    return NextResponse.json({ ok: false, reason: "bad_subscription" }, { status: 400 });
  }

  const locale: Locale = isLocale(body.locale) ? body.locale : DEFAULT_LOCALE;
  const stored: StoredPushSubscription = {
    endpoint: sub.endpoint,
    keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
  };

  try {
    await addPushSubscriber(stored, locale);
  } catch (e) {
    console.error("KV addPushSubscriber failed:", e);
    return NextResponse.json({ ok: false, reason: "kv_write_failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
