// Tier keys by move count when a player solves Tessera. Edit ranges/keys
// here to retune; `getTier` returns the highest tier whose `max` covers the
// given move count (Infinity catches the bottom tier).
//
// `key` is locale-independent and is used to look up the display name in
// each locale's dictionary (tiers.<key>) and the share emoji in share.ts.
// Keep it stable — share URLs depend on it implicitly via the headline copy.
export type TierKey = "legendary" | "genius" | "wordsmith" | "persistent" | "tenacious";
export type Tier = { key: TierKey; max: number };

export const TIERS: readonly Tier[] = [
  { key: "legendary", max: 10 },
  { key: "genius", max: 20 },
  { key: "wordsmith", max: 35 },
  { key: "persistent", max: 60 },
  { key: "tenacious", max: Infinity },
];

export function getTier(moves: number): Tier {
  for (const t of TIERS) if (moves <= t.max) return t;
  return TIERS[TIERS.length - 1];
}
