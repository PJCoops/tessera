import { describe, expect, it } from "vitest";
import enDict from "../locales/en.json";
import { buildSharePayload, buildShareSlug, parseShareSlug } from "./share";
import type { Dictionary } from "./i18n";

const dict = enDict as Dictionary;

describe("buildShareSlug + parseShareSlug round-trip", () => {
  const cases = [
    { num: 8, moves: 12, bonus: false, revealed: false },
    { num: 8, moves: 12, bonus: true, revealed: false },
    { num: 8, moves: 0, bonus: false, revealed: false },
    { num: 1, moves: 99, bonus: true, revealed: false },
  ];
  it.each(cases)("preserves %o", (input) => {
    const slug = buildShareSlug(input);
    expect(parseShareSlug(slug)).toEqual(input);
  });

  it("revealed slug parses back as revealed (moves null)", () => {
    const slug = buildShareSlug({ num: 8, moves: 12, bonus: false, revealed: true });
    expect(slug).toBe("8-r");
    expect(parseShareSlug(slug)).toEqual({
      num: 8,
      moves: null,
      bonus: false,
      revealed: true,
    });
  });

  it("number-only slug parses with null moves", () => {
    expect(parseShareSlug("8")).toEqual({
      num: 8,
      moves: null,
      bonus: false,
      revealed: false,
    });
  });
});

describe("parseShareSlug rejects malformed input", () => {
  it.each(["", "abc", "8-x", "8--", "-8", "8-12-q", "8-r-b", "0-1"])(
    "%s -> null",
    (slug) => {
      expect(parseShareSlug(slug)).toBeNull();
    }
  );
});

describe("buildSharePayload", () => {
  it("returns text + url + full with the URL last", () => {
    const out = buildSharePayload({
      puzzleNumber: 8,
      moves: 12,
      streak: 3,
      bonus: false,
      revealed: false,
      locale: "en",
      dict,
    });
    expect(out.url).toBe("https://tesserapuzzle.com/s/8-12");
    expect(out.text).toContain("Tessera #8");
    expect(out.text).toContain("🟩"); // emoji grid
    expect(out.full).toBe(`${out.text}\n\n${out.url}`);
  });

  it("prefixes the URL with the locale segment for non-default locales", () => {
    const out = buildSharePayload({
      puzzleNumber: 8,
      moves: 12,
      streak: 0,
      bonus: false,
      revealed: false,
      locale: "es",
      dict,
    });
    expect(out.url).toBe("https://tesserapuzzle.com/es/s/8-12");
  });

  it("flips corner tiles to yellow on a bonus solve", () => {
    const out = buildSharePayload({
      puzzleNumber: 8,
      moves: 12,
      streak: 0,
      bonus: true,
      revealed: false,
      locale: "en",
      dict,
    });
    expect(out.text).toContain("🟨");
    expect(out.url).toBe("https://tesserapuzzle.com/s/8-12-b");
  });

  it("uses an empty grid on a reveal", () => {
    const out = buildSharePayload({
      puzzleNumber: 8,
      moves: 12,
      streak: 0,
      bonus: false,
      revealed: true,
      locale: "en",
      dict,
    });
    expect(out.text).not.toContain("🟩");
    expect(out.text).toContain("⬜");
    expect(out.url).toBe("https://tesserapuzzle.com/s/8-r");
  });
});
