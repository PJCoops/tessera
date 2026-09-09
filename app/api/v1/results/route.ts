// GET  /api/v1/results  — the signed-in user's results + streaks (sync pull)
// POST /api/v1/results  — submit one result with its swap history (sync push)
//
// Same logic as the unversioned /api/results{,/submit} (shared in
// app/lib/results-api.ts), plus a per-user rate limit alongside the IP
// limit: carrier-grade NAT means many mobile users share an IP, so the
// IP bucket alone is useless (§12.3).
//
// Required env: DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
import { NextResponse, type NextRequest } from "next/server";
import { rateLimit } from "../../../lib/rate-limit";
import { handleResultsGet, handleResultsSubmit } from "../../../lib/results-api";
import { getUserId } from "../../../lib/supabase-server";

const limited = (retryAfter: number) =>
  NextResponse.json(
    { ok: false, reason: "rate_limited" },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );

export async function GET(req: NextRequest) {
  const ip = await rateLimit(req, "v1-results-get", 60, "1 m");
  if (!ip.ok) return limited(ip.retryAfter);

  const userId = await getUserId(req);
  if (!userId) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }
  const user = await rateLimit(req, "v1-results-get-user", 30, "1 m", userId);
  if (!user.ok) return limited(user.retryAfter);

  return handleResultsGet(req, userId);
}

export async function POST(req: NextRequest) {
  const ip = await rateLimit(req, "v1-results-submit", 30, "1 m");
  if (!ip.ok) return limited(ip.retryAfter);

  const userId = await getUserId(req);
  if (!userId) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }
  const user = await rateLimit(req, "v1-results-submit-user", 10, "1 m", userId);
  if (!user.ok) return limited(user.retryAfter);

  return handleResultsSubmit(req, userId);
}
