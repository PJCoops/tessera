// Batch import of localStorage results on first sign-in. Entries carrying
// a move history are verified server-side, newest first, up to a budget;
// the rest land unverified (streaks and history still count them, future
// leaderboards won't). Local streak maxima are preserved on the profile
// because pre-history streaks may have no result rows to derive from.
//
// Required env: DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "../../../lib/rate-limit";
import { getUserId } from "../../../lib/supabase-server";
import { getDb } from "../../../lib/db";
import { bumpImportedMax, ensureProfile, upsertResults, type ResultRow } from "../../../lib/results-store";
import { parseIncomingResult, verifyIncoming } from "../../../lib/results-ingest";
import type { StoredPuzzle } from "../../../lib/puzzle-store";
import type { ModeId } from "../../../lib/mode";
import type { Locale } from "../../../lib/i18n";

const MAX_IMPORT = 1000;
// Histories only exist from the capture deploy onward, so a generous cap
// still verifies every realistic import while bounding worst-case work.
const REPLAY_VERIFY_CAP = 60;
const UPSERT_CHUNK = 100;

type Body = {
  results?: unknown;
  streaks?: { classic?: unknown; hard?: unknown };
};

function parseStreakMax(v: unknown): number {
  if (typeof v !== "object" || v === null) return 0;
  const max = (v as { max?: unknown }).max;
  return Number.isInteger(max) && (max as number) > 0 ? (max as number) : 0;
}

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, "results-import", 5, "1 m");
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, reason: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const sql = getDb();
  if (!sql) {
    return NextResponse.json({ ok: false, reason: "not_configured" }, { status: 503 });
  }

  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, reason: "bad_json" }, { status: 400 });
  }

  if (!Array.isArray(body.results)) {
    return NextResponse.json({ ok: false, reason: "bad_input" }, { status: 400 });
  }
  if (body.results.length > MAX_IMPORT) {
    return NextResponse.json({ ok: false, reason: "too_many" }, { status: 400 });
  }

  // Individually malformed entries are skipped, not fatal; dedupe by
  // (mode, num) since one upsert statement can't touch a row twice.
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
      // The entry's locale is best-effort (localStorage keys are
      // locale-blind), so retry the other locale before giving up.
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
        completedAtMs: r.completedAtMs,
      });
    }

    for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
      await upsertResults(sql, userId, rows.slice(i, i + UPSERT_CHUNK));
    }

    return NextResponse.json({ ok: true, imported: rows.length, verified: verifiedCount });
  } catch (e) {
    console.error("results/import failed:", e);
    return NextResponse.json({ ok: false, reason: "upstream" }, { status: 502 });
  }
}
