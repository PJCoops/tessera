// Visitor / engagement / solver counts. The three Hero numbers on the
// Overview page plus their windowed siblings.
//
// Important: the `visitors` definition counts anyone who fired EITHER
// $pageview OR puzzle_started. Ad-blocker filter lists pattern-match
// the literal "$pageview" event name in request payloads even through
// our /ingest proxy, so $pageview alone systematically under-counts
// the ad-blocker cohort. puzzle_started is custom and slips through.
// Logically every player is a visitor, so the union is the honest
// upper bound and engagement rate cannot exceed 100%.

import type { MetricDef } from "../types";
import type { TimeWindowKey } from "../time-windows";

function uniqueVisitors(window: TimeWindowKey): MetricDef<number> {
  return {
    key: `visitors.${window}`,
    label: `Visitors (${window})`,
    description:
      "Distinct PostHog IDs that fired $pageview OR puzzle_started in the window. Union avoids the ad-blocker undercount on $pageview alone.",
    window,
    format: "count",
    source: window === "alltime" ? "precomputed" : "live",
    hogql: `
      SELECT toInt(uniqIf(distinct_id, event IN ('$pageview', 'puzzle_started'))) AS n
      FROM events
      WHERE 1=1 \${WINDOW}\${EXCLUDE}
    `,
    parse: (rows) => Number((rows[0] as { n?: number })?.n ?? 0),
    fallback: 0,
  };
}

function uniquePlayers(window: TimeWindowKey): MetricDef<number> {
  return {
    key: `players.${window}`,
    label: `Engaged players (${window})`,
    description:
      "Distinct PostHog IDs that fired puzzle_started in the window. Players are a subset of visitors.",
    window,
    format: "count",
    source: window === "alltime" ? "precomputed" : "live",
    hogql: `
      SELECT toInt(uniqIf(distinct_id, event = 'puzzle_started')) AS n
      FROM events
      WHERE 1=1 \${WINDOW}\${EXCLUDE}
    `,
    parse: (rows) => Number((rows[0] as { n?: number })?.n ?? 0),
    fallback: 0,
  };
}

function uniqueSolvers(window: TimeWindowKey): MetricDef<number> {
  return {
    key: `solvers.${window}`,
    label: `Solvers (${window})`,
    description: "Distinct PostHog IDs that fired puzzle_solved at least once in the window.",
    window,
    format: "count",
    source: window === "alltime" ? "precomputed" : "live",
    hogql: `
      SELECT toInt(uniqIf(distinct_id, event = 'puzzle_solved')) AS n
      FROM events
      WHERE 1=1 \${WINDOW}\${EXCLUDE}
    `,
    parse: (rows) => Number((rows[0] as { n?: number })?.n ?? 0),
    fallback: 0,
  };
}

export const visitorsToday = uniqueVisitors("today");
export const visitorsLast7d = uniqueVisitors("last7d");
export const visitorsLast30d = uniqueVisitors("last30d");
export const visitorsAllTime = uniqueVisitors("alltime");

export const playersToday = uniquePlayers("today");
export const playersLast7d = uniquePlayers("last7d");
export const playersLast30d = uniquePlayers("last30d");
export const playersAllTime = uniquePlayers("alltime");

export const solversToday = uniqueSolvers("today");
export const solversLast7d = uniqueSolvers("last7d");
export const solversLast30d = uniqueSolvers("last30d");
export const solversAllTime = uniqueSolvers("alltime");
