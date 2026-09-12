// POST /api/v1/leaderboard/report {mode, num, handle} — flag another
// player's board row as implausible (§12.3). A lightweight signal, not a
// moderation pipeline: writes into score_reports and returns {ok:true}
// whether the report is new or a repeat (the unique constraint no-ops a
// repeat). Bearer-auth only, mobile-only for now (no web route needed —
// the web leaderboard doesn't surface this action).
//
// Required env: DATABASE_URL + Supabase
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "../../../../lib/rate-limit";
import { getUserId } from "../../../../lib/supabase-server";
import { getDb } from "../../../../lib/db";
import { reportScore } from "../../../../lib/leaderboard-store";

const limited = (retryAfter: number) =>
  NextResponse.json(
    { ok: false, reason: "rate_limited" },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );

export async function POST(req: NextRequest) {
  const ip = await rateLimit(req, "v1-leaderboard-report", 30, "1 m");
  if (!ip.ok) return limited(ip.retryAfter);

  const sql = getDb();
  if (!sql) return NextResponse.json({ ok: false, reason: "not_configured" }, { status: 503 });

  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });

  // Per-user daily cap — a flag is cheap to spam but should stay a signal,
  // not a tool for harassing one player's board presence.
  const user = await rateLimit(req, "v1-leaderboard-report-user", 20, "1 d", userId);
  if (!user.ok) return limited(user.retryAfter);

  let body: { mode?: unknown; num?: unknown; handle?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, reason: "bad_json" }, { status: 400 });
  }
  const mode = body.mode === "hard" ? "hard" : body.mode === "classic" ? "classic" : null;
  const num = Number(body.num);
  if (!mode || !Number.isInteger(num) || num < 1 || typeof body.handle !== "string") {
    return NextResponse.json({ ok: false, reason: "bad_input" }, { status: 400 });
  }

  try {
    const result = await reportScore(sql, userId, mode, num, body.handle);
    if (!result.ok) {
      const status = result.reason === "self" ? 400 : 404;
      return NextResponse.json({ ok: false, reason: result.reason }, { status });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("v1 leaderboard report failed:", e);
    return NextResponse.json({ ok: false, reason: "upstream" }, { status: 502 });
  }
}
