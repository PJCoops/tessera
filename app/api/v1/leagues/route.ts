// Mini-leagues the signed-in user belongs to (GET) and creating a new one
// (POST). Bearer-auth mirror of /api/leagues for the mobile client.
// Standings live at /api/v1/leagues/[id]; joining at /api/v1/leagues/join.
//
// Required env: DATABASE_URL + Supabase
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "../../../lib/rate-limit";
import { getUserId } from "../../../lib/supabase-server";
import { getDb } from "../../../lib/db";
import { createLeague, listMyLeagues } from "../../../lib/leagues-store";

export async function GET(req: NextRequest) {
  const rl = await rateLimit(req, "v1-leagues-get", 30, "1 m");
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, reason: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }
  const sql = getDb();
  if (!sql) return NextResponse.json({ ok: false, reason: "not_configured" }, { status: 503 });
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });

  try {
    const leagues = await listMyLeagues(sql, userId);
    return NextResponse.json({ ok: true, leagues });
  } catch (e) {
    console.error("v1 leagues GET failed:", e);
    return NextResponse.json({ ok: false, reason: "upstream" }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, "v1-leagues-create", 5, "1 m");
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, reason: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }
  const sql = getDb();
  if (!sql) return NextResponse.json({ ok: false, reason: "not_configured" }, { status: 503 });
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });

  const user = await rateLimit(req, "v1-leagues-create-user", 5, "1 m", userId);
  if (!user.ok) {
    return NextResponse.json(
      { ok: false, reason: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(user.retryAfter) } },
    );
  }

  let body: { name?: unknown };
  try {
    body = (await req.json()) as { name?: unknown };
  } catch {
    return NextResponse.json({ ok: false, reason: "bad_json" }, { status: 400 });
  }
  if (typeof body.name !== "string") {
    return NextResponse.json({ ok: false, reason: "bad_input" }, { status: 400 });
  }

  try {
    const result = await createLeague(sql, userId, body.name);
    if ("error" in result) {
      return NextResponse.json({ ok: false, reason: "bad_input" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, league: result });
  } catch (e) {
    console.error("v1 leagues POST failed:", e);
    return NextResponse.json({ ok: false, reason: "upstream" }, { status: 502 });
  }
}
