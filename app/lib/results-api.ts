// Shared handlers for the results endpoints. The unversioned
// /api/results{,/submit} routes and the /api/v1/results route both call
// these, so the ingest/verify/store logic has one home. The v1 route
// layers a per-user rate limit on top (§12.3) — carrier-grade NAT makes
// the IP limit useless for mobile.
//
// Required env: DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY

import { NextResponse, type NextRequest } from "next/server";
import { getAccountState } from "./account-store";
import { getDb } from "./db";
import { parseIncomingResult, verifyIncoming } from "./results-ingest";
import { ensureProfile, importedMaxes, listResults, upsertResults } from "./results-store";
import { computeStreak } from "./streak-compute";
import { getUserId } from "./supabase-server";

const notConfigured = () =>
  NextResponse.json({ ok: false, reason: "not_configured" }, { status: 503 });
const unauthorized = () =>
  NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
const accountDisabled = () =>
  NextResponse.json({ ok: false, reason: "account_disabled" }, { status: 403 });

export async function handleResultsGet(
  req: NextRequest,
  knownUserId?: string,
): Promise<NextResponse> {
  void req;
  const sql = getDb();
  if (!sql) return notConfigured();
  const userId = knownUserId ?? (await getUserId());
  if (!userId) return unauthorized();
  if ((await getAccountState(sql, userId)).deletedAt) return accountDisabled();

  try {
    const results = await listResults(sql, userId);
    const maxes = await importedMaxes(sql, userId);
    const winsFor = (mode: "classic" | "hard") =>
      results.filter((r) => r.mode === mode && !r.revealed).map((r) => r.puzzleNumber);
    return NextResponse.json({
      ok: true,
      results: results.map((r) => ({
        num: r.puzzleNumber,
        mode: r.mode,
        moves: r.moves,
        bonus: r.bonus,
        revealed: r.revealed,
        verified: r.verified,
        timeMs: r.timeMs,
        completedAt: r.completedAtMs,
      })),
      streaks: {
        classic: computeStreak(winsFor("classic"), maxes.classic),
        hard: computeStreak(winsFor("hard"), maxes.hard),
      },
    });
  } catch (e) {
    console.error("results get failed:", e);
    return NextResponse.json({ ok: false, reason: "upstream" }, { status: 502 });
  }
}

export async function handleResultsSubmit(
  req: NextRequest,
  knownUserId?: string,
): Promise<NextResponse> {
  const sql = getDb();
  if (!sql) return notConfigured();
  const userId = knownUserId ?? (await getUserId());
  if (!userId) return unauthorized();
  if ((await getAccountState(sql, userId)).deletedAt) return accountDisabled();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad_json" }, { status: 400 });
  }

  const parsed = parseIncomingResult(body);
  if (!parsed) {
    return NextResponse.json({ ok: false, reason: "bad_input" }, { status: 400 });
  }

  const country = req.headers.get("x-vercel-ip-country") ?? "ZZ";

  try {
    await ensureProfile(sql, userId);
    const verdict = await verifyIncoming(sql, parsed, [parsed.locale], new Map());
    await upsertResults(sql, userId, [
      {
        mode: parsed.mode,
        puzzleNumber: parsed.num,
        moves: verdict.moves,
        bonus: verdict.bonus,
        revealed: parsed.revealed,
        verified: verdict.verified,
        locale: parsed.locale,
        timeMs: parsed.timeMs,
        country,
        completedAtMs: parsed.completedAtMs,
      },
    ]);
    return NextResponse.json({ ok: true, verified: verdict.verified });
  } catch (e) {
    console.error("results submit failed:", e);
    return NextResponse.json({ ok: false, reason: "upstream" }, { status: 502 });
  }
}
