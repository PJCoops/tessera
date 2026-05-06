// Per-puzzle activity: counts of started / solved / revealed events,
// plus today's-puzzle drilldown (fastest, average moves, bonus rate).
// "Today started" / "Today solved" Big cards on the Overview consume
// these exclusively — no more split definitions across the page.

import type { MetricDef } from "../types";
import type { TimeWindowKey } from "../time-windows";

function startedCount(window: TimeWindowKey): MetricDef<number> {
  return {
    key: `puzzles.started.${window}`,
    label: `Puzzles started (${window})`,
    description: "Count of puzzle_started events in the window.",
    window,
    format: "count",
    source: window === "alltime" ? "precomputed" : "live",
    hogql: `
      SELECT toInt(countIf(event = 'puzzle_started')) AS n
      FROM events
      WHERE 1=1 \${WINDOW}\${EXCLUDE}
    `,
    parse: (rows) => Number((rows[0] as { n?: number })?.n ?? 0),
    fallback: 0,
  };
}

function solvedCount(window: TimeWindowKey): MetricDef<number> {
  return {
    key: `puzzles.solved.${window}`,
    label: `Puzzles solved (${window})`,
    description: "Count of puzzle_solved events in the window.",
    window,
    format: "count",
    source: window === "alltime" ? "precomputed" : "live",
    hogql: `
      SELECT toInt(countIf(event = 'puzzle_solved')) AS n
      FROM events
      WHERE 1=1 \${WINDOW}\${EXCLUDE}
    `,
    parse: (rows) => Number((rows[0] as { n?: number })?.n ?? 0),
    fallback: 0,
  };
}

function revealedCount(window: TimeWindowKey): MetricDef<number> {
  return {
    key: `puzzles.revealed.${window}`,
    label: `Puzzles revealed (${window})`,
    description: "Count of puzzle_revealed events in the window.",
    window,
    format: "count",
    source: window === "alltime" ? "precomputed" : "live",
    hogql: `
      SELECT toInt(countIf(event = 'puzzle_revealed')) AS n
      FROM events
      WHERE 1=1 \${WINDOW}\${EXCLUDE}
    `,
    parse: (rows) => Number((rows[0] as { n?: number })?.n ?? 0),
    fallback: 0,
  };
}

export const startedToday = startedCount("today");
export const startedLast7d = startedCount("last7d");
export const startedAllTime = startedCount("alltime");

export const solvedToday = solvedCount("today");
export const solvedLast7d = solvedCount("last7d");
export const solvedAllTime = solvedCount("alltime");

export const revealedToday = revealedCount("today");
export const revealedAllTime = revealedCount("alltime");

// Today's puzzle drilldown — single object covering the metrics shown
// in the "Today" Big-card row (fastest, avg moves, bonus rate).
// Returned as a structured object rather than separate metrics so the
// dashboard makes one query instead of four.
export type TodayPuzzleDetail = {
  num: number | null;
  solves: number;
  fastest: number | null;
  avgMoves: number | null;
  bonus: number;
  topStreak: number | null;
};

export const todayPuzzleDetail: MetricDef<TodayPuzzleDetail> = {
  key: "puzzles.today.detail",
  label: "Today's puzzle",
  description:
    "Aggregate stats for today's puzzle: solve count, fastest moves, average moves, bonus solves, top streak. Single row because all rows agree on `num` for today's events.",
  window: "today",
  format: "raw",
  source: "live",
  hogql: `
    SELECT
      toInt(toString(properties.num)) AS num,
      toInt(count()) AS solves,
      toInt(min(toInt(toString(properties.moves)))) AS fastest,
      round(avg(toInt(toString(properties.moves))), 1) AS avg_moves,
      toInt(countIf(toString(properties.bonus) = 'true')) AS bonus,
      toInt(max(toInt(toString(properties.streak)))) AS top_streak
    FROM events
    WHERE event = 'puzzle_solved' \${WINDOW}\${EXCLUDE}
    GROUP BY num
    ORDER BY solves DESC
    LIMIT 1
  `,
  parse: (rows) => {
    const r = rows[0] as
      | {
          num?: number;
          solves?: number;
          fastest?: number;
          avg_moves?: number;
          bonus?: number;
          top_streak?: number;
        }
      | undefined;
    if (!r) {
      return { num: null, solves: 0, fastest: null, avgMoves: null, bonus: 0, topStreak: null };
    }
    return {
      num: r.num ?? null,
      solves: Number(r.solves ?? 0),
      fastest: r.fastest ?? null,
      avgMoves: r.avg_moves ?? null,
      bonus: Number(r.bonus ?? 0),
      topStreak: r.top_streak ?? null,
    };
  },
  fallback: { num: null, solves: 0, fastest: null, avgMoves: null, bonus: 0, topStreak: null },
};

// Daily breakdown, last 14 days. Used for the trend chart.
export type DailyRow = {
  day: string;
  started: number;
  solved: number;
  revealed: number;
};

export const dailyLast14d: MetricDef<DailyRow[]> = {
  key: "puzzles.daily.last14d",
  label: "Daily activity (last 14 days)",
  description:
    "Per-day count of started/solved/revealed events for the last 14 calendar days, UTC. Used to drive the trend chart.",
  window: "last30d", // window is broader than 14d so partial days don't truncate; we LIMIT
  format: "raw",
  source: "precomputed",
  hogql: `
    SELECT toString(toDate(timestamp, 'UTC')) AS day,
      toInt(countIf(event = 'puzzle_started')) AS started,
      toInt(countIf(event = 'puzzle_solved')) AS solved,
      toInt(countIf(event = 'puzzle_revealed')) AS revealed
    FROM events
    WHERE event IN ('puzzle_started', 'puzzle_solved', 'puzzle_revealed') \${WINDOW}\${EXCLUDE}
    GROUP BY day
    ORDER BY day DESC
    LIMIT 14
  `,
  parse: (rows) =>
    (rows as DailyRow[]).map((r) => ({
      day: r.day,
      started: Number(r.started ?? 0),
      solved: Number(r.solved ?? 0),
      revealed: Number(r.revealed ?? 0),
    })),
  fallback: [],
};
