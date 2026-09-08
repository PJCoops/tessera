// Server-only puzzle generator. Holds the wordlists and the grid-search
// engine; the daily puzzle is served from here via /api/v1/puzzle and never
// computed on a client (docs/flutter-app-spec.md §4.3, decision 2). Keeping
// the wordlist imports out of any "use client" module drops ~100 KB from the
// browser bundle (§13.3) and closes the devtools wordlist-extraction hole.
//
// The `server-only` import makes a client import a build error. It is aliased
// to an empty module under Vitest (vitest.config.ts) so the node test suite
// can still exercise the generator directly.
import "server-only";

import type { Locale } from "../i18n";
import {
  computeMinSwaps,
  scramble,
  startIsLegal,
  tilesFromRows,
  type DailyPuzzle,
} from "../puzzle";
import { mulberry32, shuffled } from "../rng";

import wordList4 from "../words.json";
import solutionList4 from "../solution-words.json";
import wordListEs4 from "../words-es.json";
import solutionListEs4 from "../solution-words-es.json";
import wordList5 from "../words-5.json";
import solutionList5 from "../solution-words-5.json";
import wordListEs5 from "../words-es-5.json";
import solutionListEs5 from "../solution-words-es-5.json";

// A puzzle engine bound to one wordlist (one language and one grid size).
// The same algorithm drives all locales and sizes — only the source words
// and N differ. Built once per (locale, N) pair and cached.
type Engine = {
  N: number;
  DICT: ReadonlySet<string>;
  SOLUTION: ReadonlySet<string>;
  findGoldGrid: (
    rng: () => number,
    opts?: { row0Tries?: number; nodeBudget?: number }
  ) => string[] | null;
};

function createEngine(rawWords: string[], rawSolutions: string[], N: number): Engine {
  const lengthRe = new RegExp(`^[a-z]{${N}}$`);
  // Full validation set — every word that counts as "real" for any future
  // typed-word mode. Currently only the SOLUTION subset feeds the grid
  // generator, but DICT stays exposed for parity.
  const DICT: ReadonlySet<string> = new Set(
    rawWords.map((w) => w.toLowerCase()).filter((w) => lengthRe.test(w))
  );
  // Curated subset of common, recognisable words. Gold solutions (rows AND
  // columns) are drawn from this list so puzzles avoid Scrabble fillers.
  const SOLUTION: ReadonlySet<string> = new Set(
    rawSolutions.map((w) => w.toLowerCase()).filter((w) => lengthRe.test(w))
  );
  const ALL: readonly string[] = Array.from(SOLUTION);
  // PREFIX[k] = set of length-k strings that are a prefix of some SOLUTION
  // word. Used to prune: when filling rows top-to-bottom, a column whose
  // first k letters aren't a prefix of any solution can never complete.
  const PREFIX: ReadonlySet<string>[] = (() => {
    const out: Set<string>[] = [];
    for (let k = 1; k < N; k++) out.push(new Set<string>());
    for (const w of ALL) {
      for (let k = 1; k < N; k++) out[k - 1].add(w.slice(0, k));
    }
    return out;
  })();

  function colsArePrefixes(rows: string[]): boolean {
    const k = rows.length;
    if (k === 0 || k >= N) return true;
    const set = PREFIX[k - 1];
    for (let c = 0; c < N; c++) {
      let p = "";
      for (let r = 0; r < k; r++) p += rows[r][c];
      if (!set.has(p)) return false;
    }
    return true;
  }

  function findGoldGrid(
    rng: () => number,
    opts: { row0Tries?: number; nodeBudget?: number } = {}
  ): string[] | null {
    const { row0Tries = 200, nodeBudget = 5_000_000 } = opts;
    const order = shuffled(ALL, rng);
    let nodes = 0;

    // Generic backtracking. At depth d, we have rows[0..d-1] fixed and try
    // candidate words for row d. Pruning: every partial column prefix must
    // appear in PREFIX[d]. The final row also has to satisfy the per-column
    // "completes a solution word" constraint, which we precompute when
    // d === N - 1 to avoid scanning ALL twice.
    function* candidatesForDepth(rows: string[]): Generator<string> {
      // For depth N-1 we tighten the candidate pool to words whose c-th
      // letter completes a real word in column c (given the prefix above).
      // For shallower depths we use the prefix pruning only.
      if (rows.length === N - 1) {
        const validChars: Set<string>[] = [];
        for (let c = 0; c < N; c++) {
          let stem = "";
          for (let r = 0; r < N - 1; r++) stem += rows[r][c];
          const set = new Set<string>();
          for (let cc = 97; cc <= 122; cc++) {
            const ch = String.fromCharCode(cc);
            if (SOLUTION.has(stem + ch)) set.add(ch);
          }
          if (set.size === 0) return;
          validChars.push(set);
        }
        const cands = ALL.filter((w) => {
          for (let c = 0; c < N; c++) if (!validChars[c].has(w[c])) return false;
          return true;
        });
        for (const w of shuffled(cands, rng)) yield w;
      } else {
        const cands = ALL.filter((w) => colsArePrefixes([...rows, w]));
        for (const w of shuffled(cands, rng)) yield w;
      }
    }

    function search(rows: string[]): string[] | null {
      if (rows.length === N) return rows;
      for (const cand of candidatesForDepth(rows)) {
        if (++nodes > nodeBudget) return null;
        const result = search([...rows, cand]);
        if (result) return result;
      }
      return null;
    }

    for (let i = 0; i < Math.min(row0Tries, order.length); i++) {
      const r0 = order[i];
      const result = search([r0]);
      if (result) return result;
      if (nodes > nodeBudget) return null;
    }
    return null;
  }

  return { N, DICT, SOLUTION, findGoldGrid };
}

const SUPPORTED_SIZES = [4, 5] as const;
type SupportedSize = (typeof SUPPORTED_SIZES)[number];

const sources: Record<Locale, Record<SupportedSize, { words: string[]; solutions: string[] }>> = {
  en: {
    4: { words: wordList4 as string[], solutions: solutionList4 as string[] },
    5: { words: wordList5 as string[], solutions: solutionList5 as string[] },
  },
  es: {
    4: { words: wordListEs4 as string[], solutions: solutionListEs4 as string[] },
    5: { words: wordListEs5 as string[], solutions: solutionListEs5 as string[] },
  },
};

const engineCache: Partial<Record<Locale, Partial<Record<SupportedSize, Engine>>>> = {};

function isSupportedSize(n: number): n is SupportedSize {
  return (SUPPORTED_SIZES as readonly number[]).includes(n);
}

function getEngine(locale: Locale, N: number): Engine {
  if (!isSupportedSize(N)) {
    throw new Error(`Unsupported grid size ${N}`);
  }
  const byLocale = (engineCache[locale] ??= {});
  let engine = byLocale[N];
  if (!engine) {
    const src = sources[locale][N];
    engine = createEngine(src.words, src.solutions, N);
    byLocale[N] = engine;
  }
  return engine;
}

// Backwards-compat exports — the existing English 4×4 code paths and
// `?solve` debug URL still reference these.
export const DICT = getEngine("en", 4).DICT;
export const SOLUTION = getEngine("en", 4).SOLUTION;
export function findGoldGrid(
  rng: () => number,
  opts?: { row0Tries?: number; nodeBudget?: number }
): string[] | null {
  return getEngine("en", 4).findGoldGrid(rng, opts);
}

export function generateDailyPuzzleFor(
  locale: Locale,
  seed: number,
  swaps = 12,
  N = 4
): DailyPuzzle {
  const rng = mulberry32(seed);
  const goldRows = getEngine(locale, N).findGoldGrid(rng);
  if (!goldRows) throw new Error(`No gold grid for ${locale} N=${N} seed ${seed}`);
  const solved = tilesFromRows(goldRows);
  let startTiles = scramble(solved, rng, swaps);
  for (let attempt = 0; attempt < 50 && !startIsLegal(startTiles, goldRows, N); attempt++) {
    startTiles = scramble(solved, rng, swaps);
  }
  const minSwaps = computeMinSwaps(startTiles, goldRows);
  return { goldRows, startTiles, swaps, minSwaps };
}

// English 4×4 shortcut, preserved for callers that don't care about
// locale or size (demo mode, ?solve debug, OG image renderer).
export function generateDailyPuzzle(seed: number, swaps = 12): DailyPuzzle {
  return generateDailyPuzzleFor("en", seed, swaps, 4);
}
