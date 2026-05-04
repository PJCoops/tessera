import { describe, expect, it } from "vitest";
import {
  generateDailyPuzzle,
  generateDailyPuzzleFor,
  scramble,
  tilesFromRows,
  type Tile,
} from "./puzzle";
import { mulberry32, seedFromDate } from "./rng";
import type { Locale } from "./i18n";

const N = 4;

function startRowsOf(tiles: Tile[]): string[] {
  const rows: string[] = [];
  for (let r = 0; r < N; r++) {
    let s = "";
    for (let c = 0; c < N; c++) s += tiles[r * N + c].letter;
    rows.push(s);
  }
  return rows;
}

function startColsOf(tiles: Tile[]): string[] {
  const cols: string[] = [];
  for (let c = 0; c < N; c++) {
    let s = "";
    for (let r = 0; r < N; r++) s += tiles[r * N + c].letter;
    cols.push(s);
  }
  return cols;
}

describe("tilesFromRows", () => {
  it("emits 16 tiles with sequential ids and uppercase letters", () => {
    const tiles = tilesFromRows(["abcd", "efgh", "ijkl", "mnop"]);
    expect(tiles).toHaveLength(16);
    expect(tiles.map((t) => t.id)).toEqual([...Array(16).keys()]);
    expect(tiles.map((t) => t.letter).join("")).toBe("ABCDEFGHIJKLMNOP");
  });
});

describe("scramble", () => {
  it("preserves the tile multiset", () => {
    const start = tilesFromRows(["abcd", "efgh", "ijkl", "mnop"]);
    const scrambled = scramble(start, mulberry32(1), 12);
    expect(scrambled.map((t) => t.id).sort((a, b) => a - b)).toEqual(
      [...Array(16).keys()]
    );
  });

  it("is deterministic for a given seed", () => {
    const start = tilesFromRows(["abcd", "efgh", "ijkl", "mnop"]);
    const a = scramble(start, mulberry32(42), 12).map((t) => t.id);
    const b = scramble(start, mulberry32(42), 12).map((t) => t.id);
    expect(a).toEqual(b);
  });
});

describe("generateDailyPuzzleFor", () => {
  it("is deterministic per locale + seed", () => {
    const a = generateDailyPuzzleFor("en", 12345);
    const b = generateDailyPuzzleFor("en", 12345);
    expect(a.goldRows).toEqual(b.goldRows);
    expect(a.startTiles.map((t) => t.id)).toEqual(b.startTiles.map((t) => t.id));
  });

  it("produces 4 four-letter rows in the expected alphabet", () => {
    for (const locale of ["en", "es"] as const satisfies readonly Locale[]) {
      const { goldRows } = generateDailyPuzzleFor(locale, 99);
      expect(goldRows).toHaveLength(N);
      for (const row of goldRows) {
        expect(row).toMatch(/^[a-z]{4}$/);
      }
    }
  });

  it("generateDailyPuzzle matches generateDailyPuzzleFor('en')", () => {
    const seed = seedFromDate("2026-05-04");
    const a = generateDailyPuzzle(seed);
    const b = generateDailyPuzzleFor("en", seed);
    expect(a.goldRows).toEqual(b.goldRows);
    expect(a.startTiles.map((t) => t.id)).toEqual(b.startTiles.map((t) => t.id));
  });
});

describe("daily start position is legal", () => {
  // Regression for the bug where 12-swap scrambles occasionally landed on a
  // fully-correct row or column, handing the player a freebie at first paint.
  // Scan a year of seeded days per locale.
  const epochMs = Date.UTC(2026, 3, 27); // Tessera #1
  const dates: string[] = [];
  for (let i = 0; i < 365; i++) {
    dates.push(new Date(epochMs + i * 86400000).toISOString().slice(0, 10));
  }

  it.each(["en", "es"] as const satisfies readonly Locale[])(
    "no row or column is fully solved at start across 365 days (%s)",
    (locale) => {
      const offences: string[] = [];
      for (const date of dates) {
        const { goldRows, startTiles } = generateDailyPuzzleFor(
          locale,
          seedFromDate(date)
        );
        const goldUpper = goldRows.map((r) => r.toUpperCase());
        const startRows = startRowsOf(startTiles);
        const startCols = startColsOf(startTiles);
        for (let r = 0; r < N; r++) {
          if (startRows[r] === goldUpper[r]) {
            offences.push(`${date} row ${r}: ${startRows[r]}`);
          }
        }
        for (let c = 0; c < N; c++) {
          let goldCol = "";
          for (let r = 0; r < N; r++) goldCol += goldUpper[r][c];
          if (startCols[c] === goldCol) {
            offences.push(`${date} col ${c}: ${startCols[c]}`);
          }
        }
      }
      expect(offences).toEqual([]);
    }
  );

  it.each(["en", "es"] as const satisfies readonly Locale[])(
    "every row has at least one home tile across 365 days (%s)",
    (locale) => {
      const offences: string[] = [];
      for (const date of dates) {
        const { startTiles } = generateDailyPuzzleFor(
          locale,
          seedFromDate(date)
        );
        for (let r = 0; r < N; r++) {
          let any = false;
          for (let c = 0; c < N; c++) {
            if (Math.floor(startTiles[r * N + c].id / N) === r) {
              any = true;
              break;
            }
          }
          if (!any) offences.push(`${date} row ${r}`);
        }
      }
      expect(offences).toEqual([]);
    }
  );
});
