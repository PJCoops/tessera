// Central registry of every dashboard metric. Pages and the precompute
// cron both walk this list — pages to render, the cron to refresh.
//
// Adding a new metric is three steps:
//   1. Define a `MetricDef` in the relevant `definitions/<area>.ts`
//   2. Re-export it here, in the same alphabetical-ish ordering
//   3. Decide `source: 'precomputed'` (and let the cron pick it up) or
//      `source: 'live'` (60s cache, no cron impact)
//
// The dashboard NEVER inlines HogQL. If you find yourself wanting to,
// add a metric definition first.

import type { MetricDef } from "./types";

import {
  visitorsToday,
  visitorsLast7d,
  visitorsLast30d,
  visitorsAllTime,
  playersToday,
  playersLast7d,
  playersLast30d,
  playersAllTime,
  solversToday,
  solversLast7d,
  solversLast30d,
  solversAllTime,
} from "./definitions/visitors";

import {
  startedToday,
  startedLast7d,
  startedAllTime,
  solvedToday,
  solvedLast7d,
  solvedAllTime,
  revealedToday,
  revealedAllTime,
  todayPuzzleDetail,
  dailyLast14d,
  allTimeTotals,
} from "./definitions/puzzles";

import { tiersToday, tiersLast30d } from "./definitions/tiers";

import { socialReferralsLast7d, socialHourlyLast7d } from "./definitions/social";

// Every metric, indexed by key. Use `METRICS["visitors.today"]` to get
// a definition. The cron iterates `Object.values(METRICS)` to know
// what to refresh.
export const METRICS: Record<string, MetricDef<unknown>> = {
  [visitorsToday.key]: visitorsToday,
  [visitorsLast7d.key]: visitorsLast7d,
  [visitorsLast30d.key]: visitorsLast30d,
  [visitorsAllTime.key]: visitorsAllTime,

  [playersToday.key]: playersToday,
  [playersLast7d.key]: playersLast7d,
  [playersLast30d.key]: playersLast30d,
  [playersAllTime.key]: playersAllTime,

  [solversToday.key]: solversToday,
  [solversLast7d.key]: solversLast7d,
  [solversLast30d.key]: solversLast30d,
  [solversAllTime.key]: solversAllTime,

  [startedToday.key]: startedToday,
  [startedLast7d.key]: startedLast7d,
  [startedAllTime.key]: startedAllTime,

  [solvedToday.key]: solvedToday,
  [solvedLast7d.key]: solvedLast7d,
  [solvedAllTime.key]: solvedAllTime,

  [revealedToday.key]: revealedToday,
  [revealedAllTime.key]: revealedAllTime,

  [todayPuzzleDetail.key]: todayPuzzleDetail,
  [dailyLast14d.key]: dailyLast14d,
  [allTimeTotals.key]: allTimeTotals,

  [tiersToday.key]: tiersToday,
  [tiersLast30d.key]: tiersLast30d,

  [socialReferralsLast7d.key]: socialReferralsLast7d,
  [socialHourlyLast7d.key]: socialHourlyLast7d,
};

export type MetricKey = keyof typeof METRICS;

// Sub-groups for the cron to walk only the precomputed metrics, plus
// grouping by page so partial precompute failures can be retried.
export function precomputedMetrics(): MetricDef<unknown>[] {
  return Object.values(METRICS).filter((m) => m.source === "precomputed");
}

export function liveMetrics(): MetricDef<unknown>[] {
  return Object.values(METRICS).filter((m) => m.source === "live");
}

export { getMetric, precomputeMetric, readManifest, writeManifest } from "./runtime";
export type { MetricResult } from "./types";
