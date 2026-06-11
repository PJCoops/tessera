import { describe, expect, it } from "vitest";
import { generateDailyPuzzleFor, type Tile } from "./puzzle";
import { seedFromDate } from "./rng";
import {
  isSwapHistory,
  validateReplay,
  MAX_REPLAY_MOVES,
  type SwapPair,
} from "./replay-validate";

function lettersOf(tiles: Tile[]): string {
  return tiles.map((t) => t.letter).join("");
}

// Builds a valid solve: for each cell left to right, swap in a matching
// letter from later in the grid. Terminates because start and gold are
// letter multiset equals.
function greedySolve(startLetters: string, goldRows: string[]): SwapPair[] {
  const target = goldRows.join("").toUpperCase();
  const grid = startLetters.toUpperCase().split("");
  const history: SwapPair[] = [];
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] === target[i]) continue;
    const j = grid.findIndex((ch, k) => k > i && ch === target[i]);
    if (j === -1) throw new Error(`no source for cell ${i}`);
    [grid[i], grid[j]] = [grid[j], grid[i]];
    history.push([i, j]);
  }
  return history;
}

const CASES = [
  { locale: "en" as const, N: 4, swaps: 12, date: "2026-05-01" },
  { locale: "en" as const, N: 5, swaps: 18, date: "2026-05-01" },
  { locale: "es" as const, N: 4, swaps: 12, date: "2026-05-02" },
  { locale: "es" as const, N: 5, swaps: 18, date: "2026-05-02" },
];

describe("validateReplay", () => {
  it.each(CASES)("accepts a real solve ($locale N=$N)", ({ locale, N, swaps, date }) => {
    const puzzle = generateDailyPuzzleFor(locale, seedFromDate(date), swaps, N);
    const start = lettersOf(puzzle.startTiles);
    const history = greedySolve(start, puzzle.goldRows);
    const verdict = validateReplay(start, puzzle.goldRows, history);
    expect(verdict).toEqual({ ok: true, moves: history.length, bonus: true });
  });

  it("counts redundant swaps but still validates", () => {
    const puzzle = generateDailyPuzzleFor("en", seedFromDate("2026-05-03"), 12, 4);
    const start = lettersOf(puzzle.startTiles);
    const history: SwapPair[] = [[0, 1], [0, 1], ...greedySolve(start, puzzle.goldRows)];
    const verdict = validateReplay(start, puzzle.goldRows, history);
    expect(verdict).toEqual({ ok: true, moves: history.length, bonus: true });
  });

  it("rejects an incomplete solve as not_solved", () => {
    const puzzle = generateDailyPuzzleFor("en", seedFromDate("2026-05-01"), 12, 4);
    const start = lettersOf(puzzle.startTiles);
    const history = greedySolve(start, puzzle.goldRows);
    const verdict = validateReplay(start, puzzle.goldRows, history.slice(0, -1));
    expect(verdict).toEqual({ ok: false, reason: "not_solved" });
  });

  it("rejects an empty history on an unsolved start", () => {
    const puzzle = generateDailyPuzzleFor("en", seedFromDate("2026-05-01"), 12, 4);
    const verdict = validateReplay(lettersOf(puzzle.startTiles), puzzle.goldRows, []);
    expect(verdict).toEqual({ ok: false, reason: "not_solved" });
  });

  it.each([
    [[[0, 0]] as SwapPair[], "self swap"],
    [[[0, 16]] as SwapPair[], "out of range high"],
    [[[-1, 2]] as SwapPair[], "negative index"],
    [[[0.5, 2]] as SwapPair[], "non-integer"],
  ])("rejects %j (%s) as bad_history", (history) => {
    const puzzle = generateDailyPuzzleFor("en", seedFromDate("2026-05-01"), 12, 4);
    const verdict = validateReplay(lettersOf(puzzle.startTiles), puzzle.goldRows, history);
    expect(verdict).toEqual({ ok: false, reason: "bad_history" });
  });

  it("rejects a start grid of the wrong size as bad_history", () => {
    const puzzle = generateDailyPuzzleFor("en", seedFromDate("2026-05-01"), 12, 4);
    const verdict = validateReplay("ABC", puzzle.goldRows, []);
    expect(verdict).toEqual({ ok: false, reason: "bad_history" });
  });

  it("rejects oversized histories as too_many_moves", () => {
    const puzzle = generateDailyPuzzleFor("en", seedFromDate("2026-05-01"), 12, 4);
    const history: SwapPair[] = Array.from({ length: MAX_REPLAY_MOVES + 1 }, () => [0, 1]);
    const verdict = validateReplay(lettersOf(puzzle.startTiles), puzzle.goldRows, history);
    expect(verdict).toEqual({ ok: false, reason: "too_many_moves" });
  });
});

describe("isSwapHistory", () => {
  it("accepts an empty array and integer pairs", () => {
    expect(isSwapHistory([])).toBe(true);
    expect(isSwapHistory([[0, 1], [15, 3]])).toBe(true);
  });

  it.each([
    [null],
    ["nope"],
    [[[0]]],
    [[[0, 1, 2]]],
    [[["a", 1]]],
    [[[0.5, 1]]],
    [{ length: 1 }],
  ])("rejects %j", (v) => {
    expect(isSwapHistory(v)).toBe(false);
  });
});
