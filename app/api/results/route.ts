// Returns all of the signed-in user's results plus streaks computed from
// them (revealed rows are not wins; imported maxima from pre-account
// history are folded in). The client merges these into localStorage.
//
// Required env: DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "../../lib/rate-limit";
import { getUserId } from "../../lib/supabase-server";
import { getDb } from "../../lib/db";
import { importedMaxes, listResults } from "../../lib/results-store";
import { computeStreak } from "../../lib/streak-compute";

export async function GET(req: NextRequest) {
  const rl = await rateLimit(req, "results-get", 30, "1 m");
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, reason: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const sql = getDb();
  if (!sql) {
    return NextResponse.json({ ok: false, reason: "not_configured" }, { status: 503 });
  }

  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  try {
    const results = await listResults(sql, userId);
    const maxes = await importedMaxes(sql, userId);
    const winsFor = (mode: "classic" | "hard") =>
      results.filter((r) => r.mode === mode && !r.revealed).map((r) => r.puzzleNumber);
    return NextResponse.json({
      ok: true,
      results: results.map((r) => ({
        num: r.puzzleNumber,
        mode: r.mode,
        moves: r.moves,
        bonus: r.bonus,
        revealed: r.revealed,
        verified: r.verified,
        timeMs: r.timeMs,
        completedAt: r.completedAtMs,
      })),
      streaks: {
        classic: computeStreak(winsFor("classic"), maxes.classic),
        hard: computeStreak(winsFor("hard"), maxes.hard),
      },
    });
  } catch (e) {
    console.error("results/get failed:", e);
    return NextResponse.json({ ok: false, reason: "upstream" }, { status: 502 });
  }
}
