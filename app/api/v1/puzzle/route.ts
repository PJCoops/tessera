// GET /api/v1/puzzle?date=YYYY-MM-DD&locale=en|es&mode=classic|hard
//
// The canonical daily puzzle. Both the web client and the Flutter app fetch
// it here; neither computes the puzzle or ships the wordlists
// (docs/flutter-app-spec.md §4.3, decision 2). Generation is deterministic
// in (locale, seedFromDate(date), mode.swaps, mode.N), so the response is
// safe to edge-cache for a day.
//
//   200  { num, goldRows: string[N], startLetters: string,
//          startTiles: {id,letter}[N*N], minSwaps: number }
//   400  missing / malformed date
//   403  date in the future (UTC) — unless ALLOW_FUTURE_PUZZLES is set (non-prod QA)
//   404  date before EPOCH
//
// No env required.

import { EPOCH } from "../../../lib/epoch";
import { isLocale } from "../../../lib/i18n";
import { modeById, type ModeId } from "../../../lib/mode";
import { generateDailyPuzzleFor } from "../../../lib/server/puzzle-engine";
import { puzzleNumber, seedFromDate, todayUtc } from "../../../lib/rng";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Regex-valid AND a real calendar day (rejects 2026-13-40 etc.), mirroring
// resolvePuzzleFromParams in app/lib/replay.ts.
function isRealDate(raw: string): boolean {
  if (!DATE_RE.test(raw)) return false;
  const [y, m, d] = raw.split("-").map(Number);
  const ms = Date.UTC(y, m - 1, d);
  if (Number.isNaN(ms)) return false;
  const round = new Date(ms);
  return (
    round.getUTCFullYear() === y &&
    round.getUTCMonth() === m - 1 &&
    round.getUTCDate() === d
  );
}

function weakETag(body: string): string {
  let h = 5381;
  for (let i = 0; i < body.length; i++) h = (h * 33) ^ body.charCodeAt(i);
  return `W/"${(h >>> 0).toString(36)}"`;
}

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);

  const date = searchParams.get("date") ?? "";
  if (!isRealDate(date)) {
    return Response.json({ error: "bad_date" }, { status: 400 });
  }

  const num = puzzleNumber(date, EPOCH);
  if (num < 1) {
    return Response.json({ error: "before_epoch" }, { status: 404 });
  }

  const allowFuture = process.env.ALLOW_FUTURE_PUZZLES === "1";
  if (date > todayUtc() && !allowFuture) {
    return Response.json({ error: "future_date" }, { status: 403 });
  }

  const localeParam = searchParams.get("locale");
  const locale = isLocale(localeParam) ? localeParam : "en";
  const modeParam = searchParams.get("mode");
  const mode = modeById((modeParam === "hard" ? "hard" : "classic") as ModeId);

  const g = generateDailyPuzzleFor(locale, seedFromDate(date), mode.swaps, mode.N);
  const payload = {
    num,
    goldRows: g.goldRows,
    startLetters: g.startTiles.map((t) => t.letter).join(""),
    startTiles: g.startTiles.map((t) => ({ id: t.id, letter: t.letter })),
    minSwaps: g.minSwaps,
  };

  const bodyText = JSON.stringify(payload);
  const etag = weakETag(bodyText);

  if (req.headers.get("if-none-match") === etag) {
    return new Response(null, {
      status: 304,
      headers: { ETag: etag, "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600" },
    });
  }

  return new Response(bodyText, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600",
      ETag: etag,
    },
  });
}
