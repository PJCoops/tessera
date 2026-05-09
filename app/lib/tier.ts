// Tier keys by move count when a player solves Tessera. Edit ranges/keys
// here to retune; `getTier` returns the highest tier whose `max` covers the
// given move count (Infinity catches the bottom tier).
//
// `key` is locale-independent and is used to look up the display name in
// each locale's dictionary (tiers.<key>) and the share emoji in share.ts.
// Keep it stable — share URLs depend on it implicitly via the headline copy.
export type TierKey = "legendary" | "genius" | "wordsmith" | "persistent" | "tenacious";
export type Tier = { key: TierKey; max: number };

// 4×4 thresholds. 8 words across 16 tiles.
export const TIERS: readonly Tier[] = [
  { key: "legendary", max: 10 },
  { key: "genius", max: 20 },
  { key: "wordsmith", max: 35 },
  { key: "persistent", max: 60 },
  { key: "tenacious", max: Infinity },
];

// 5×5 thresholds. 10 words across 25 tiles. Roughly 1.4× the 4×4 budget,
// scaled with the larger search space; tune after playtesting.
export const TIERS_HARD: readonly Tier[] = [
  { key: "legendary", max: 14 },
  { key: "genius", max: 28 },
  { key: "wordsmith", max: 50 },
  { key: "persistent", max: 85 },
  { key: "tenacious", max: Infinity },
];

// Single source of truth for tier colors. Used by the history modal chart,
// the stats page, and any other tier swatch. Keep in sync with the game
// tile colors in TesseraGame.tsx (legendary should match the "correct"
// tile, genius should match the "valid row" tile).
export const TIER_COLORS: Record<TierKey, string> = {
  legendary: "#b85a1c",
  genius: "#7a9070",
  wordsmith: "#5b8aa8",
  persistent: "#6b7a8a",
  tenacious: "#7a6f8a",
};

export function getTier(moves: number, tiers: readonly Tier[] = TIERS): Tier {
  for (const t of tiers) if (moves <= t.max) return t;
  return tiers[tiers.length - 1];
}
