import demoGridJson from "./demo-grid.json";
import { mulberry32 } from "./rng";

// Puzzle generation itself (wordlists + grid search) lives in the
// server-only module ./server/puzzle-engine. This file holds only the
// pure, wordlist-free pieces that both clients and the server need:
// the Tile model, scramble/legality helpers, and min-swap counting.

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
export function startIsLegal(p: Tile[], goldRows: string[], N: number): boolean {
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
