import wordList from "./words.json";
import solutionList from "./solution-words.json";
import wordListEs from "./words-es.json";
import solutionListEs from "./solution-words-es.json";
import demoGridJson from "./demo-grid.json";
import { mulberry32, shuffled } from "./rng";
import type { Locale } from "./i18n";

export const DEMO_GRID: readonly string[] = demoGridJson as string[];

export type Tile = { id: number; letter: string };

export function tilesFromRows(rows: string[]): Tile[] {
  const letters = rows.join("").toUpperCase().split("");
  return letters.map((letter, id) => ({ id, letter }));
}

type Move = [number, number];

export function scramble(start: Tile[], rng: () => number, swaps: number): Tile[] {
  let p = start.slice();
  let last: Move | null = null;
  let i = 0;
  while (i < swaps) {
    const a = Math.floor(rng() * p.length);
    let b = Math.floor(rng() * p.length);
    while (b === a) b = Math.floor(rng() * p.length);
    if (last && ((last[0] === a && last[1] === b) || (last[0] === b && last[1] === a))) continue;
    [p[a], p[b]] = [p[b], p[a]];
    last = [a, b];
    i++;
  }
  return p;
}

function everyRowHasHomeTile(p: Tile[]): boolean {
  for (let r = 0; r < 4; r++) {
    let any = false;
    for (let c = 0; c < 4; c++) {
      if (Math.floor(p[r * 4 + c].id / 4) === r) { any = true; break; }
    }
    if (!any) return false;
  }
  return true;
}

export type DailyPuzzle = {
  goldRows: string[];
  startTiles: Tile[];
  swaps: number;
};

// A puzzle engine bound to one wordlist (one language). The same algorithm
// drives all locales — only the source words differ. Built once per locale
// at module load and cached.
type Engine = {
  DICT: ReadonlySet<string>;
  SOLUTION: ReadonlySet<string>;
  findGoldGrid: (
    rng: () => number,
    opts?: { row0Tries?: number; nodeBudget?: number }
  ) => string[] | null;
};

function createEngine(rawWords: string[], rawSolutions: string[]): Engine {
  // Full validation set — every word that counts as "real" for any future
  // typed-word mode. Currently only the SOLUTION subset feeds the grid
  // generator, but DICT stays exposed for parity with the English engine.
  const DICT: ReadonlySet<string> = new Set(
    rawWords.map((w) => w.toLowerCase()).filter((w) => /^[a-z]{4}$/.test(w))
  );
  // Curated subset of common, recognisable words. Gold solutions (rows AND
  // columns) are drawn from this list so puzzles avoid Scrabble fillers.
  const SOLUTION: ReadonlySet<string> = new Set(
    rawSolutions.map((w) => w.toLowerCase()).filter((w) => /^[a-z]{4}$/.test(w))
  );
  const ALL: readonly string[] = Array.from(SOLUTION);
  const PREFIX: ReadonlySet<string> = (() => {
    const s = new Set<string>();
    for (const w of ALL) {
      s.add(w[0]);
      s.add(w.slice(0, 2));
      s.add(w.slice(0, 3));
    }
    return s;
  })();

  function colsArePrefixes(rows: string[]): boolean {
    const k = rows.length;
    for (let c = 0; c < 4; c++) {
      let p = "";
      for (let r = 0; r < k; r++) p += rows[r][c];
      if (!PREFIX.has(p)) return false;
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

    for (let i = 0; i < Math.min(row0Tries, order.length); i++) {
      const r0 = order[i];
      const r1Cands = shuffled(ALL.filter((w) => colsArePrefixes([r0, w])), rng);
      for (const r1 of r1Cands) {
        if (++nodes > nodeBudget) return null;
        const r2Cands = shuffled(ALL.filter((w) => colsArePrefixes([r0, r1, w])), rng);
        for (const r2 of r2Cands) {
          if (++nodes > nodeBudget) return null;
          const validChars: Set<string>[] = [];
          let dead = false;
          for (let c = 0; c < 4; c++) {
            const stem = r0[c] + r1[c] + r2[c];
            const set = new Set<string>();
            for (let cc = 97; cc <= 122; cc++) {
              const ch = String.fromCharCode(cc);
              if (SOLUTION.has(stem + ch)) set.add(ch);
            }
            if (set.size === 0) { dead = true; break; }
            validChars.push(set);
          }
          if (dead) continue;
          const r3Cands = ALL.filter(
            (w) =>
              validChars[0].has(w[0]) &&
              validChars[1].has(w[1]) &&
              validChars[2].has(w[2]) &&
              validChars[3].has(w[3])
          );
          if (r3Cands.length > 0) {
            return [r0, r1, r2, shuffled(r3Cands, rng)[0]];
          }
        }
      }
    }
    return null;
  }

  return { DICT, SOLUTION, findGoldGrid };
}

const engines: Record<Locale, Engine> = {
  en: createEngine(wordList as string[], solutionList as string[]),
  es: createEngine(wordListEs as string[], solutionListEs as string[]),
};

// Backwards-compat exports — the existing English puzzle code paths and
// `?solve` debug URL still reference these.
export const DICT = engines.en.DICT;
export const SOLUTION = engines.en.SOLUTION;
export const findGoldGrid = engines.en.findGoldGrid;

export function generateDailyPuzzleFor(
  locale: Locale,
  seed: number,
  swaps = 12
): DailyPuzzle {
  const rng = mulberry32(seed);
  const goldRows = engines[locale].findGoldGrid(rng);
  if (!goldRows) throw new Error(`No gold grid for ${locale} seed ${seed}`);
  const solved = tilesFromRows(goldRows);
  let startTiles = scramble(solved, rng, swaps);
  for (let attempt = 0; attempt < 50 && !everyRowHasHomeTile(startTiles); attempt++) {
    startTiles = scramble(solved, rng, swaps);
  }
  return { goldRows, startTiles, swaps };
}

// English shortcut, preserved for callers that don't care about locale
// (demo mode, ?solve debug, OG image renderer).
export function generateDailyPuzzle(seed: number, swaps = 12): DailyPuzzle {
  return generateDailyPuzzleFor("en", seed, swaps);
}

// Scramble a fixed gold grid with a deterministic seed. Used for ?demo so
// the screen-recorded starting layout is consistent across runs.
export function scrambleGoldRows(goldRows: readonly string[], seed: number, swaps = 12): Tile[] {
  const rng = mulberry32(seed);
  const solved = tilesFromRows(goldRows as string[]);
  let startTiles = scramble(solved, rng, swaps);
  for (let attempt = 0; attempt < 50 && !everyRowHasHomeTile(startTiles); attempt++) {
    startTiles = scramble(solved, rng, swaps);
  }
  return startTiles;
}
