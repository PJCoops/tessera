// Returns all of the signed-in user's results plus streaks computed from
// them (revealed rows are not wins; imported maxima from pre-account
// history are folded in). The client merges these into localStorage.
//
// Shares its body with /api/v1/results (app/lib/results-api.ts).
//
// Required env: DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
import { NextResponse, type NextRequest } from "next/server";
import { handleResultsGet } from "../../lib/results-api";
import { rateLimit } from "../../lib/rate-limit";

export async function GET(req: NextRequest) {
  const rl = await rateLimit(req, "results-get", 30, "1 m");
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, reason: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }
  return handleResultsGet(req);
}
