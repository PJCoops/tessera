import { describe, expect, it } from "vitest";
import { resolvePuzzleFromParams } from "./replay";

const epoch = "2026-04-27";
const today = "2026-05-05";

function resolve(qs: string) {
  return resolvePuzzleFromParams(new URLSearchParams(qs), today, epoch);
}

describe("resolvePuzzleFromParams", () => {
  it("returns today when no day param is present", () => {
    expect(resolve("")).toEqual({ date: today, num: 9, replay: false });
  });

  it("returns today when day param is empty", () => {
    expect(resolve("day=")).toEqual({ date: today, num: 9, replay: false });
  });

  it("opens a past date in replay mode", () => {
    expect(resolve("day=2026-05-01")).toEqual({
      date: "2026-05-01",
      num: 5,
      replay: true,
    });
  });

  it("opens puzzle #1 in replay", () => {
    expect(resolve("day=2026-04-27")).toEqual({
      date: "2026-04-27",
      num: 1,
      replay: true,
    });
  });

  it("falls back to today when day is today", () => {
    expect(resolve(`day=${today}`)).toEqual({ date: today, num: 9, replay: false });
  });

  it("falls back to today when day is in the future", () => {
    expect(resolve("day=2027-01-01")).toEqual({ date: today, num: 9, replay: false });
  });

  it.each([
    "day=tomorrow",
    "day=2026-5-1",
    "day=2026-05-1",
    "day=26-05-01",
    "day=2026-13-40",
    "day=2026-02-30",
    "day=not-a-date",
  ])("falls back to today on malformed input (%s)", (qs) => {
    expect(resolve(qs)).toEqual({ date: today, num: 9, replay: false });
  });

  it("falls back to today for dates before the epoch", () => {
    expect(resolve("day=2020-01-01")).toEqual({
      date: today,
      num: 9,
      replay: false,
    });
  });
});
