// Hard-deletes accounts whose 48h soft-delete grace window has elapsed
// (docs/flutter-app-spec.md §6.3). Runs daily. `delete from auth.users`
// cascades to profiles, puzzle_results, leagues (owned), league_members,
// device_tokens and entitlement_events via the existing FKs.
//
// Auth: same `Authorization: Bearer ${CRON_SECRET}` + `?key=` fallback as
// the other cron routes.
//
// Required env: CRON_SECRET, DATABASE_URL

import { NextResponse, type NextRequest } from "next/server";
import { purgeExpiredDeletions } from "../../../lib/account-store";
import { getDb } from "../../../lib/db";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, reason: "cron_secret_missing" }, { status: 503 });
  }
  const auth = req.headers.get("authorization");
  const queryKey = req.nextUrl.searchParams.get("key");
  if (auth !== `Bearer ${secret}` && queryKey !== secret) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  if (!sql) {
    return NextResponse.json({ ok: false, reason: "not_configured" }, { status: 503 });
  }

  try {
    const purged = await purgeExpiredDeletions(sql);
    return NextResponse.json({ ok: true, purged, runAt: new Date().toISOString() });
  } catch (e) {
    console.error("purge-deleted-accounts failed:", e);
    return NextResponse.json({ ok: false, reason: "upstream" }, { status: 502 });
  }
}
