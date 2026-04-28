// Tier names by move count when a player solves Tessera. Edit ranges/names
// here to retune; `getTier` returns the highest tier whose `max` covers the
// given move count (Infinity catches the bottom tier).
export type Tier = { name: string; max: number };

export const TIERS: readonly Tier[] = [
  { name: "Legendary", max: 10 },
  { name: "Genius", max: 20 },
  { name: "Wordsmith", max: 35 },
  { name: "Persistent", max: 60 },
  { name: "Tenacious", max: Infinity },
];

export function getTier(moves: number): Tier {
  for (const t of TIERS) if (moves <= t.max) return t;
  return TIERS[TIERS.length - 1];
}
