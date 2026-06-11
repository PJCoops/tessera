// Join a mini-league by its invite code.
//
// Required env: DATABASE_URL + Supabase
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "../../../lib/rate-limit";
import { getUserId } from "../../../lib/supabase-server";
import { getDb } from "../../../lib/db";
import { joinByCode } from "../../../lib/leagues-store";

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, "leagues-join", 10, "1 m");
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, reason: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }
  const sql = getDb();
  if (!sql) return NextResponse.json({ ok: false, reason: "not_configured" }, { status: 503 });
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });

  let body: { code?: unknown };
  try {
    body = (await req.json()) as { code?: unknown };
  } catch {
    return NextResponse.json({ ok: false, reason: "bad_json" }, { status: 400 });
  }
  if (typeof body.code !== "string" || body.code.trim().length === 0) {
    return NextResponse.json({ ok: false, reason: "bad_input" }, { status: 400 });
  }

  try {
    const result = await joinByCode(sql, userId, body.code);
    if (!result.ok) {
      return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, league: result.league });
  } catch (e) {
    console.error("leagues join failed:", e);
    return NextResponse.json({ ok: false, reason: "upstream" }, { status: 502 });
  }
}
