// Daily per-puzzle leaderboard: global + the viewer's country board for a
// (mode, puzzle_number). Public, no sign-in required to view; a signed-in
// viewer with a handle also gets their own rank and isMe flags.
//
// Required env: DATABASE_URL (+ Supabase for the optional viewer identity)
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "../../lib/rate-limit";
import { getUserId } from "../../lib/supabase-server";
import { getDb } from "../../lib/db";
import { getLeaderboard } from "../../lib/leaderboard-store";

export async function GET(req: NextRequest) {
  const rl = await rateLimit(req, "leaderboard-get", 60, "1 m");
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, reason: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }
  const sql = getDb();
  if (!sql) return NextResponse.json({ ok: false, reason: "not_configured" }, { status: 503 });

  // No 401: the board is public. userId is null for signed-out viewers.
  const userId = await getUserId();

  const params = req.nextUrl.searchParams;
  const mode = params.get("mode") === "hard" ? "hard" : "classic";
  const num = Number(params.get("num"));
  if (!Number.isInteger(num) || num < 1) {
    return NextResponse.json({ ok: false, reason: "bad_input" }, { status: 400 });
  }
  const country = req.headers.get("x-vercel-ip-country") ?? "ZZ";

  try {
    const data = await getLeaderboard(sql, { mode, num, country, userId });
    return NextResponse.json({
      ok: true,
      global: data.global,
      country: { code: country === "ZZ" ? null : country, entries: data.country },
      me: data.me,
      hasHandle: data.hasHandle,
      signedIn: userId !== null,
    });
  } catch (e) {
    console.error("leaderboard GET failed:", e);
    return NextResponse.json({ ok: false, reason: "upstream" }, { status: 502 });
  }
}
