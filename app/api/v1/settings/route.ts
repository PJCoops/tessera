// POST /api/v1/settings — persist account-level settings that should
// follow the player across devices/platforms (spec §17.2: colour-blind
// palette). Bearer-auth. Mobile-only for now — web has no equivalent
// toggle wired yet ("web honours it later").
//
// Required env: DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "../../../lib/rate-limit";
import { getUserId } from "../../../lib/supabase-server";
import { getDb } from "../../../lib/db";
import { setColourBlind } from "../../../lib/account-store";
import { ensureProfile } from "../../../lib/results-store";

export async function POST(req: NextRequest) {
  const ip = await rateLimit(req, "v1-settings-post", 20, "1 m");
  if (!ip.ok) {
    return NextResponse.json(
      { ok: false, reason: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(ip.retryAfter) } },
    );
  }

  const sql = getDb();
  if (!sql) return NextResponse.json({ ok: false, reason: "not_configured" }, { status: 503 });

  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });

  let body: { colourBlind?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, reason: "bad_json" }, { status: 400 });
  }
  if (typeof body.colourBlind !== "boolean") {
    return NextResponse.json({ ok: false, reason: "bad_input" }, { status: 400 });
  }

  try {
    // A settings toggle can happen before the player has ever submitted a
    // result or set a handle — either of which is what normally creates
    // the profiles row — so make sure it exists first.
    await ensureProfile(sql, userId);
    await setColourBlind(sql, userId, body.colourBlind);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("v1 settings POST failed:", e);
    return NextResponse.json({ ok: false, reason: "upstream" }, { status: 502 });
  }
}
