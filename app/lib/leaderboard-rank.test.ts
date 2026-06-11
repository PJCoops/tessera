import { describe, expect, it } from "vitest";
import { compareEntries } from "./leaderboard-store";

describe("compareEntries (board ranking)", () => {
  it("fewer moves wins regardless of time", () => {
    expect(compareEntries({ moves: 8, timeMs: 99999 }, { moves: 9, timeMs: 1 })).toBeLessThan(0);
  });

  it("equal moves: faster time wins", () => {
    expect(compareEntries({ moves: 9, timeMs: 1000 }, { moves: 9, timeMs: 2000 })).toBeLessThan(0);
  });

  it("null time sorts last", () => {
    expect(compareEntries({ moves: 9, timeMs: null }, { moves: 9, timeMs: 50000 })).toBeGreaterThan(0);
  });

  it("two null times tie", () => {
    expect(compareEntries({ moves: 9, timeMs: null }, { moves: 9, timeMs: null })).toBe(0);
  });

  it("sorts a list moves-then-time, nulls last", () => {
    const rows = [
      { moves: 9, timeMs: null },
      { moves: 8, timeMs: 200 },
      { moves: 9, timeMs: 100 },
      { moves: 8, timeMs: 100 },
    ];
    const sorted = [...rows].sort(compareEntries);
    expect(sorted).toEqual([
      { moves: 8, timeMs: 100 },
      { moves: 8, timeMs: 200 },
      { moves: 9, timeMs: 100 },
      { moves: 9, timeMs: null },
    ]);
  });
});
