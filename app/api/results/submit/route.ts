// Authenticated result submission. A submission with a move history gets
// verified against the pinned puzzle server-side; the replay's own move
// count and bonus override the client's claim. Failed verification still
// stores the row unverified — a history-capture bug must not lose player
// data, it just keeps the row off future leaderboards.
//
// Shares its body with /api/v1/results (app/lib/results-api.ts).
//
// Required env: DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
import { NextResponse, type NextRequest } from "next/server";
import { handleResultsSubmit } from "../../../lib/results-api";
import { rateLimit } from "../../../lib/rate-limit";

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, "results-submit", 20, "1 m");
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, reason: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }
  return handleResultsSubmit(req);
}
