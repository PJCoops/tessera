// POST /api/v1/billing/revenuecat — RevenueCat webhook.
//
// The webhook is a *signal only* (docs/flutter-app-spec.md §8.2). We
// verify the shared secret, then ignore the payload's claims and call
// RevenueCat's REST API to read the subscriber's real entitlements,
// writing that to profiles.ads_removed and logging the flip. Replayed
// events are idempotent on the RevenueCat event id.
//
// Required env: REVENUECAT_WEBHOOK_SECRET (Authorization header value set
//   in the RevenueCat dashboard), REVENUECAT_API_KEY (secret REST key),
//   DATABASE_URL

import { NextResponse, type NextRequest } from "next/server";
import { applyRevenueCatEvent } from "../../../../lib/billing";
import { getDb } from "../../../../lib/db";

export async function POST(req: NextRequest) {
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, reason: "not_configured" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== secret) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  if (!sql) {
    return NextResponse.json({ ok: false, reason: "not_configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad_json" }, { status: 400 });
  }

  const event = (body as { event?: Record<string, unknown> })?.event;
  const eventId = typeof event?.id === "string" ? event.id : null;
  const eventType = typeof event?.type === "string" ? event.type : "UNKNOWN";
  const appUserId = typeof event?.app_user_id === "string" ? event.app_user_id : null;

  if (!eventId || !appUserId) {
    return NextResponse.json({ ok: false, reason: "bad_input" }, { status: 400 });
  }
  // RevenueCat anonymous ids (no Purchases.logIn yet) can't map to an
  // account — accept and ignore so RevenueCat doesn't keep retrying.
  if (appUserId.startsWith("$RCAnonymousID:")) {
    return NextResponse.json({ ok: true, ignored: "anonymous" });
  }

  try {
    const { adsRemoved, duplicate } = await applyRevenueCatEvent(sql, {
      eventId,
      eventType,
      appUserId,
      raw: body,
    });
    return NextResponse.json({ ok: true, adsRemoved, duplicate });
  } catch (e) {
    console.error("revenuecat webhook failed:", e);
    return NextResponse.json({ ok: false, reason: "upstream" }, { status: 502 });
  }
}
