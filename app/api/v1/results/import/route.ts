// POST /api/v1/results/import — first-sign-in batch import (sync push).
//
// Same logic as the unversioned /api/results/import (shared in
// app/lib/results-api.ts), plus a per-user rate limit alongside the IP
// limit (§12.3) and bearer-token auth for native clients.
//
// Required env: DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
import { NextResponse, type NextRequest } from "next/server";
import { rateLimit } from "../../../../lib/rate-limit";
import { handleResultsImport } from "../../../../lib/results-api";
import { getUserId } from "../../../../lib/supabase-server";

const limited = (retryAfter: number) =>
  NextResponse.json(
    { ok: false, reason: "rate_limited" },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );

export async function POST(req: NextRequest) {
  const ip = await rateLimit(req, "v1-results-import", 20, "1 h");
  if (!ip.ok) return limited(ip.retryAfter);

  const userId = await getUserId(req);
  if (!userId) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }
  const user = await rateLimit(req, "v1-results-import-user", 5, "1 h", userId);
  if (!user.ok) return limited(user.retryAfter);

  return handleResultsImport(req, userId);
}
