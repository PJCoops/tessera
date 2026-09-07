// Cross-platform parity fixture — the executable contract the Flutter
// port must reproduce byte-for-byte.
//
// `buildParityFixture()` derives a fully deterministic snapshot from the
// live web logic (puzzle generation, share formatting, streak math,
// puzzle-number arithmetic). It is:
//
//   1. asserted against the committed `mobile-parity.fixture.json` by
//      `mobile-parity.test.ts` — so a change to any of those modules that
//      would break the mobile client fails CI on the web side first;
//   2. copied verbatim into `mobile/test/fixtures/parity.json` by the
//      mobile build step (see docs/flutter-app-spec.md §4.4, §20) and
//      asserted again from `flutter test` — so the Dart ports are pinned
//      to the same output.
//
// Regenerate after an intentional logic change:
//   npm run gen:parity
// then review the JSON diff before committing.

import { EPOCH } from "./epoch";
import { getDictionary, type Locale } from "./i18n";
import { CLASSIC, HARD, modeById, type ModeId } from "./mode";
import { generateDailyPuzzleFor } from "./puzzle";
import { dateFromPuzzleNumber, puzzleNumber, seedFromDate } from "./rng";
import {
  buildGrid,
  buildSharePayload,
  buildShareSlug,
  parseShareSlug,
} from "./share";
import { computeStreak } from "./streak-compute";

// ── Colour-blind grid transform ────────────────────────────────────────
// The colour-blind palette (docs/flutter-app-spec.md §17.2) swaps the
// green solved tile for blue in every surface, including the text emoji
// grid. The bonus corner (🟧) already reads correctly against blue and
// is unchanged. This is the canonical transform the Dart port mirrors.
export const CB_SOLVED_TILE = "🟦";
const DEFAULT_SOLVED_TILE = "🟩";

export function toColourBlindGrid(grid: string): string {
  return grid.split(DEFAULT_SOLVED_TILE).join(CB_SOLVED_TILE);
}

// ── Which puzzles / inputs the fixture covers ──────────────────────────

const PUZZLE_NUMBERS = [1, 7, 30, 100, 365] as const;
const LOCALES: readonly Locale[] = ["en", "es"];
const MODES: readonly ModeId[] = ["classic", "hard"];

// Share-payload cases are chosen to exercise every tier band, both
// singular/plural swap wording, the streak-meta threshold, the bonus
// meta line, the revealed headline (no CTA), and the hard-mode headline
// key. minSwaps is fixed at 6 (classic) / 9 (hard) so `moves` alone
// drives the ratio → tier mapping.
const SHARE_PAYLOAD_CASES = [
  { puzzleNumber: 7, moves: 6, minSwaps: 6, streak: 1, bonus: false, revealed: false, mode: "classic" as ModeId }, // legendary, no streak meta
  { puzzleNumber: 7, moves: 12, minSwaps: 6, streak: 5, bonus: false, revealed: false, mode: "classic" as ModeId }, // genius, streak meta
  { puzzleNumber: 7, moves: 24, minSwaps: 6, streak: 3, bonus: true, revealed: false, mode: "classic" as ModeId }, // wordsmith, streak + bonus meta
  { puzzleNumber: 7, moves: 1, minSwaps: 6, streak: 2, bonus: false, revealed: false, mode: "classic" as ModeId }, // singular "swap"
  { puzzleNumber: 7, moves: 36, minSwaps: 6, streak: 1, bonus: false, revealed: false, mode: "classic" as ModeId }, // persistent
  { puzzleNumber: 7, moves: 60, minSwaps: 6, streak: 1, bonus: false, revealed: false, mode: "classic" as ModeId }, // tenacious
  { puzzleNumber: 7, moves: 12, minSwaps: 6, streak: 9, bonus: false, revealed: true, mode: "classic" as ModeId }, // revealed, no CTA
  { puzzleNumber: 7, moves: 18, minSwaps: 9, streak: 4, bonus: false, revealed: false, mode: "hard" as ModeId }, // hard headline key, 5×5 grid
] as const;

// Streak cases mirror streak-compute.test.ts plus a current long run and
// an imported max that sits between the derivable runs.
const STREAK_CASES: readonly { nums: number[]; importedMax?: number }[] = [
  { nums: [] },
  { nums: [], importedMax: 9 },
  { nums: [7] },
  { nums: [5, 6, 7] },
  { nums: [1, 2, 5, 6, 7] },
  { nums: [1, 2, 3, 4, 10] },
  { nums: [4, 3, 3, 5] },
  { nums: [5, 6], importedMax: 12 },
  { nums: [100, 101, 102, 103, 104] },
  { nums: [1, 2, 3, 50], importedMax: 7 },
];

const SHARE_SLUG_CASES: readonly {
  num: number;
  moves: number | null;
  bonus: boolean;
  revealed: boolean;
  mode?: ModeId;
}[] = [
  { num: 8, moves: 12, bonus: false, revealed: false },
  { num: 8, moves: 12, bonus: true, revealed: false },
  { num: 8, moves: 0, bonus: false, revealed: false },
  { num: 1, moves: 99, bonus: true, revealed: false },
  { num: 8, moves: 12, bonus: false, revealed: true },
  { num: 42, moves: 7, bonus: false, revealed: false, mode: "hard" },
  { num: 42, moves: 7, bonus: true, revealed: false, mode: "hard" },
  { num: 42, moves: null, bonus: false, revealed: true, mode: "hard" },
];

const SHARE_GRID_CASES: readonly { revealed: boolean; bonus: boolean; N: number }[] = [
  { revealed: false, bonus: false, N: 4 },
  { revealed: false, bonus: true, N: 4 },
  { revealed: true, bonus: false, N: 4 },
  { revealed: false, bonus: false, N: 5 },
  { revealed: false, bonus: true, N: 5 },
  { revealed: true, bonus: false, N: 5 },
];

// ── Fixture types ─────────────────────────────────────────────────────

export type ParityPuzzle = {
  num: number;
  date: string;
  locale: Locale;
  mode: ModeId;
  seed: number;
  swaps: number;
  n: number;
  goldRows: string[];
  startLetters: string;
  startTiles: { id: number; letter: string }[];
  minSwaps: number;
};

export type ParityFixture = {
  meta: {
    epoch: string;
    note: string;
  };
  puzzleNumber: { num: number; date: string; roundTrips: boolean }[];
  puzzles: ParityPuzzle[];
  shareSlugs: {
    input: (typeof SHARE_SLUG_CASES)[number];
    slug: string;
    parsed: ReturnType<typeof parseShareSlug>;
  }[];
  shareGrids: {
    input: (typeof SHARE_GRID_CASES)[number];
    default: string;
    colourBlind: string;
  }[];
  sharePayloads: {
    input: (typeof SHARE_PAYLOAD_CASES)[number] & { locale: Locale };
    text: string;
    url: string;
    full: string;
  }[];
  streaks: {
    nums: number[];
    importedMax: number;
    result: ReturnType<typeof computeStreak>;
  }[];
};

// ── Builder ──────────────────────────────────────────────────────────

export function buildParityFixture(): ParityFixture {
  const puzzleNumberChecks = PUZZLE_NUMBERS.map((num) => {
    const date = dateFromPuzzleNumber(num, EPOCH);
    return { num, date, roundTrips: puzzleNumber(date, EPOCH) === num };
  });

  const puzzles: ParityPuzzle[] = [];
  for (const num of PUZZLE_NUMBERS) {
    const date = dateFromPuzzleNumber(num, EPOCH);
    const seed = seedFromDate(date);
    for (const locale of LOCALES) {
      for (const modeId of MODES) {
        const mode = modeById(modeId);
        const gen = generateDailyPuzzleFor(locale, seed, mode.swaps, mode.N);
        puzzles.push({
          num,
          date,
          locale,
          mode: modeId,
          seed,
          swaps: mode.swaps,
          n: mode.N,
          goldRows: gen.goldRows,
          startLetters: gen.startTiles.map((t) => t.letter).join(""),
          startTiles: gen.startTiles.map((t) => ({ id: t.id, letter: t.letter })),
          minSwaps: gen.minSwaps,
        });
      }
    }
  }

  const shareSlugs = SHARE_SLUG_CASES.map((input) => {
    const slug = buildShareSlug(input);
    return { input, slug, parsed: parseShareSlug(slug) };
  });

  const shareGrids = SHARE_GRID_CASES.map((input) => {
    const grid = buildGrid(input);
    return { input, default: grid, colourBlind: toColourBlindGrid(grid) };
  });

  const sharePayloads = SHARE_PAYLOAD_CASES.flatMap((base) =>
    LOCALES.map((locale) => {
      const input = { ...base, locale };
      const payload = buildSharePayload({
        puzzleNumber: base.puzzleNumber,
        moves: base.moves,
        minSwaps: base.minSwaps,
        streak: base.streak,
        bonus: base.bonus,
        revealed: base.revealed,
        locale,
        dict: getDictionary(locale),
        mode: base.mode === "hard" ? HARD : CLASSIC,
      });
      return { input, text: payload.text, url: payload.url, full: payload.full };
    })
  );

  const streaks = STREAK_CASES.map(({ nums, importedMax = 0 }) => ({
    nums,
    importedMax,
    result: computeStreak(nums, importedMax),
  }));

  return {
    meta: {
      epoch: EPOCH,
      note:
        "Generated by app/lib/mobile-parity.ts from live web logic. " +
        "Regenerate with `npm run gen:parity`. The Flutter port must " +
        "reproduce every value here exactly.",
    },
    puzzleNumber: puzzleNumberChecks,
    puzzles,
    shareSlugs,
    shareGrids,
    sharePayloads,
    streaks,
  };
}
