import { describe, expect, it } from "vitest";
import { tallyDaysWon } from "./leagues-store";

const row = (userId: string, handle: string, puzzleNumber: number, moves: number, timeMs: number | null) =>
  ({ userId, handle, mode: "classic", puzzleNumber, moves, timeMs });

describe("tallyDaysWon", () => {
  it("sole solver wins every day they appear", () => {
    const r = tallyDaysWon([row("u1", "alex", 1, 9, 100), row("u1", "alex", 2, 8, 50)]);
    expect(r).toEqual([{ userId: "u1", handle: "alex", daysWon: 2 }]);
  });

  it("fewer moves wins the day", () => {
    const r = tallyDaysWon([row("u1", "alex", 1, 8, 999), row("u2", "sam", 1, 9, 1)]);
    expect(r.find((x) => x.userId === "u1")!.daysWon).toBe(1);
    expect(r.find((x) => x.userId === "u2")!.daysWon).toBe(0);
  });

  it("time breaks a moves tie", () => {
    const r = tallyDaysWon([row("u1", "alex", 1, 9, 200), row("u2", "sam", 1, 9, 100)]);
    expect(r.find((x) => x.userId === "u2")!.daysWon).toBe(1);
    expect(r.find((x) => x.userId === "u1")!.daysWon).toBe(0);
  });

  it("exact tie (moves and time) credits both", () => {
    const r = tallyDaysWon([row("u1", "alex", 1, 9, 100), row("u2", "sam", 1, 9, 100)]);
    expect(r.find((x) => x.userId === "u1")!.daysWon).toBe(1);
    expect(r.find((x) => x.userId === "u2")!.daysWon).toBe(1);
  });

  it("accumulates across puzzles and includes zero-win members", () => {
    const r = tallyDaysWon([
      row("u1", "alex", 1, 8, 100),
      row("u2", "sam", 1, 9, 100),
      row("u2", "sam", 2, 7, 100),
      row("u1", "alex", 2, 9, 100),
    ]);
    expect(r.find((x) => x.userId === "u1")!.daysWon).toBe(1);
    expect(r.find((x) => x.userId === "u2")!.daysWon).toBe(1);
  });

  it("null time sorts last", () => {
    const r = tallyDaysWon([row("u1", "alex", 1, 9, null), row("u2", "sam", 1, 9, 5000)]);
    expect(r.find((x) => x.userId === "u2")!.daysWon).toBe(1);
    expect(r.find((x) => x.userId === "u1")!.daysWon).toBe(0);
  });
});
