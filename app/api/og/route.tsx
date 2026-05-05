// Dynamic per-solve Open Graph image. Rendered on demand when a shared
// link is unfurled by an iMessage / WhatsApp / Twitter / Discord client.
//
// Inputs (query string):
//   n  Puzzle number (required, integer)
//   m  Move count (optional integer; omit for revealed)
//   b  Bonus flag ("1" if columns also spelled)
//   r  Revealed flag ("1" if the player gave up)
//
// The page at "/" reads the same params via the `s` shorthand and points
// its <meta property="og:image"> at this route, so the image always
// matches the share text the player generated.

import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import path from "path";
import { getTier } from "../../lib/tier";
import { getDictionary, t } from "../../lib/i18n";

// OG cards are shared cross-locale and have no locale signal in the
// share URL, so they always render in English. If we add locale to the
// share slug later, this can become per-locale.
const ogDict = getDictionary("en");

const OG_SIZE = { width: 1200, height: 630 };

const SAGE = "#7a9070";
const RUST = "#b85a1c";
const CREAM = "#f5f2e1";
const INK = "#0a0a0a";
const PAPER = "#fafaf7";
const ACCENT = "#e6007a";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const n = parseInt(searchParams.get("n") ?? "", 10);
  const mRaw = searchParams.get("m");
  const m = mRaw !== null ? parseInt(mRaw, 10) : null;
  const bonus = searchParams.get("b") === "1";
  const revealed = searchParams.get("r") === "1";

  // Reject malformed input early so unfurlers get a clear failure rather
  // than a partially-filled card.
  if (!Number.isFinite(n) || n <= 0) {
    return new Response("Bad request: n required", { status: 400 });
  }

  const [frauncesLight, frauncesBold] = await Promise.all([
    readFile(path.join(process.cwd(), "app/_fonts/Fraunces-Light.ttf")),
    readFile(path.join(process.cwd(), "app/_fonts/Fraunces-Bold.ttf")),
  ]);

  const tileSize = 88;
  const tileGap = 10;

  // Pick the grid pattern based on outcome:
  //   solved (no bonus) → all sage
  //   solved (bonus)    → sage with gold corners (mirrors share-text grid)
  //   revealed          → cream (empty)
  const pattern = buildPattern({ revealed, bonus });

  const subhead = revealed
    ? "revealed"
    : m !== null
    ? `${m} ${m === 1 ? "swap" : "swaps"} · ${t(ogDict, `tiers.${getTier(m).key}`)}${bonus ? " · ✨ bonus" : ""}`
    : "today's puzzle";

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
          <span>tesserapuzzle.com</span>
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
                fontSize: 144,
                fontWeight: 300,
                letterSpacing: "-0.035em",
                lineHeight: 1,
              }}
            >
              <span>Tessera #{n}</span>
              <span style={{ color: ACCENT }}>.</span>
            </div>
            <div
              style={{
                fontFamily: "FrauncesSmall",
                fontSize: 28,
                opacity: 0.75,
                maxWidth: 560,
                lineHeight: 1.25,
              }}
            >
              {subhead}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: tileGap,
            }}
          >
            {pattern.map((row, r) => (
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

function buildPattern({
  revealed,
  bonus,
}: {
  revealed: boolean;
  bonus: boolean;
}): number[][] {
  if (revealed) {
    return Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => 0));
  }
  if (!bonus) {
    return Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => 1));
  }
  return Array.from({ length: 4 }, (_, r) =>
    Array.from({ length: 4 }, (_, c) => {
      const corner = (r === 0 || r === 3) && (c === 0 || c === 3);
      return corner ? 2 : 1;
    })
  );
}
