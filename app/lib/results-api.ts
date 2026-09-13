// Shared handlers for the results endpoints. The unversioned
// /api/results{,/submit} routes and the /api/v1/results route both call
// these, so the ingest/verify/store logic has one home. The v1 route
// layers a per-user rate limit on top (§12.3) — carrier-grade NAT makes
// the IP limit useless for mobile.
//
// Required env: DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY

import { NextResponse, type NextRequest } from "next/server";
import type { Locale } from "./i18n";
import type { ModeId } from "./mode";
import { getAccountState, getAdsRemoved } from "./account-store";
import { getDb } from "./db";
import type { StoredPuzzle } from "./puzzle-store";
import { parseIncomingResult, verifyIncoming } from "./results-ingest";
import {
  bumpImportedMax,
  ensureProfile,
  importedMaxes,
  listResults,
  upsertResults,
  type ResultRow,
} from "./results-store";
import { computeStreak } from "./streak-compute";
import { getUserId } from "./supabase-server";

// First-sign-in batch import bounds — shared with the legacy route.
const MAX_IMPORT = 1000;
const REPLAY_VERIFY_CAP = 60;
const UPSERT_CHUNK = 100;

function parseStreakMax(v: unknown): number {
  if (typeof v !== "object" || v === null) return 0;
  const max = (v as { max?: unknown }).max;
  return Number.isInteger(max) && (max as number) > 0 ? (max as number) : 0;
}

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
  const userId = knownUserId ?? (await getUserId(req));
  if (!userId) return unauthorized();
  if ((await getAccountState(sql, userId)).deletedAt) return accountDisabled();

  try {
    const results = await listResults(sql, userId);
    const maxes = await importedMaxes(sql, userId);
    const adsRemoved = await getAdsRemoved(sql, userId);
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
      adsRemoved,
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
  const userId = knownUserId ?? (await getUserId(req));
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

// Batch import of on-device results on first sign-in. Entries carrying a
// move history are verified server-side, newest first, up to a budget;
// the rest land unverified. Local streak maxima are preserved on the
// profile (pre-history streaks have no result rows to derive from).
// Mirrors the legacy POST /api/results/import; the v1 route adds a
// per-user rate limit and bearer auth.
export async function handleResultsImport(
  req: NextRequest,
  knownUserId?: string,
): Promise<NextResponse> {
  const sql = getDb();
  if (!sql) return notConfigured();
  const userId = knownUserId ?? (await getUserId(req));
  if (!userId) return unauthorized();
  if ((await getAccountState(sql, userId)).deletedAt) return accountDisabled();

  let body: { results?: unknown; streaks?: { classic?: unknown; hard?: unknown } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad_json" }, { status: 400 });
  }
  if (!Array.isArray(body.results)) {
    return NextResponse.json({ ok: false, reason: "bad_input" }, { status: 400 });
  }
  if (body.results.length > MAX_IMPORT) {
    return NextResponse.json({ ok: false, reason: "too_many" }, { status: 400 });
  }

  // Malformed entries are skipped, not fatal; dedupe by (mode, num) since
  // one upsert statement can't touch a row twice.
  const seen = new Set<string>();
  const entries = body.results
    .map(parseIncomingResult)
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .filter((r) => {
      const key = `${r.mode}:${r.num}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.num - a.num);

  try {
    await ensureProfile(sql, userId);
    await bumpImportedMax(sql, userId, "classic", parseStreakMax(body.streaks?.classic));
    await bumpImportedMax(sql, userId, "hard", parseStreakMax(body.streaks?.hard));

    const cache = new Map<string, StoredPuzzle>();
    const rows: ResultRow[] = [];
    let verifyBudget = REPLAY_VERIFY_CAP;
    let verifiedCount = 0;

    for (const r of entries) {
      const canVerify = verifyBudget > 0 && !r.revealed && r.history !== null;
      // localStorage keys are locale-blind — retry the other locale.
      const locales: Locale[] = r.locale === "en" ? ["en", "es"] : [r.locale, "en"];
      const verdict = canVerify
        ? await verifyIncoming(sql, r, locales, cache)
        : { verified: false, moves: r.moves, bonus: r.bonus };
      if (canVerify) verifyBudget--;
      if (verdict.verified) verifiedCount++;
      rows.push({
        mode: r.mode as ModeId,
        puzzleNumber: r.num,
        moves: verdict.moves,
        bonus: verdict.bonus,
        revealed: r.revealed,
        verified: verdict.verified,
        locale: r.locale,
        timeMs: r.timeMs,
        country: null,
        completedAtMs: r.completedAtMs,
      });
    }

    for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
      await upsertResults(sql, userId, rows.slice(i, i + UPSERT_CHUNK));
    }

    return NextResponse.json({ ok: true, imported: rows.length, verified: verifiedCount });
  } catch (e) {
    console.error("results import failed:", e);
    return NextResponse.json({ ok: false, reason: "upstream" }, { status: 502 });
  }
}
