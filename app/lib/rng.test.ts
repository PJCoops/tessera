import { describe, expect, it } from "vitest";
import {
  dateFromPuzzleNumber,
  mulberry32,
  puzzleNumber,
  seedFromDate,
  shuffled,
} from "./rng";

describe("mulberry32", () => {
  it("yields the same sequence for the same seed", () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    for (let i = 0; i < 10; i++) expect(a()).toBe(b());
  });

  it("yields different sequences for different seeds", () => {
    const a = mulberry32(1)();
    const b = mulberry32(2)();
    expect(a).not.toBe(b);
  });

  it("returns numbers in [0, 1)", () => {
    const r = mulberry32(123);
    for (let i = 0; i < 1000; i++) {
      const n = r();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });
});

describe("shuffled", () => {
  it("is a permutation of the input", () => {
    const input = ["a", "b", "c", "d", "e"];
    const out = shuffled(input, mulberry32(99));
    expect(out.slice().sort()).toEqual(input.slice().sort());
  });

  it("does not mutate the input", () => {
    const input = ["a", "b", "c"];
    const snapshot = input.slice();
    shuffled(input, mulberry32(1));
    expect(input).toEqual(snapshot);
  });
});

describe("seedFromDate", () => {
  it("is deterministic", () => {
    expect(seedFromDate("2026-05-04")).toBe(seedFromDate("2026-05-04"));
  });

  it("yields different seeds for different dates", () => {
    expect(seedFromDate("2026-05-04")).not.toBe(seedFromDate("2026-05-05"));
  });

  it("returns a non-negative 32-bit integer", () => {
    const s = seedFromDate("2026-05-04");
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThan(2 ** 32);
    expect(Number.isInteger(s)).toBe(true);
  });
});

describe("puzzleNumber and dateFromPuzzleNumber", () => {
  const epoch = "2026-04-27";

  it("epoch is puzzle #1", () => {
    expect(puzzleNumber("2026-04-27", epoch)).toBe(1);
  });

  it("counts UTC days since epoch", () => {
    expect(puzzleNumber("2026-05-04", epoch)).toBe(8);
  });

  it("dateFromPuzzleNumber inverts puzzleNumber", () => {
    for (const num of [1, 8, 30, 100, 365]) {
      const date = dateFromPuzzleNumber(num, epoch);
      expect(puzzleNumber(date, epoch)).toBe(num);
    }
  });
});
