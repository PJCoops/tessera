// Tier distribution. Drives the colour-banded bar that shows how
// today's (and last-30-day's) solves split across the five tiers.
// Mirrors `TIER_SQL` in `app/stats/_components.tsx` — keep in lockstep.
//
// Ratio-based bands: events fired after the analytics extension carry
// both `moves` and `minSwaps`, so we compute the ratio directly.
// Pre-extension events fall through to the old absolute thresholds
// since that's what graded them in-app at the time.

import type { MetricDef } from "../types";
import type { TimeWindowKey } from "../time-windows";

const TIER_SQL = `
  multiIf(
    toIntOrZero(toString(properties.minSwaps)) > 0,
      multiIf(
        toFloatOrZero(toString(properties.moves)) / toFloatOrZero(toString(properties.minSwaps)) <= 1.5, 'Legendary',
        toFloatOrZero(toString(properties.moves)) / toFloatOrZero(toString(properties.minSwaps)) <= 2.5, 'Genius',
        toFloatOrZero(toString(properties.moves)) / toFloatOrZero(toString(properties.minSwaps)) <= 4.5, 'Wordsmith',
        toFloatOrZero(toString(properties.moves)) / toFloatOrZero(toString(properties.minSwaps)) <= 7.0, 'Persistent',
        'Tenacious'
      ),
    multiIf(
      toIntOrZero(toString(properties.moves)) <= 10, 'Legendary',
      toIntOrZero(toString(properties.moves)) <= 20, 'Genius',
      toIntOrZero(toString(properties.moves)) <= 35, 'Wordsmith',
      toIntOrZero(toString(properties.moves)) <= 60, 'Persistent',
      'Tenacious'
    )
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
