// Tier distribution. Drives the colour-banded bar that shows how
// today's (and last-30-day's) solves split across the five tiers.
// Tier thresholds duplicate `app/lib/tier.ts`; change them here in
// lockstep.

import type { MetricDef } from "../types";
import type { TimeWindowKey } from "../time-windows";

const TIER_SQL = `
  multiIf(
    toInt(toString(properties.moves)) <= 10, 'Legendary',
    toInt(toString(properties.moves)) <= 20, 'Genius',
    toInt(toString(properties.moves)) <= 35, 'Wordsmith',
    toInt(toString(properties.moves)) <= 60, 'Persistent',
    'Tenacious'
  )
`;

export type TierRow = { tier: string; solves: number };

function tierDistribution(window: TimeWindowKey): MetricDef<TierRow[]> {
  return {
    key: `tiers.${window}`,
    label: `Tier distribution (${window})`,
    description:
      "Solve count per tier (Legendary, Genius, Wordsmith, Persistent, Tenacious) bucketed by the number of moves on each puzzle_solved event.",
    window,
    format: "raw",
    source: window === "today" ? "live" : "precomputed",
    hogql: `
      SELECT ${TIER_SQL} AS tier, toInt(count()) AS solves
      FROM events
      WHERE event = 'puzzle_solved' \${WINDOW}\${EXCLUDE}
      GROUP BY tier
    `,
    parse: (rows) =>
      (rows as TierRow[]).map((r) => ({
        tier: String(r.tier ?? ""),
        solves: Number(r.solves ?? 0),
      })),
    fallback: [],
  };
}

export const tiersToday = tierDistribution("today");
export const tiersLast30d = tierDistribution("last30d");
