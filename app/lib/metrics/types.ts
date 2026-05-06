// Metrics dictionary types. Every dashboard metric is a `MetricDef` so
// labels, queries, and time windows live in one place. Pages consume
// values via `<Metric metric="visitors.today" />`-style components and
// never write inline HogQL — that's the proximate fix for the 98/116
// "today solved" inconsistency, which was caused by ad-hoc queries each
// picking their own interpretation of "today."
//
// A metric resolves through `app/lib/metrics/runtime.ts`, which decides
// based on `source` whether to read a precomputed Redis blob or run the
// HogQL live (with a 60s cache wrapper to prevent fan-out under load).

import type { TimeWindowKey } from "./time-windows";

export type MetricFormat = "count" | "percent" | "duration" | "raw";

export type MetricSource =
  | "live" // execute HogQL on demand, wrapped in 60s unstable_cache
  | "precomputed"; // read from Redis blob written by the morning cron

export type MetricDef<T = unknown> = {
  // Dotted path key used everywhere a metric is referenced. e.g.
  // "visitors.today", "puzzles.today.solved", "cohorts.weekly".
  key: string;

  // Human-facing label rendered above the value. Pages never invent
  // their own labels for a given metric — they always use this.
  label: string;

  // One-sentence explanation surfaced in tooltips / documentation.
  // Worth being precise about time scope and event filter so future-you
  // can audit definitions without re-reading SQL.
  description: string;

  // Time scope. The window is resolved into concrete UTC bounds at
  // query time, not when the dictionary is loaded — daily metrics need
  // a fresh "today" each request.
  window: TimeWindowKey;

  // How to format the resolved value for display. The runtime returns
  // raw numbers; pages use this hint to pick a formatter.
  format: MetricFormat;

  // Where the value comes from. "live" goes through HogQL with caching;
  // "precomputed" reads from Redis. Picking precomputed for a metric
  // means the daily cron MUST execute its HogQL or the value goes stale.
  source: MetricSource;

  // The HogQL string. Time-window placeholders (${WINDOW_*}) are
  // substituted by the runtime, so this stays declarative.
  hogql: string;

  // Convert the raw HogQL row(s) into the typed value the page uses.
  // Most metrics return a single number, but `format: 'raw'` lets a
  // metric expose structured data (e.g. a 14-day daily array).
  parse: (rows: unknown[]) => T;

  // Fallback value when Redis is empty or HogQL fails. Used to keep
  // the dashboard rendering rather than blowing up on missing data.
  fallback: T;
};

// Result of resolving a metric for rendering. Carries metadata so the
// UI can show "from precomputed cache · refreshed 09:30 UTC" or
// equivalent without each page tracking that itself.
export type MetricResult<T = unknown> = {
  value: T;
  source: MetricSource;
  // ISO timestamp when the value was last refreshed. For live, this is
  // the current request time (or the cache hit time). For precomputed,
  // this is the cron's run timestamp.
  refreshedAt: string;
  // True when we returned the fallback because the real value was
  // missing or the query errored. Pages can show a muted "—" instead
  // of a misleading zero.
  stale: boolean;
};
