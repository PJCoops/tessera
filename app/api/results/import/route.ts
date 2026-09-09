// Batch import of localStorage results on first sign-in (web). The
// ingest/verify/store logic lives in app/lib/results-api.ts and is shared
// with POST /api/v1/results/import (mobile); this route just adds the IP
// rate limit.
//
// Required env: DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
import { NextResponse, type NextRequest } from "next/server";
import { rateLimit } from "../../../lib/rate-limit";
import { handleResultsImport } from "../../../lib/results-api";

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, "results-import", 5, "1 m");
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, reason: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }
  return handleResultsImport(req);
}
