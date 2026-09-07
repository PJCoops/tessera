// Phase 0 acceptance tests for GET /api/v1/puzzle
// (docs/flutter-app-spec.md §20.2, tasks/server-side-puzzle-generation.md).
//
// Written before the route exists. They stay SKIPPED until
// `app/api/v1/puzzle/route.ts` lands, then activate and must pass — no
// edits to this file required to switch them on.
//
// Proposed contract (Phase 0 finalises names / param style):
//   GET /api/v1/puzzle?date=YYYY-MM-DD&locale=en|es&mode=classic|hard
//   200  -> { num, goldRows: string[N], startLetters: string,
//             startTiles: {id,letter}[N*N], minSwaps: number }
//   400  malformed / missing date
//   403  date in the future (UTC)
//   404  date before EPOCH
//   headers: Cache-Control with s-maxage (edge-cached 24h), stable ETag
//   canonical: for a past date the payload equals generateDailyPuzzleFor(
//     locale, seedFromDate(date), mode.swaps, mode.N) — i.e. the same
//     values the mobile parity fixture pins.

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { EPOCH } from "../../../lib/epoch";
import { modeById } from "../../../lib/mode";
import { generateDailyPuzzleFor } from "../../../lib/puzzle";
import { dateFromPuzzleNumber, puzzleNumber, seedFromDate } from "../../../lib/rng";

const ROUTE_PATH = fileURLToPath(new URL("./route.ts", import.meta.url));
const routeExists = existsSync(ROUTE_PATH);

type Handler = (req: Request) => Promise<Response> | Response;
let GET: Handler;

beforeAll(async () => {
  // @ts-expect-error ./route.ts is created in Phase 0; remove this directive then.
  if (routeExists) ({ GET } = (await import("./route")) as { GET: Handler });
});

async function call(params: Record<string, string>): Promise<Response> {
  const qs = new URLSearchParams(params).toString();
  return GET(new Request(`https://tesserapuzzle.com/api/v1/puzzle?${qs}`));
}

const pastDate = dateFromPuzzleNumber(7, EPOCH); // #7, safely in the past
const futureDate = "2099-01-01";
const preEpochDate = "2020-01-01";

describe.skipIf(!routeExists)("GET /api/v1/puzzle", () => {
  it("returns 200 for a past date with a well-formed body", async () => {
    const res = await call({ date: pastDate, locale: "en", mode: "classic" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.num).toBe(puzzleNumber(pastDate, EPOCH));
    expect(body.goldRows).toHaveLength(4);
    for (const row of body.goldRows) expect(row).toHaveLength(4);
    expect(body.startLetters).toHaveLength(16);
    expect(body.startTiles).toHaveLength(16);
    expect([...body.startTiles.map((t: { id: number }) => t.id)].sort((a: number, b: number) => a - b))
      .toEqual([...Array(16).keys()]);
    expect(body.minSwaps).toBeGreaterThan(0);
  });

  it("payload for a past date is byte-identical to the local generator (canonical)", async () => {
    for (const locale of ["en", "es"] as const) {
      for (const modeId of ["classic", "hard"] as const) {
        const mode = modeById(modeId);
        const res = await call({ date: pastDate, locale, mode: modeId });
        const body = await res.json();
        const gen = generateDailyPuzzleFor(locale, seedFromDate(pastDate), mode.swaps, mode.N);
        expect(body.goldRows).toEqual(gen.goldRows);
        expect(body.startLetters).toBe(gen.startTiles.map((t) => t.letter).join(""));
        expect(body.startTiles).toEqual(gen.startTiles.map((t) => ({ id: t.id, letter: t.letter })));
        expect(body.minSwaps).toBe(gen.minSwaps);
      }
    }
  });

  it("es differs from en for the same date + mode", async () => {
    const [en, es] = await Promise.all([
      call({ date: pastDate, locale: "en", mode: "classic" }).then((r: Response) => r.json()),
      call({ date: pastDate, locale: "es", mode: "classic" }).then((r: Response) => r.json()),
    ]);
    expect(en.goldRows).not.toEqual(es.goldRows);
  });

  it("rejects a future date with 403", async () => {
    const res = await call({ date: futureDate, locale: "en", mode: "classic" });
    expect(res.status).toBe(403);
  });

  it("rejects a pre-epoch date with 404", async () => {
    const res = await call({ date: preEpochDate, locale: "en", mode: "classic" });
    expect(res.status).toBe(404);
  });

  it("rejects a malformed date with 400", async () => {
    for (const date of ["", "2026-13-40", "not-a-date", "26-01-01"]) {
      const res = await call({ date, locale: "en", mode: "classic" });
      expect(res.status).toBe(400);
    }
  });

  it("defaults locale to en and mode to classic when omitted", async () => {
    const res = await call({ date: pastDate });
    expect(res.status).toBe(200);
    const body = await res.json();
    const gen = generateDailyPuzzleFor("en", seedFromDate(pastDate), 12, 4);
    expect(body.goldRows).toEqual(gen.goldRows);
  });

  it("is edge-cacheable: Cache-Control with s-maxage and a stable ETag", async () => {
    const a = await call({ date: pastDate, locale: "en", mode: "classic" });
    const b = await call({ date: pastDate, locale: "en", mode: "classic" });
    expect(a.headers.get("cache-control") ?? "").toMatch(/s-maxage=\d+/);
    const etag = a.headers.get("etag");
    if (etag) expect(b.headers.get("etag")).toBe(etag);
  });
});

// Guard so the suite still reports something meaningful before Phase 0.
describe("GET /api/v1/puzzle (pending)", () => {
  it.skipIf(routeExists)("route not implemented yet — Phase 0", () => {
    expect(routeExists).toBe(false);
  });
});
