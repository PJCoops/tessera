import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import path from "path";

const OG_SIZE = { width: 1200, height: 630 };
export const alt = "Tessera Puzzle, a daily word puzzle by Paul Cooper";
export const size = OG_SIZE;
export const contentType = "image/png" as const;

// 4×4 mark: a partially-solved-looking grid for the OG card.
// 0 = neutral (cream), 1 = sage (in valid row), 2 = rust (column bonus on sage).
const PATTERN: number[][] = [
  [1, 1, 1, 1],
  [1, 2, 1, 1],
  [0, 0, 1, 0],
  [1, 1, 0, 1],
];

const SAGE = "#7a9070";
const RUST = "#b85a1c";
const CREAM = "#f5f2e1";
const INK = "#0a0a0a";
const PAPER = "#fafaf7";
const ACCENT = "#e6007a";

export default async function Image() {
  const [frauncesLight, frauncesBold] = await Promise.all([
    readFile(path.join(process.cwd(), "app/_fonts/Fraunces-Light.ttf")),
    readFile(path.join(process.cwd(), "app/_fonts/Fraunces-Bold.ttf")),
  ]);

  const tileSize = 96;
  const tileGap = 12;

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
            fontSize: 20,
            letterSpacing: 5,
            textTransform: "uppercase",
            opacity: 0.65,
          }}
        >
          <span>Paul Cooper</span>
          <span>Daily word puzzle</span>
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 64,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                fontSize: 160,
                fontWeight: 300,
                letterSpacing: "-0.035em",
                lineHeight: 1,
              }}
            >
              <span>Tessera Puzzle™</span>
              <span style={{ color: ACCENT }}>.</span>
            </div>
            <div
              style={{
                fontFamily: "FrauncesSmall",
                fontSize: 24,
                opacity: 0.7,
                maxWidth: 520,
                lineHeight: 1.3,
              }}
            >
              A daily word puzzle. Swap tiles until every row is a word.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: tileGap,
            }}
          >
            {PATTERN.map((row, r) => (
              <div key={r} style={{ display: "flex", gap: tileGap }}>
                {row.map((cell, c) => {
                  const bg = cell === 2 ? RUST : cell === 1 ? SAGE : CREAM;
                  return (
                    <div
                      key={c}
                      style={{
                        width: tileSize,
                        height: tileSize,
                        background: bg,
                        borderRadius: 12,
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "FrauncesDisplay", data: frauncesLight, weight: 300, style: "normal" },
        { name: "FrauncesSmall", data: frauncesBold, weight: 700, style: "normal" },
      ],
    }
  );
}
