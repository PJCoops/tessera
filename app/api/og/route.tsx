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
import { CLASSIC, HARD } from "../../lib/mode";
import { generateDailyPuzzleFor } from "../../lib/puzzle";
import { dateFromPuzzleNumber, puzzleNumber, seedFromDate } from "../../lib/rng";
import { EPOCH } from "../../lib/epoch";

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

// Tier emoji mirror app/lib/share.ts so the OG card and the share-text
// headline use the same visual language.
const TIER_EMOJI: Record<string, string> = {
  legendary: "🏆",
  genius: "🧠",
  wordsmith: "📖",
  persistent: "🧩",
  tenacious: "💪",
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const n = parseInt(searchParams.get("n") ?? "", 10);
  const mRaw = searchParams.get("m");
  const m = mRaw !== null ? parseInt(mRaw, 10) : null;
  const bonus = searchParams.get("b") === "1";
  const revealed = searchParams.get("r") === "1";
  const mode = searchParams.get("mode") === "hard" ? HARD : CLASSIC;

  // Reject malformed input early so unfurlers get a clear failure rather
  // than a partially-filled card. Cap to a small lookahead past today so
  // an attacker can't burn render+font-load cycles on arbitrary puzzle
  // numbers (each unique (n, m, b, r, mode) is a fresh cache miss).
  const todayUtc = new Date().toISOString().slice(0, 10);
  const maxN = puzzleNumber(todayUtc, EPOCH) + 7;
  if (!Number.isFinite(n) || n <= 0 || n > maxN) {
    return new Response("Bad request: n required", { status: 400 });
  }

  const [frauncesLight, frauncesBold] = await Promise.all([
    readFile(path.join(process.cwd(), "app/_fonts/Fraunces-Light.ttf")),
    readFile(path.join(process.cwd(), "app/_fonts/Fraunces-Bold.ttf")),
  ]);

  // 5×5 needs slightly smaller tiles to keep the OG card balanced.
  const tileSize = mode.N === 5 ? 58 : 70;
  const tileGap = 8;

  // Pick the grid pattern based on outcome:
  //   solved (no bonus) → all sage
  //   solved (bonus)    → sage with rust corners (mirrors share-text grid)
  //   revealed          → cream (empty)
  const pattern = buildPattern({ revealed, bonus, N: mode.N });

  // Recompute the puzzle's minSwaps so the tier band matches what the
  // player saw when they solved. Cheap on a per-OG basis; Next caches
  // the response.
  let tierKey: string | null = null;
  if (m !== null) {
    try {
      const date = dateFromPuzzleNumber(n, EPOCH);
      const { minSwaps } = generateDailyPuzzleFor("en", seedFromDate(date), mode.swaps, mode.N);
      tierKey = getTier(m, minSwaps).key;
    } catch {
      tierKey = null;
    }
  }
  const tierName = tierKey ? t(ogDict, `tiers.${tierKey}`) : null;
  const tierEmoji = tierKey ? TIER_EMOJI[tierKey] ?? "" : "";

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
        {/* Top: brand kicker + puzzle number */}
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
          <span>{mode.id === "hard" ? "Tessera Puzzle™ · Hard" : "Tessera Puzzle™"}</span>
          <span>#{n} · daily word puzzle</span>
        </div>

        {/* Middle: result hero on the left, grid on the right */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 64,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {revealed ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  fontSize: 168,
                  fontWeight: 300,
                  letterSpacing: "-0.035em",
                  lineHeight: 1,
                }}
              >
                <span>Revealed</span>
                <span style={{ color: ACCENT }}>.</span>
              </div>
            ) : m !== null ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 24,
                  width: 640,
                }}
              >
                {/* Number + label baseline-aligned */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    gap: 18,
                    lineHeight: 0.85,
                  }}
                >
                  <span
                    style={{
                      fontSize: 240,
                      fontWeight: 300,
                      letterSpacing: "-0.04em",
                      color: RUST,
                    }}
                  >
                    {m}
                  </span>
                  <span
                    style={{
                      fontSize: 56,
                      fontWeight: 300,
                      opacity: 0.85,
                      paddingBottom: 18,
                    }}
                  >
                    {m === 1 ? "swap" : "swaps"}
                  </span>
                </div>
                {/* Tier line, stacked underneath the number */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 18,
                    fontSize: 56,
                    fontWeight: 300,
                    letterSpacing: "-0.02em",
                  }}
                >
                  <span style={{ fontSize: 64 }}>{tierEmoji}</span>
                  <span>{tierName}</span>
                  {bonus && (
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        fontFamily: "FrauncesSmall",
                        fontSize: 22,
                        letterSpacing: 3,
                        textTransform: "uppercase",
                        marginLeft: 8,
                        padding: "8px 16px",
                        borderRadius: 999,
                        background: RUST,
                        color: PAPER,
                      }}
                    >
                      ✨ Bonus
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  fontSize: 168,
                  fontWeight: 300,
                  letterSpacing: "-0.035em",
                  lineHeight: 1,
                }}
              >
                <span>Play today</span>
                <span style={{ color: ACCENT }}>.</span>
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: tileGap,
              flexShrink: 0,
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
                        borderRadius: 10,
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom: domain footer */}
        <div
          style={{
            fontFamily: "FrauncesSmall",
            fontSize: 22,
            letterSpacing: 4,
            textTransform: "uppercase",
            opacity: 0.55,
          }}
        >
          tesserapuzzle.com
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
  N,
}: {
  revealed: boolean;
  bonus: boolean;
  N: number;
}): number[][] {
  if (revealed) {
    return Array.from({ length: N }, () => Array.from({ length: N }, () => 0));
  }
  if (!bonus) {
    return Array.from({ length: N }, () => Array.from({ length: N }, () => 1));
  }
  const last = N - 1;
  return Array.from({ length: N }, (_, r) =>
    Array.from({ length: N }, (_, c) => {
      const corner = (r === 0 || r === last) && (c === 0 || c === last);
      return corner ? 2 : 1;
    })
  );
}
