import wordList4 from "./words.json";
import solutionList4 from "./solution-words.json";
import wordListEs4 from "./words-es.json";
import solutionListEs4 from "./solution-words-es.json";
import wordList5 from "./words-5.json";
import solutionList5 from "./solution-words-5.json";
import wordListEs5 from "./words-es-5.json";
import solutionListEs5 from "./solution-words-es-5.json";
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

// A scramble is legal as a starting position iff every row has at least
// one tile from its home row (so the player has a foothold in each row),
// AND no row or column is already fully equal to its gold solution. The
// latter matters because random scrambles occasionally land on a fully
// correct row or column — handing the player a freebie that can also
// flash green/gold on first paint, which feels like a bug.
function startIsLegal(p: Tile[], goldRows: string[], N: number): boolean {
  for (let r = 0; r < N; r++) {
    let any = false;
    for (let c = 0; c < N; c++) {
      if (Math.floor(p[r * N + c].id / N) === r) { any = true; break; }
    }
    if (!any) return false;
  }
  const goldUpper = goldRows.map((r) => r.toUpperCase());
  for (let r = 0; r < N; r++) {
    let row = "";
    for (let c = 0; c < N; c++) row += p[r * N + c].letter;
    if (row === goldUpper[r]) return false;
  }
  for (let c = 0; c < N; c++) {
    let col = "";
    let goldCol = "";
    for (let r = 0; r < N; r++) {
      col += p[r * N + c].letter;
      goldCol += goldUpper[r][c];
    }
    if (col === goldCol) return false;
  }
  return true;
}

export type DailyPuzzle = {
  goldRows: string[];
  startTiles: Tile[];
  swaps: number;
  // Exact (or heuristic-fallback) minimum number of swaps to take
  // startTiles to goldRows. Drives the ratio-based tier system: a
  // player's tier is moves / minSwaps, not absolute moves.
  minSwaps: number;
};

// Minimum number of swaps to transform `positions` into `goldRows`.
// With duplicate letters the choice of which-tile-goes-where is free,
// so we maximise cycles in the resulting permutation (min swaps =
// cells − max_cycles). Brute-forced over per-letter assignments;
// combinatorics are bounded for real word grids (~20k for 4×4,
// up to ~10M for 5×5 pathological cases). If the search space
// exceeds COMBO_CAP we fall back to a greedy heuristic that's
// monotonic but can overestimate by a small constant.
const COMBO_CAP = 50_000_000;

export function computeMinSwaps(positions: Tile[], goldRows: string[]): number {
  const N = goldRows.length;
  const cells = N * N;
  const goldUpper = goldRows.join("").toUpperCase();

  const targetsByLetter = new Map<string, number[]>();
  const sourcesByLetter = new Map<string, number[]>();
  for (let i = 0; i < cells; i++) {
    const t = goldUpper[i];
    let ts = targetsByLetter.get(t);
    if (!ts) { ts = []; targetsByLetter.set(t, ts); }
    ts.push(i);

    const s = positions[i].letter;
    let ss = sourcesByLetter.get(s);
    if (!ss) { ss = []; sourcesByLetter.set(s, ss); }
    ss.push(i);
  }

  // Multiset sanity. Should always hold for a valid scramble of the
  // gold grid, but bail fast if not — caller passed mismatched inputs.
  for (const [ch, sources] of sourcesByLetter) {
    if ((targetsByLetter.get(ch)?.length ?? 0) !== sources.length) {
      throw new Error(`computeMinSwaps: letter mismatch for "${ch}"`);
    }
  }

  let combos = 1;
  for (const sources of sourcesByLetter.values()) {
    combos *= factorial(sources.length);
    if (combos > COMBO_CAP) return greedyMinSwaps(positions, goldUpper, cells);
  }

  const letters = Array.from(sourcesByLetter.keys());
  const perm = new Array<number>(cells);
  let maxCycles = 0;

  function permuteLetter(letterIdx: number, targets: number[], start: number, sources: number[]) {
    if (start === targets.length) {
      for (let i = 0; i < sources.length; i++) perm[sources[i]] = targets[i];
      tryLetter(letterIdx + 1);
      return;
    }
    for (let i = start; i < targets.length; i++) {
      [targets[start], targets[i]] = [targets[i], targets[start]];
      permuteLetter(letterIdx, targets, start + 1, sources);
      [targets[start], targets[i]] = [targets[i], targets[start]];
    }
  }

  function tryLetter(letterIdx: number) {
    if (letterIdx === letters.length) {
      const c = countCycles(perm, cells);
      if (c > maxCycles) maxCycles = c;
      return;
    }
    const ch = letters[letterIdx];
    const sources = sourcesByLetter.get(ch)!;
    const targets = targetsByLetter.get(ch)!.slice();
    permuteLetter(letterIdx, targets, 0, sources);
  }

  tryLetter(0);
  return cells - maxCycles;
}

function countCycles(perm: number[], n: number): number {
  const visited = new Array<boolean>(n).fill(false);
  let cycles = 0;
  for (let i = 0; i < n; i++) {
    if (visited[i]) continue;
    cycles++;
    let j = i;
    while (!visited[j]) {
      visited[j] = true;
      j = perm[j];
    }
  }
  return cycles;
}

function factorial(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

// Greedy fallback: skip already-correct cells; for each remaining
// cell, prefer pairing with a destination that points back (forms a
// 2-cycle) before falling back to any cell with the matching letter.
// Counts swaps performed. For realistic puzzles this is exact or
// off by a small constant; only used when the exact search exceeds
// COMBO_CAP, which doesn't happen on real generated grids.
function greedyMinSwaps(positions: Tile[], goldUpper: string, cells: number): number {
  const cur = positions.map((p) => p.letter);
  const target = goldUpper.split("");
  let swaps = 0;
  for (let i = 0; i < cells; i++) {
    if (cur[i] === target[i]) continue;
    let pickedJ = -1;
    for (let j = i + 1; j < cells; j++) {
      if (cur[j] === target[i] && target[j] === cur[i]) { pickedJ = j; break; }
    }
    if (pickedJ === -1) {
      for (let j = i + 1; j < cells; j++) {
        if (cur[j] === target[i]) { pickedJ = j; break; }
      }
    }
    if (pickedJ === -1) break;
    [cur[i], cur[pickedJ]] = [cur[pickedJ], cur[i]];
    swaps++;
  }
  return swaps;
}

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

function isSupportedSize(n: number): n is SupportedSize {
  return (SUPPORTED_SIZES as readonly number[]).includes(n);
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

// Scramble a fixed gold grid with a deterministic seed. Used for ?demo so
// the screen-recorded starting layout is consistent across runs.
export function scrambleGoldRows(goldRows: readonly string[], seed: number, swaps = 12): Tile[] {
  const rng = mulberry32(seed);
  const N = goldRows.length;
  const solved = tilesFromRows(goldRows as string[]);
  let startTiles = scramble(solved, rng, swaps);
  for (let attempt = 0; attempt < 50 && !startIsLegal(startTiles, goldRows as string[], N); attempt++) {
    startTiles = scramble(solved, rng, swaps);
  }
  return startTiles;
}
