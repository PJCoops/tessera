// Account lifecycle, entirely in-app (no web redirect, no email-link
// step — App Store Guideline 5.1.1(v), docs/flutter-app-spec.md §6.3).
//
//   DELETE /api/v1/account          request deletion (soft, 48h grace)
//   POST   /api/v1/account restore  cancel a pending deletion
//
// DELETE requires a *fresh* re-authentication (the caller re-verified
// OTP / re-did OAuth within ~5 min) so a stolen long-lived token can't
// nuke an account. Rate-limited per user and per IP.
//
// Required env: DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL,
//   NEXT_PUBLIC_SUPABASE_ANON_KEY, LOOPS_API_KEY (confirmation email)

import { NextResponse, type NextRequest } from "next/server";
import { getAccountState, restoreAccount, softDeleteAccount } from "../../../lib/account-store";
import { getAuthContext, isFreshAuth } from "../../../lib/auth-context";
import { getDb } from "../../../lib/db";
import { sendLoopsEvent } from "../../../lib/loops";
import { rateLimit } from "../../../lib/rate-limit";

const limited = (retryAfter: number) =>
  NextResponse.json(
    { ok: false, reason: "rate_limited" },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );

export async function DELETE(req: NextRequest) {
  const ipLimit = await rateLimit(req, "v1-account-delete", 5, "1 h");
  if (!ipLimit.ok) return limited(ipLimit.retryAfter);

  const sql = getDb();
  if (!sql) {
    return NextResponse.json({ ok: false, reason: "not_configured" }, { status: 503 });
  }

  const ctx = await getAuthContext(req);
  if (!ctx) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const userLimit = await rateLimit(req, "v1-account-delete-user", 3, "1 h", ctx.userId);
  if (!userLimit.ok) return limited(userLimit.retryAfter);

  if (!isFreshAuth(ctx)) {
    // Client should re-run the OTP / OAuth flow and retry.
    return NextResponse.json({ ok: false, reason: "reauth_required" }, { status: 401 });
  }

  try {
    const state = await getAccountState(sql, ctx.userId);
    if (!state.exists) {
      return NextResponse.json({ ok: false, reason: "no_account" }, { status: 404 });
    }

    const { alreadyPending, permanentAt } = await softDeleteAccount(sql, ctx.userId);

    if (!alreadyPending && ctx.email) {
      await sendLoopsEvent(ctx.email, "account_deletion_scheduled", {
        permanent_at: permanentAt.toISOString(),
      });
    }

    return NextResponse.json({
      ok: true,
      status: "pending_deletion",
      permanentAt: permanentAt.toISOString(),
      alreadyPending,
    });
  } catch (e) {
    console.error("account delete failed:", e);
    return NextResponse.json({ ok: false, reason: "upstream" }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, "v1-account-restore", 10, "1 h");
  if (!rl.ok) return limited(rl.retryAfter);

  const sql = getDb();
  if (!sql) {
    return NextResponse.json({ ok: false, reason: "not_configured" }, { status: 503 });
  }

  const ctx = await getAuthContext(req);
  if (!ctx) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad_json" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || (body as { action?: unknown }).action !== "restore") {
    return NextResponse.json({ ok: false, reason: "bad_input" }, { status: 400 });
  }

  try {
    const restored = await restoreAccount(sql, ctx.userId);
    return NextResponse.json({ ok: true, restored });
  } catch (e) {
    console.error("account restore failed:", e);
    return NextResponse.json({ ok: false, reason: "upstream" }, { status: 502 });
  }
}
