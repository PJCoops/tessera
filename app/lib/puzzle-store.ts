import type { Sql } from "./db";
import { generateDailyPuzzleFor } from "./puzzle";
import { seedFromDate } from "./rng";
import { modeById, type ModeId } from "./mode";
import type { Locale } from "./i18n";

export type StoredPuzzle = {
  goldRows: string[];
  startLetters: string;
  minSwaps: number;
};

type PuzzleRow = {
  gold_rows: string[];
  start_letters: string;
  min_swaps: number;
};

function toPuzzle(row: PuzzleRow): StoredPuzzle {
  return {
    goldRows: row.gold_rows,
    startLetters: row.start_letters,
    minSwaps: Number(row.min_swaps),
  };
}

// Returns the pinned puzzle for a day, generating and pinning it on first
// touch. Wordlist edits after a puzzle airs can change regeneration, so
// the first-written row is canonical forever; concurrent racers converge
// through ON CONFLICT DO NOTHING plus the re-select.
export async function getOrCreatePuzzle(
  sql: Sql,
  date: string,
  locale: Locale,
  modeId: ModeId
): Promise<StoredPuzzle> {
  const found = await sql<PuzzleRow[]>`
    select gold_rows, start_letters, min_swaps from puzzles
    where date = ${date} and locale = ${locale} and mode = ${modeId}`;
  if (found.length > 0) return toPuzzle(found[0]);

  const mode = modeById(modeId);
  const generated = generateDailyPuzzleFor(locale, seedFromDate(date), mode.swaps, mode.N);
  const startLetters = generated.startTiles.map((t) => t.letter).join("");
  await sql`
    insert into puzzles (date, locale, mode, gold_rows, start_letters, min_swaps)
    values (${date}, ${locale}, ${modeId}, ${generated.goldRows}, ${startLetters}, ${generated.minSwaps})
    on conflict do nothing`;

  const after = await sql<PuzzleRow[]>`
    select gold_rows, start_letters, min_swaps from puzzles
    where date = ${date} and locale = ${locale} and mode = ${modeId}`;
  if (after.length === 0) throw new Error(`puzzle pin failed for ${date} ${locale} ${modeId}`);
  return toPuzzle(after[0]);
}
