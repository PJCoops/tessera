import { describe, expect, it } from "vitest";
import { computeMinSwaps, generateDailyPuzzleFor, scramble, tilesFromRows, type Tile } from "./puzzle";
import { mulberry32, seedFromDate } from "./rng";

// Hand-built scrambles whose optimal solve is known by inspection.
// "Optimal" means smallest number of pairwise swaps that produce the
// target. Verified by enumeration / manual cycle counting.
function swapPositions(tiles: Tile[], a: number, b: number): Tile[] {
  const next = tiles.slice();
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

describe("computeMinSwaps — 4×4 hand-built cases", () => {
  const goldRows = ["abcd", "efgh", "ijkl", "mnop"];
  const solved = tilesFromRows(goldRows);

  it("already-solved is 0", () => {
    expect(computeMinSwaps(solved, goldRows)).toBe(0);
  });

  it("single swap is 1", () => {
    const start = swapPositions(solved, 0, 5); // A <-> F
    expect(computeMinSwaps(start, goldRows)).toBe(1);
  });

  it("two disjoint swaps is 2", () => {
    const start = swapPositions(swapPositions(solved, 0, 5), 10, 15); // (A,F) + (K,P)
    expect(computeMinSwaps(start, goldRows)).toBe(2);
  });

  it("3-cycle takes 2 swaps", () => {
    // A→cell5, F→cell10, K→cell0  (cycle A→F→K→A)
    const start = solved.slice();
    const a = start[0], f = start[5], k = start[10];
    start[0] = k; start[5] = a; start[10] = f;
    expect(computeMinSwaps(start, goldRows)).toBe(2);
  });

  it("full reversal of all 16 cells takes 8 swaps", () => {
    // Every cell paired with its mirror — 8 disjoint 2-cycles.
    const start = solved.slice().reverse();
    expect(computeMinSwaps(start, goldRows)).toBe(8);
  });
});

describe("computeMinSwaps — duplicate letters", () => {
  // Duplicate letters give the solver freedom: two cells with the
  // same letter can swap roles for free if it improves cycle count.
  it("duplicate-letter pair already correct without specific tile match", () => {
    // Both rows have AB, so swapping the AB tiles within the same
    // column should cost 0.
    const goldRows = ["abxy", "abxy", "wxyz", "wxyz"];
    const solved = tilesFromRows(goldRows);
    // Swap A in row 0 with A in row 1 — letters still match target
    const start = swapPositions(solved, 0, 4);
    expect(computeMinSwaps(start, goldRows)).toBe(0);
  });

  it("five A's in a 5×5 with one displacement", () => {
    const goldRows = ["aaaab", "ccccd", "eeeef", "gggghh".slice(0,5), "iiiij"];
    const solved = tilesFromRows(goldRows);
    // Swap the B at cell 4 with the C at cell 5 (different letters).
    const start = swapPositions(solved, 4, 5);
    expect(computeMinSwaps(start, goldRows)).toBe(1);
  });
});

describe("computeMinSwaps — 5×5", () => {
  const goldRows5 = ["champ", "humor", "amino", "monks", "prose"];
  const solved5 = tilesFromRows(goldRows5);

  it("already-solved is 0", () => {
    expect(computeMinSwaps(solved5, goldRows5)).toBe(0);
  });

  it("single swap is 1", () => {
    // Swap C (cell 0) with the H at the start of row 1 (cell 5).
    const start = swapPositions(solved5, 0, 5);
    expect(computeMinSwaps(start, goldRows5)).toBe(1);
  });
});

describe("computeMinSwaps — generated puzzles", () => {
  // Sanity: real generated puzzles always have minSwaps in [1, swaps],
  // since the scrambler does N swaps and minSwaps ≤ N. Floor of 1
  // because startIsLegal rejects fully-correct starts.
  it.each(["2026-04-27", "2026-05-09", "2026-06-01"])(
    "4×4 puzzle for %s has minSwaps in [1, 12]",
    (date) => {
      const seed = seedFromDate(date);
      const { startTiles, goldRows, minSwaps } = generateDailyPuzzleFor("en", seed);
      expect(minSwaps).toBe(computeMinSwaps(startTiles, goldRows));
      expect(minSwaps).toBeGreaterThanOrEqual(1);
      expect(minSwaps).toBeLessThanOrEqual(12);
    }
  );

  it.each(["2026-04-27", "2026-05-09", "2026-06-01"])(
    "5×5 puzzle for %s has minSwaps in [1, 18]",
    (date) => {
      const seed = seedFromDate(date);
      const { startTiles, goldRows, minSwaps } = generateDailyPuzzleFor("en", seed, 18, 5);
      expect(minSwaps).toBe(computeMinSwaps(startTiles, goldRows));
      expect(minSwaps).toBeGreaterThanOrEqual(1);
      expect(minSwaps).toBeLessThanOrEqual(18);
    },
    // 5×5 gold-grid search can take a few seconds on the harder seeds
    // after the curated word list got smaller. Default 5s is too tight.
    20000
  );

  it("scramble of K random swaps is solvable in ≤ K swaps", () => {
    // Property: doing K swaps from solved cannot make it harder than
    // K to undo. minSwaps ≤ K always.
    const goldRows = ["abcd", "efgh", "ijkl", "mnop"];
    const solved = tilesFromRows(goldRows);
    for (let trial = 0; trial < 20; trial++) {
      const k = 1 + Math.floor(Math.random() * 12);
      const rng = mulberry32(trial * 9973);
      const scrambled = scramble(solved, rng, k);
      expect(computeMinSwaps(scrambled, goldRows)).toBeLessThanOrEqual(k);
    }
  });
});
