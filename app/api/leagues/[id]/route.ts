// Standings for one mini-league: today's board filtered to members + the
// all-time days-won tally. Members only.
//
// Required env: DATABASE_URL + Supabase
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "../../../lib/rate-limit";
import { getUserId } from "../../../lib/supabase-server";
import { getDb } from "../../../lib/db";
import { isMember, leagueStandings } from "../../../lib/leagues-store";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rl = await rateLimit(req, "league-standings", 60, "1 m");
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

  const { id } = await params;
  const mode = req.nextUrl.searchParams.get("mode") === "hard" ? "hard" : "classic";
  const num = Number(req.nextUrl.searchParams.get("num"));
  if (!Number.isInteger(num) || num < 1) {
    return NextResponse.json({ ok: false, reason: "bad_input" }, { status: 400 });
  }

  try {
    if (!(await isMember(sql, userId, id))) {
      return NextResponse.json({ ok: false, reason: "forbidden" }, { status: 403 });
    }
    const data = await leagueStandings(sql, id, mode, num, userId);
    return NextResponse.json({ ok: true, ...data });
  } catch (e) {
    console.error("league standings failed:", e);
    return NextResponse.json({ ok: false, reason: "upstream" }, { status: 502 });
  }
}
