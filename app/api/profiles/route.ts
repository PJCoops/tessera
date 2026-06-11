// The signed-in user's public handle. GET reads it; PATCH sets it.
// Setting a handle is how a player opts into leaderboards and leagues.
//
// Required env: DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "../../lib/rate-limit";
import { getUserId } from "../../lib/supabase-server";
import { getDb } from "../../lib/db";
import { ensureProfile } from "../../lib/results-store";
import { validateHandle } from "../../lib/handle";

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "23505";
}

export async function GET(req: NextRequest) {
  const rl = await rateLimit(req, "profiles-get", 30, "1 m");
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, reason: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }
  const sql = getDb();
  if (!sql) return NextResponse.json({ ok: false, reason: "not_configured" }, { status: 503 });
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });

  try {
    const rows = await sql<{ display_name: string | null }[]>`
      select display_name from profiles where id = ${userId}`;
    return NextResponse.json({ ok: true, displayName: rows[0]?.display_name ?? null });
  } catch (e) {
    console.error("profiles GET failed:", e);
    return NextResponse.json({ ok: false, reason: "upstream" }, { status: 502 });
  }
}

export async function PATCH(req: NextRequest) {
  const rl = await rateLimit(req, "profiles-set", 10, "1 m");
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, reason: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }
  const sql = getDb();
  if (!sql) return NextResponse.json({ ok: false, reason: "not_configured" }, { status: 503 });
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });

  let body: { displayName?: unknown };
  try {
    body = (await req.json()) as { displayName?: unknown };
  } catch {
    return NextResponse.json({ ok: false, reason: "bad_json" }, { status: 400 });
  }
  if (typeof body.displayName !== "string") {
    return NextResponse.json({ ok: false, reason: "bad_input" }, { status: 400 });
  }
  const v = validateHandle(body.displayName);
  if (!v.ok) {
    return NextResponse.json({ ok: false, reason: "invalid", detail: v.reason }, { status: 400 });
  }

  try {
    await ensureProfile(sql, userId);
    // The lower(display_name) unique index makes this race-safe: a
    // concurrent claim surfaces as 23505 rather than a TOCTOU gap.
    await sql`
      update profiles set display_name = ${v.value}, updated_at = now()
      where id = ${userId}`;
    return NextResponse.json({ ok: true, displayName: v.value });
  } catch (e) {
    if (isUniqueViolation(e)) {
      return NextResponse.json({ ok: false, reason: "taken" }, { status: 409 });
    }
    console.error("profiles PATCH failed:", e);
    return NextResponse.json({ ok: false, reason: "upstream" }, { status: 502 });
  }
}
