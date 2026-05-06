// Time-window helpers. The "98 vs 116 today solved" inconsistency was
// rooted in different queries each picking their own interpretation of
// "today" — one used `WHERE toDate(timestamp) = today()` (PostHog
// session timezone), another bucketed by `toDate(timestamp)` (no
// explicit TZ), a third filtered by `now() - INTERVAL 1 DAY` (rolling
// 24h, not calendar today). All three names sounded like "today."
//
// Fix: every metric declares a `TimeWindowKey`. The window resolves to
// an explicit HogQL clause that uses UTC ('UTC' parameter to toDate
// and toStartOfDay) so the boundary is unambiguous. Metric authors pick
// from this fixed list and never write raw `WHERE timestamp >= ...`.
//
// Substitution: HogQL strings in metric definitions reference these
// windows via the `${WINDOW_<KEY>}` placeholder. The runtime swaps in
// the corresponding clause before execution.

export const TIME_WINDOW_KEYS = [
  "today", // calendar UTC day, 00:00 to 23:59:59
  "yesterday", // previous calendar UTC day
  "last24h", // rolling 24h ending now (NOT the same as today)
  "last7d", // rolling 7 days ending now
  "last30d", // rolling 30 days ending now
  "last90d", // rolling 90 days ending now
  "alltime", // no time bound
] as const;

export type TimeWindowKey = (typeof TIME_WINDOW_KEYS)[number];

// HogQL clause for each window, applied as part of the query's WHERE.
// Always returned as `AND <clause>` so it composes cleanly behind any
// other filter the metric's HogQL declares first.
export function windowClause(key: TimeWindowKey): string {
  switch (key) {
    case "today":
      return "AND toDate(timestamp, 'UTC') = toDate(now(), 'UTC')";
    case "yesterday":
      return "AND toDate(timestamp, 'UTC') = toDate(now() - INTERVAL 1 DAY, 'UTC')";
    case "last24h":
      return "AND timestamp >= now() - INTERVAL 1 DAY";
    case "last7d":
      return "AND timestamp >= now() - INTERVAL 7 DAY";
    case "last30d":
      return "AND timestamp >= now() - INTERVAL 30 DAY";
    case "last90d":
      return "AND timestamp >= now() - INTERVAL 90 DAY";
    case "alltime":
      return ""; // no time bound
  }
}

// Human label for use in metric descriptions and "all time · …" suffix
// renders. Kept short so it fits in a Hero card subtitle.
export function windowLabel(key: TimeWindowKey): string {
  switch (key) {
    case "today":
      return "today";
    case "yesterday":
      return "yesterday";
    case "last24h":
      return "last 24h";
    case "last7d":
      return "last 7 days";
    case "last30d":
      return "last 30 days";
    case "last90d":
      return "last 90 days";
    case "alltime":
      return "all time";
  }
}

// Substitute window AND exclude placeholders in a HogQL template.
// Templates use `${WINDOW}` and `${EXCLUDE}` as literal tokens (NOT JS
// interpolation — the strings are stored at rest in metric definitions
// and passed through this function at runtime).
//
// EXCLUDE comes from STATS_EXCLUDE_IDS env (comma-separated PostHog
// distinct_ids). It exists so your own test sessions don't pollute the
// dashboard. Same shape as the legacy `EXCLUDE` constant in the old
// stats/page.tsx — moved here so every metric inherits it identically.
export function applyWindow(hogql: string, key: TimeWindowKey): string {
  return hogql
    .replace(/\$\{WINDOW\}/g, windowClause(key))
    .replace(/\$\{EXCLUDE\}/g, excludeClause());
}

function excludeClause(): string {
  const raw = process.env.STATS_EXCLUDE_IDS;
  if (!raw) return "";
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    // HogQL strings are single-quoted; escape any embedded single quotes.
    .map((id) => `'${id.replace(/'/g, "''")}'`);
  if (ids.length === 0) return "";
  return ` AND distinct_id NOT IN (${ids.join(",")})`;
}
