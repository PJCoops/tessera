// POST /api/v1/leagues/join — join a mini-league by invite code.
//
// Same as /api/leagues/join, plus a per-user rate limit alongside the IP
// limit so a proxy pool can't parallelise code-guessing (§12.2). The
// join itself opens a confirmation screen client-side, not a silent
// auto-join. Wrong code and no-such-league return the same 404.
//
// Required env: DATABASE_URL, Supabase
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "../../../../lib/db";
import { joinByCode } from "../../../../lib/leagues-store";
import { rateLimit } from "../../../../lib/rate-limit";
import { getUserId } from "../../../../lib/supabase-server";

const limited = (retryAfter: number) =>
  NextResponse.json(
    { ok: false, reason: "rate_limited" },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );

export async function POST(req: NextRequest) {
  const ip = await rateLimit(req, "v1-leagues-join", 15, "1 m");
  if (!ip.ok) return limited(ip.retryAfter);

  const sql = getDb();
  if (!sql) return NextResponse.json({ ok: false, reason: "not_configured" }, { status: 503 });

  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });

  const user = await rateLimit(req, "v1-leagues-join-user", 8, "1 m", userId);
  if (!user.ok) return limited(user.retryAfter);

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
    console.error("v1 leagues join failed:", e);
    return NextResponse.json({ ok: false, reason: "upstream" }, { status: 502 });
  }
}
