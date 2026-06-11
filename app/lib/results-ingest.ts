import type { Sql } from "./db";
import { EPOCH } from "./epoch";
import { isLocale, type Locale } from "./i18n";
import type { ModeId } from "./mode";
import { puzzleNumber, dateFromPuzzleNumber, todayUtc } from "./rng";
import { isSwapHistory, validateReplay, type SwapPair } from "./replay-validate";
import { getOrCreatePuzzle, type StoredPuzzle } from "./puzzle-store";

const DAY_MS = 86_400_000;
const EPOCH_MS = Date.parse(`${EPOCH}T00:00:00Z`);
// Unverified move claims only need a sanity bound; verified rows get their
// count from the replay itself.
const MAX_CLAIMED_MOVES = 10_000;

export type IncomingResult = {
  num: number;
  mode: ModeId;
  locale: Locale;
  moves: number;
  bonus: boolean;
  revealed: boolean;
  history: SwapPair[] | null;
  timeMs: number | null;
  completedAtMs: number;
};

// Parses one untrusted result payload. Returns null when structurally
// invalid. Malformed history downgrades to "no history" rather than
// rejecting: the row is still real player data, it just can't verify.
export function parseIncomingResult(v: unknown): IncomingResult | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  const num = o.num;
  if (!Number.isInteger(num) || (num as number) < 1) return null;
  if ((num as number) > puzzleNumber(todayUtc(), EPOCH)) return null;
  const mode: ModeId | null = o.mode === "hard" ? "hard" : o.mode === "classic" ? "classic" : null;
  if (!mode) return null;
  if (!isLocale(o.locale)) return null;
  const moves = o.moves;
  if (!Number.isInteger(moves) || (moves as number) < 0 || (moves as number) > MAX_CLAIMED_MOVES) {
    return null;
  }
  const history = isSwapHistory(o.history) && o.history.length > 0 ? o.history : null;
  const now = Date.now();
  const completedRaw = typeof o.completedAt === "number" ? o.completedAt : now;
  const completedAtMs = Math.min(Math.max(completedRaw, EPOCH_MS), now + 5 * 60_000);
  const timeMs =
    typeof o.timeMs === "number" && Number.isFinite(o.timeMs) && o.timeMs >= 0
      ? Math.min(Math.floor(o.timeMs), DAY_MS)
      : null;
  return {
    num: num as number,
    mode,
    locale: o.locale,
    moves: moves as number,
    bonus: o.bonus === true,
    revealed: o.revealed === true,
    history,
    timeMs,
    completedAtMs,
  };
}

export type Verdict = { verified: boolean; moves: number; bonus: boolean };

// Tries to verify a result's replay against the pinned puzzle for each
// candidate locale (localStorage keys are locale-blind, so an imported
// entry's locale is best-effort). Server-derived moves/bonus override the
// client's claim on success. The cache spares repeat pin lookups when a
// batch shares days.
export async function verifyIncoming(
  sql: Sql,
  r: IncomingResult,
  locales: Locale[],
  cache: Map<string, StoredPuzzle>
): Promise<Verdict> {
  if (!r.revealed && r.history) {
    const date = dateFromPuzzleNumber(r.num, EPOCH);
    for (const locale of locales) {
      const key = `${date}:${locale}:${r.mode}`;
      let puzzle = cache.get(key);
      if (!puzzle) {
        puzzle = await getOrCreatePuzzle(sql, date, locale, r.mode);
        cache.set(key, puzzle);
      }
      const verdict = validateReplay(puzzle.startLetters, puzzle.goldRows, r.history);
      if (verdict.ok) return { verified: true, moves: verdict.moves, bonus: verdict.bonus };
    }
  }
  return { verified: false, moves: r.moves, bonus: r.bonus };
}
