// Tier keys by ratio of moves taken to the puzzle's exact min-swap
// count. Calibrated against ~290 production solves on the clean cohort
// (puzzles 10–12); see tasks/tier-rework-and-hint-tightening.md for
// the data and the reasoning behind 1.5 / 2.5 / 4.5 / 7.0.
//
// The same bands cover both 4×4 and 5×5 because the ratio normalises
// out grid size — Legendary on Hard means the same thing it does on
// Classic ("near-optimal play"). After ~30 days of 5×5 data we'll
// re-pull the distribution and decide whether mode-specific bands
// are warranted.
//
// `key` is locale-independent; locale display names live in each
// locale dictionary under `tiers.<key>`. Keep keys stable — share
// URLs implicitly depend on them via the headline copy.
export type TierKey = "legendary" | "genius" | "wordsmith" | "persistent" | "tenacious";
export type Tier = { key: TierKey; maxRatio: number };

export const TIERS: readonly Tier[] = [
  { key: "legendary", maxRatio: 1.5 },
  { key: "genius", maxRatio: 2.5 },
  { key: "wordsmith", maxRatio: 4.5 },
  { key: "persistent", maxRatio: 7.0 },
  { key: "tenacious", maxRatio: Infinity },
];

// Single source of truth for tier colors. Used by the history modal
// chart, the stats page, and any other tier swatch. Keep in sync
// with the game tile colors in TesseraGame.tsx (legendary should
// match the "correct" tile, genius should match the "valid row"
// tile).
export const TIER_COLORS: Record<TierKey, string> = {
  legendary: "#b85a1c",
  genius: "#7a9070",
  wordsmith: "#5b8aa8",
  persistent: "#6b7a8a",
  tenacious: "#7a6f8a",
};

// Tier from a player's solve. `minSwaps` is the puzzle's exact
// optimum (computed by puzzle.ts); `moves` is what the player
// actually used. Edge case: minSwaps === 0 means the start position
// was already solved (should never happen in production thanks to
// startIsLegal) — bucket as Legendary so the UI doesn't divide by
// zero.
export function getTier(moves: number, minSwaps: number): Tier {
  if (minSwaps <= 0) return TIERS[0];
  const ratio = moves / minSwaps;
  for (const t of TIERS) if (ratio <= t.maxRatio) return t;
  return TIERS[TIERS.length - 1];
}
