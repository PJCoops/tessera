import { describe, expect, it } from "vitest";
import { computeStreak, mergeStreaks } from "./streak-compute";

describe("computeStreak", () => {
  it("returns zeros for no wins", () => {
    expect(computeStreak([])).toEqual({ current: 0, max: 0, lastWon: 0 });
  });

  it("keeps importedMax with no wins", () => {
    expect(computeStreak([], 9)).toEqual({ current: 0, max: 9, lastWon: 0 });
  });

  it("single win", () => {
    expect(computeStreak([7])).toEqual({ current: 1, max: 1, lastWon: 7 });
  });

  it("consecutive run", () => {
    expect(computeStreak([5, 6, 7])).toEqual({ current: 3, max: 3, lastWon: 7 });
  });

  it("current is the run ending at the latest win", () => {
    expect(computeStreak([1, 2, 5, 6, 7])).toEqual({ current: 3, max: 3, lastWon: 7 });
  });

  it("an older longer run sets max but not current", () => {
    expect(computeStreak([1, 2, 3, 4, 10])).toEqual({ current: 1, max: 4, lastWon: 10 });
  });

  it("tolerates duplicates and unsorted input", () => {
    expect(computeStreak([4, 3, 3, 5])).toEqual({ current: 3, max: 3, lastWon: 5 });
  });

  it("importedMax wins when larger than any derivable run", () => {
    expect(computeStreak([5, 6], 12)).toEqual({ current: 2, max: 12, lastWon: 6 });
  });
});

describe("mergeStreaks", () => {
  it("fresher lastWon decides current", () => {
    const local = { current: 4, max: 8, lastWon: 40 };
    const server = { current: 2, max: 5, lastWon: 38 };
    expect(mergeStreaks(local, server)).toEqual({ current: 4, max: 8, lastWon: 40 });
  });

  it("server side wins when fresher, maxima combine", () => {
    const local = { current: 1, max: 20, lastWon: 35 };
    const server = { current: 6, max: 6, lastWon: 41 };
    expect(mergeStreaks(local, server)).toEqual({ current: 6, max: 20, lastWon: 41 });
  });

  it("equal lastWon prefers the first argument", () => {
    const local = { current: 3, max: 3, lastWon: 40 };
    const server = { current: 2, max: 7, lastWon: 40 };
    expect(mergeStreaks(local, server)).toEqual({ current: 3, max: 7, lastWon: 40 });
  });
});
