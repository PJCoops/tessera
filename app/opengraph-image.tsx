import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import path from "path";
import { generateDailyPuzzleFor } from "./lib/puzzle";
import { puzzleNumber, seedFromDate, todayUtc } from "./lib/rng";
import { EPOCH } from "./lib/epoch";
import { CLASSIC } from "./lib/mode";

const OG_SIZE = { width: 1200, height: 630 };
export const alt = "Tessera Puzzle, a daily word puzzle by Paul Cooper";
export const size = OG_SIZE;
export const contentType = "image/png" as const;

// Regenerate hourly so the card reflects today's puzzle after the daily
// 00:00 UTC rollover. Cheap on edge cache; daily X/Reddit/Facebook posts
// fire at 08:00 UTC, well after this refreshes.
export const revalidate = 3600;

const SAGE = "#7a9070";
const RUST = "#b85a1c";
const CREAM = "#f5f2e1";
const INK = "#0a0a0a";
const PAPER = "#fafaf7";
const ACCENT = "#e6007a";

export default async function Image() {
  const [frauncesLight, frauncesBold, interSemibold] = await Promise.all([
    readFile(path.join(process.cwd(), "app/_fonts/Fraunces-Light.ttf")),
    readFile(path.join(process.cwd(), "app/_fonts/Fraunces-Bold.ttf")),
    readFile(path.join(process.cwd(), "app/_fonts/Inter-SemiBold.ttf")),
  ]);

  const today = todayUtc();
  const num = puzzleNumber(today, EPOCH);
  const { startTiles } = generateDailyPuzzleFor(
    "en",
    seedFromDate(today),
    CLASSIC.swaps,
    CLASSIC.N,
  );
  const N = CLASSIC.N;
  const grid: string[][] = Array.from({ length: N }, (_, r) =>
    Array.from({ length: N }, (_, c) => startTiles[r * N + c]?.letter ?? ""),
  );

  const tileSize = 88;
  const tileGap = 10;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: INK,
          color: PAPER,
          display: "flex",
          flexDirection: "column",
          padding: 72,
          fontFamily: "FrauncesDisplay",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontFamily: "FrauncesSmall",
            fontSize: 22,
            letterSpacing: 4,
            textTransform: "uppercase",
            opacity: 0.7,
          }}
        >
          <span>Tessera Puzzle™</span>
          <span>#{num} · {today}</span>
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 64,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 20, width: 560 }}>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                fontSize: 144,
                fontWeight: 300,
                letterSpacing: "-0.035em",
                lineHeight: 1,
              }}
            >
              <span>Play today</span>
              <span style={{ color: ACCENT }}>.</span>
            </div>
            <div
              style={{
                fontFamily: "FrauncesSmall",
                fontSize: 24,
                opacity: 0.7,
                lineHeight: 1.3,
              }}
            >
              Swap tiles until every row spells a word.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: tileGap,
              flexShrink: 0,
            }}
          >
            {grid.map((row, r) => (
              <div key={r} style={{ display: "flex", gap: tileGap }}>
                {row.map((letter, c) => (
                  <div
                    key={c}
                    style={{
                      width: tileSize,
                      height: tileSize,
                      background: CREAM,
                      color: INK,
                      borderRadius: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      // Matches the in-game tile typography: clean geometric
                      // sans, semibold weight, optical centering.
                      fontFamily: "InterTile",
                      fontSize: 48,
                      fontWeight: 600,
                    }}
                  >
                    {letter}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontFamily: "FrauncesSmall",
            fontSize: 22,
            letterSpacing: 4,
            textTransform: "uppercase",
            opacity: 0.55,
          }}
        >
          <span>tesserapuzzle.com</span>
          {/* Sage/rust swatches as a visual signature, mirroring the in-game legend. */}
          <span style={{ display: "flex", gap: 10 }}>
            <span style={{ width: 18, height: 18, background: SAGE, borderRadius: 4 }} />
            <span style={{ width: 18, height: 18, background: RUST, borderRadius: 4 }} />
          </span>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "FrauncesDisplay", data: frauncesLight, weight: 300, style: "normal" },
        { name: "FrauncesSmall", data: frauncesBold, weight: 700, style: "normal" },
        { name: "InterTile", data: interSemibold, weight: 600, style: "normal" },
      ],
    },
  );
}
