import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildParityFixture, toColourBlindGrid } from "./mobile-parity";

// The committed cross-platform contract. Kept in the repo (not a Vitest
// snapshot) because the mobile build step copies this exact file into
// `mobile/test/fixtures/parity.json` and `flutter test` asserts against
// it too — see docs/flutter-app-spec.md §4.4 and §20.
const FIXTURE_PATH = fileURLToPath(
  new URL("./mobile-parity.fixture.json", import.meta.url)
);

const live = buildParityFixture();

// `npm run gen:parity` sets this to rewrite the committed fixture after
// an intentional change to puzzle / share / streak logic. Review the
// JSON diff before committing.
if (process.env.UPDATE_PARITY_FIXTURE) {
  writeFileSync(FIXTURE_PATH, JSON.stringify(live, null, 2) + "\n");
}

const committed = JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));

describe("mobile parity fixture", () => {
  it("web logic still matches the committed fixture", () => {
    // If this fails you changed puzzle generation, share formatting,
    // streak math, or puzzle-number arithmetic. Either revert, or run
    // `npm run gen:parity`, eyeball the diff, and update the Dart port
    // to match in the same change.
    expect(live).toEqual(committed);
  });
});

// The assertions below restate the intent behind the fixture so a
// regeneration that silently corrupts it still trips a named test.

describe("parity fixture — puzzle generation", () => {
  it("covers #1/#7/#30/#100/#365 × {en,es} × {classic,hard}", () => {
    expect(live.puzzles).toHaveLength(5 * 2 * 2);
  });

  it("every puzzle is internally consistent", () => {
    for (const p of live.puzzles) {
      const cells = p.n * p.n;
      expect(p.goldRows).toHaveLength(p.n);
      for (const row of p.goldRows) expect(row).toHaveLength(p.n);
      expect(p.startTiles).toHaveLength(cells);
      expect(p.startLetters).toHaveLength(cells);
      // tile ids are 0..cells-1 exactly once
      expect([...p.startTiles.map((t) => t.id)].sort((a, b) => a - b)).toEqual(
        [...Array(cells).keys()]
      );
      // startLetters is the row-major projection of startTiles
      expect(p.startTiles.map((t) => t.letter).join("")).toBe(p.startLetters);
      // the start position is a permutation of the gold letters
      // (goldRows are lowercase; tile letters are uppercased by tilesFromRows)
      expect([...p.startLetters.toLowerCase()].sort().join("")).toBe(
        [...p.goldRows.join("").toLowerCase()].sort().join("")
      );
      expect(p.minSwaps).toBeGreaterThan(0);
    }
  });

  it("en and es diverge for the same puzzle number and mode", () => {
    const en = live.puzzles.find((p) => p.num === 30 && p.mode === "classic" && p.locale === "en");
    const es = live.puzzles.find((p) => p.num === 30 && p.mode === "classic" && p.locale === "es");
    expect(en!.goldRows).not.toEqual(es!.goldRows);
  });
});

describe("parity fixture — puzzle numbers", () => {
  it("dateFromPuzzleNumber ∘ puzzleNumber round-trips off EPOCH", () => {
    for (const row of live.puzzleNumber) expect(row.roundTrips).toBe(true);
  });

  it("puzzle #1 is the epoch date", () => {
    const first = live.puzzleNumber.find((r) => r.num === 1);
    expect(first!.date).toBe(live.meta.epoch);
  });
});

describe("parity fixture — share slugs", () => {
  it("every slug round-trips through parseShareSlug", () => {
    for (const { input, parsed } of live.shareSlugs) {
      expect(parsed).toEqual({
        num: input.num,
        moves: input.revealed ? null : input.moves ?? 0,
        bonus: input.revealed ? false : input.bonus,
        revealed: input.revealed,
        mode: input.mode, // undefined for classic, "hard" for hard
      });
    }
  });

  it("hard slugs carry the h prefix", () => {
    for (const { input, slug } of live.shareSlugs) {
      expect(slug.startsWith("h")).toBe(input.mode === "hard");
    }
  });
});

describe("parity fixture — share grids", () => {
  it("default grid uses only the green / bonus / revealed tiles", () => {
    for (const { default: grid } of live.shareGrids) {
      expect(grid.replace(/[🟩🟧⬜\n]/gu, "")).toBe("");
    }
  });

  it("colour-blind grid swaps 🟩→🟦 and nothing else", () => {
    for (const { default: grid, colourBlind } of live.shareGrids) {
      expect(colourBlind).toBe(toColourBlindGrid(grid));
      expect(colourBlind.includes("🟩")).toBe(false);
      // 🟧 (bonus) and ⬜ (revealed) survive unchanged
      expect(colourBlind.replace(/[🟦🟧⬜\n]/gu, "")).toBe("");
    }
  });
});

describe("parity fixture — share payloads", () => {
  it("covers both locales for every case", () => {
    expect(live.sharePayloads).toHaveLength(8 * 2);
  });

  it("solved payloads carry a CTA; revealed payloads do not", () => {
    for (const { input, text } of live.sharePayloads) {
      const en = input.locale === "en";
      if (input.revealed && en) {
        expect(text).not.toMatch(/challenge|play|try/i);
      }
    }
  });

  it("url matches the slug and locale", () => {
    for (const { input, url } of live.sharePayloads) {
      const prefix = input.locale === "en" ? "" : `/${input.locale}`;
      const path = input.mode === "hard" ? "/hard/s" : "/s";
      expect(url.startsWith(`https://tesserapuzzle.com${prefix}${path}/`)).toBe(true);
    }
  });
});

describe("parity fixture — streaks", () => {
  it("matches computeStreak semantics", () => {
    const byNums = (nums: number[]) =>
      live.streaks.find((s) => JSON.stringify(s.nums) === JSON.stringify(nums))!;
    expect(byNums([]).result).toEqual({ current: 0, max: 0, lastWon: 0 });
    expect(byNums([5, 6, 7]).result).toEqual({ current: 3, max: 3, lastWon: 7 });
    expect(byNums([1, 2, 3, 4, 10]).result).toEqual({ current: 1, max: 4, lastWon: 10 });
    expect(byNums([1, 2, 3, 50]).result.max).toBe(7); // importedMax wins
  });
});
