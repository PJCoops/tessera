// POST   /api/v1/device-tokens — register/refresh this device's FCM/APNs
//        push token, so the server can schedule reminders and league
//        results for it (spec §10).
// DELETE /api/v1/device-tokens — deregister one token, called on sign-out
//        so a device no longer attached to the account stops getting
//        pushed to (account deletion sweeps every token separately).
//
// Bearer-auth only — a push token is meaningless without an account to
// send to.
//
// Required env: DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "../../../lib/rate-limit";
import { getUserId } from "../../../lib/supabase-server";
import { getDb } from "../../../lib/db";
import { deregisterDeviceToken, isDevicePlatform, registerDeviceToken } from "../../../lib/device-tokens-store";

const limited = (retryAfter: number) =>
  NextResponse.json(
    { ok: false, reason: "rate_limited" },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );

const MAX_TZ_OFFSET_MINUTES = 14 * 60; // UTC+14 is the farthest real offset

export async function POST(req: NextRequest) {
  const ip = await rateLimit(req, "v1-device-tokens-post", 20, "1 m");
  if (!ip.ok) return limited(ip.retryAfter);

  const sql = getDb();
  if (!sql) return NextResponse.json({ ok: false, reason: "not_configured" }, { status: 503 });

  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });

  const user = await rateLimit(req, "v1-device-tokens-post-user", 10, "1 m", userId);
  if (!user.ok) return limited(user.retryAfter);

  let body: { platform?: unknown; token?: unknown; tzOffset?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, reason: "bad_json" }, { status: 400 });
  }
  if (
    !isDevicePlatform(body.platform) ||
    typeof body.token !== "string" ||
    body.token.length === 0 ||
    body.token.length > 4096 ||
    typeof body.tzOffset !== "number" ||
    !Number.isInteger(body.tzOffset) ||
    Math.abs(body.tzOffset) > MAX_TZ_OFFSET_MINUTES
  ) {
    return NextResponse.json({ ok: false, reason: "bad_input" }, { status: 400 });
  }

  try {
    await registerDeviceToken(sql, userId, body.platform, body.token, body.tzOffset);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("v1 device-tokens POST failed:", e);
    return NextResponse.json({ ok: false, reason: "upstream" }, { status: 502 });
  }
}

export async function DELETE(req: NextRequest) {
  const ip = await rateLimit(req, "v1-device-tokens-delete", 20, "1 m");
  if (!ip.ok) return limited(ip.retryAfter);

  const sql = getDb();
  if (!sql) return NextResponse.json({ ok: false, reason: "not_configured" }, { status: 503 });

  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });

  let body: { token?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, reason: "bad_json" }, { status: 400 });
  }
  if (typeof body.token !== "string" || body.token.length === 0) {
    return NextResponse.json({ ok: false, reason: "bad_input" }, { status: 400 });
  }

  try {
    await deregisterDeviceToken(sql, userId, body.token);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("v1 device-tokens DELETE failed:", e);
    return NextResponse.json({ ok: false, reason: "upstream" }, { status: 502 });
  }
}
