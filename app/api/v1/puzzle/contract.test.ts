// Contract test: every GET /api/v1/puzzle 200 response must satisfy the
// frozen v1 schema (app/lib/api/v1-schema.ts). This gates schema drift on
// the web build before it can ship a client-breaking change to a shipped
// Flutter binary (docs/flutter-app-spec.md §20.1).

import { describe, expect, it } from "vitest";
import { puzzleQuerySchema, puzzleResponseSchema } from "../../../lib/api/v1-schema";
import { EPOCH } from "../../../lib/epoch";
import { dateFromPuzzleNumber, puzzleNumber, todayUtc } from "../../../lib/rng";
import { GET } from "./route";

const call = (params: Record<string, string>) =>
  GET(new Request(`https://tesserapuzzle.com/api/v1/puzzle?${new URLSearchParams(params)}`));

describe("GET /api/v1/puzzle — v1 schema contract", () => {
  // Past puzzles only — a future date is a 403 by design.
  const maxNum = puzzleNumber(todayUtc(), EPOCH) - 1;
  const dates = [1, 7, 30, 100, maxNum].map((n) => dateFromPuzzleNumber(n, EPOCH));

  it("every 200 response parses against puzzleResponseSchema", async () => {
    for (const date of dates) {
      for (const locale of ["en", "es"] as const) {
        for (const mode of ["classic", "hard"] as const) {
          const res = await call({ date, locale, mode });
          expect(res.status).toBe(200);
          const parsed = puzzleResponseSchema.safeParse(await res.json());
          if (!parsed.success) {
            throw new Error(`${date}/${locale}/${mode}: ${parsed.error.message}`);
          }
        }
      }
    }
  });

  it("startTiles length matches goldRows N*N", async () => {
    for (const mode of ["classic", "hard"] as const) {
      const body = await (await call({ date: dates[1], mode })).json();
      const n = body.goldRows.length;
      expect(body.startTiles).toHaveLength(n * n);
      expect(body.startLetters).toHaveLength(n * n);
    }
  });

  it("query schema applies the documented defaults", () => {
    const parsed = puzzleQuerySchema.parse({ date: "2026-05-03" });
    expect(parsed).toEqual({ date: "2026-05-03", locale: "en", mode: "classic" });
  });
});
