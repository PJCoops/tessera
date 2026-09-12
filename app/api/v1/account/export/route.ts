// GET /api/v1/account/export — GDPR / UK-GDPR data-subject access
// (docs/flutter-app-spec.md §14.2). Returns everything the app stores
// about the signed-in user as a JSON download. Same control is offered
// on web for parity.
//
// Required env: DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL,
//   NEXT_PUBLIC_SUPABASE_ANON_KEY

import { NextResponse, type NextRequest } from "next/server";
import { exportAccountData } from "../../../../lib/account-store";
import { getDb } from "../../../../lib/db";
import { rateLimit } from "../../../../lib/rate-limit";
import { getUserId } from "../../../../lib/supabase-server";

export async function GET(req: NextRequest) {
  const ip = await rateLimit(req, "v1-account-export", 5, "1 h");
  if (!ip.ok) {
    return NextResponse.json(
      { ok: false, reason: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(ip.retryAfter) } },
    );
  }

  const sql = getDb();
  if (!sql) {
    return NextResponse.json({ ok: false, reason: "not_configured" }, { status: 503 });
  }

  const userId = await getUserId(req);
  if (!userId) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const user = await rateLimit(req, "v1-account-export-user", 3, "1 h", userId);
  if (!user.ok) {
    return NextResponse.json(
      { ok: false, reason: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(user.retryAfter) } },
    );
  }

  try {
    const data = await exportAccountData(sql, userId);
    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": 'attachment; filename="tessera-account-export.json"',
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("account export failed:", e);
    return NextResponse.json({ ok: false, reason: "upstream" }, { status: 502 });
  }
}
