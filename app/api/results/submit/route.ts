// Authenticated result submission. A submission with a move history gets
// verified against the pinned puzzle server-side; the replay's own move
// count and bonus override the client's claim. Failed verification still
// stores the row unverified — a history-capture bug must not lose player
// data, it just keeps the row off future leaderboards.
//
// Required env: DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "../../../lib/rate-limit";
import { getUserId } from "../../../lib/supabase-server";
import { getDb } from "../../../lib/db";
import { ensureProfile, upsertResults } from "../../../lib/results-store";
import { parseIncomingResult, verifyIncoming } from "../../../lib/results-ingest";

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, "results-submit", 20, "1 m");
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad_json" }, { status: 400 });
  }

  const parsed = parseIncomingResult(body);
  if (!parsed) {
    return NextResponse.json({ ok: false, reason: "bad_input" }, { status: 400 });
  }

  // Vercel sets this on every edge request; missing locally → "ZZ".
  const country = req.headers.get("x-vercel-ip-country") ?? "ZZ";

  try {
    await ensureProfile(sql, userId);
    const verdict = await verifyIncoming(sql, parsed, [parsed.locale], new Map());
    await upsertResults(sql, userId, [
      {
        mode: parsed.mode,
        puzzleNumber: parsed.num,
        moves: verdict.moves,
        bonus: verdict.bonus,
        revealed: parsed.revealed,
        verified: verdict.verified,
        locale: parsed.locale,
        timeMs: parsed.timeMs,
        country,
        completedAtMs: parsed.completedAtMs,
      },
    ]);
    return NextResponse.json({ ok: true, verified: verdict.verified });
  } catch (e) {
    console.error("results/submit failed:", e);
    return NextResponse.json({ ok: false, reason: "upstream" }, { status: 502 });
  }
}
