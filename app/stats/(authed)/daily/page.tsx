// Daily activity — 14-day breakdown chart and the moves-to-solve
// distribution. Both are PostHog-backed live queries; precomputing
// would only help once we're seeing many concurrent dashboard users.

import { hogql } from "../../../lib/posthog-api";
import { EXCLUDE } from "../../_lib";
import { BarCell, StackedBarCell, LegendDot, Section, Empty, MODE_SQL, fmt } from "../../_components";

export const dynamic = "force-dynamic";

type DailyByModeRow = {
  day: string;
  mode: "classic" | "hard";
  started: number;
  solved: number;
  revealed: number;
};
type MovesRow = { moves: number | null; solves: number };
// Hour-of-day (UTC) histogram of puzzle_started events, last 30 days.
// PostHog stores timestamps in UTC; we surface that in the tooltip
// rather than try to localise per-user — a single global pattern is
// what licensing readers care about (commute window, lunchtime spike).
type HourRow = { hour: number; starts: number };

// Pivot the per-(day, mode) rows into per-day rows with a classic/hard
// breakdown for each metric, so the rendering loop is one row per day.
type DailyPivot = {
  day: string;
  started: { classic: number; hard: number };
  solved: { classic: number; hard: number };
  revealed: { classic: number; hard: number };
};

function pivotDaily(rows: DailyByModeRow[]): DailyPivot[] {
  const byDay = new Map<string, DailyPivot>();
  for (const r of rows) {
    let p = byDay.get(r.day);
    if (!p) {
      p = {
        day: r.day,
        started: { classic: 0, hard: 0 },
        solved: { classic: 0, hard: 0 },
        revealed: { classic: 0, hard: 0 },
      };
      byDay.set(r.day, p);
    }
    p.started[r.mode] += r.started;
    p.solved[r.mode] += r.solved;
    p.revealed[r.mode] += r.revealed;
  }
  return Array.from(byDay.values()).sort((a, b) => (a.day < b.day ? 1 : -1));
}

export default async function DailyStatsPage() {
  let dailyRaw: DailyByModeRow[] = [];
  let moves: MovesRow[] = [];
  let hours: HourRow[] = [];
  let error: string | null = null;
  try {
    [dailyRaw, moves, hours] = await Promise.all([
      hogql<DailyByModeRow>(`
        SELECT toString(toDate(timestamp)) AS day,
          ${MODE_SQL} AS mode,
          toInt(countIf(event = 'puzzle_started')) AS started,
          toInt(countIf(event = 'puzzle_solved')) AS solved,
          toInt(countIf(event = 'puzzle_revealed')) AS revealed
        FROM events
        WHERE timestamp >= now() - INTERVAL 14 DAY
          AND event IN ('puzzle_started', 'puzzle_solved', 'puzzle_revealed')${EXCLUDE}
        GROUP BY day, mode
        ORDER BY day DESC
      `),
      hogql<MovesRow>(`
        SELECT toInt(toString(properties.moves)) AS moves,
          toInt(count()) AS solves
        FROM events
        WHERE event = 'puzzle_solved' AND timestamp >= now() - INTERVAL 30 DAY${EXCLUDE}
        GROUP BY moves
        HAVING moves IS NOT NULL
        ORDER BY moves
      `),
      // Hour-of-day starts. UTC because that's PostHog's storage tz
      // and what the licensing audience expects (a publisher will
      // mentally shift to GMT for a UK-centric pitch). 00 is included
      // so the histogram has all 24 buckets even on quiet hours.
      hogql<HourRow>(`
        SELECT
          toInt(toHour(timestamp)) AS hour,
          toInt(count()) AS starts
        FROM events
        WHERE event = 'puzzle_started' AND timestamp >= now() - INTERVAL 30 DAY${EXCLUDE}
        GROUP BY hour
        ORDER BY hour
      `),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const daily = pivotDaily(dailyRaw);
  const dailyMax = Math.max(
    1,
    ...daily.flatMap((d) => [
      d.started.classic + d.started.hard,
      d.solved.classic + d.solved.hard,
      d.revealed.classic + d.revealed.hard,
    ])
  );
  const movesMax = Math.max(1, ...moves.map((m) => m.solves));

  // Zero-fill the 24-hour histogram so quiet hours render as empty
  // bars, not gaps. Sorted ascending 00 to 23.
  const hoursFilled = Array.from({ length: 24 }, (_, h) => {
    const row = hours.find((r) => r.hour === h);
    return { hour: h, starts: row?.starts ?? 0 };
  });
  const hoursMax = Math.max(1, ...hoursFilled.map((h) => h.starts));

  return (
    <div>
      <h1 className="text-2xl font-light tracking-tight mb-6">Daily</h1>

      {error ? (
        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-medium">Failed to load daily stats</p>
          <pre className="mt-2 whitespace-pre-wrap text-xs">{error}</pre>
        </div>
      ) : (
        <>
          <Section
            title="Last 14 days"
            freshness="live"
            tooltip="Per-day count of started, solved, and revealed events. Each bar is split classic / hard (4×4 vs 5×5) so the mode mix is visible. Solved ÷ Started on a given day is the local solve rate; Revealed ÷ Started is the give-up rate. A healthy puzzle has Solved >> Revealed."
          >
            <div className="space-y-2">
              <div className="grid grid-cols-[80px_1fr_1fr_1fr] gap-3 text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">
                <span>Day</span>
                <span>Started</span>
                <span>Solved</span>
                <span>Revealed</span>
              </div>
              {daily.length === 0 && <Empty />}
              {daily.map((d) => (
                <div key={d.day} className="grid grid-cols-[80px_1fr_1fr_1fr] gap-3 items-center text-xs">
                  <span className="tabular-nums text-[color:var(--color-muted)]">{d.day.slice(5)}</span>
                  <StackedBarCell classic={d.started.classic} hard={d.started.hard} max={dailyMax} color="var(--color-ink)" />
                  <StackedBarCell classic={d.solved.classic} hard={d.solved.hard} max={dailyMax} color="#7a9070" />
                  <StackedBarCell classic={d.revealed.classic} hard={d.revealed.hard} max={dailyMax} color="#b88a3a" />
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-[color:var(--color-muted)]">
              <LegendDot color="var(--color-ink)" label="Started" />
              <LegendDot color="#7a9070" label="Solved" />
              <LegendDot color="#b88a3a" label="Revealed" />
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-flex h-2 w-4 rounded-sm overflow-hidden">
                  <span className="flex-1" style={{ background: "var(--color-ink)" }} />
                  <span className="flex-1" style={{ background: "var(--color-ink)", opacity: 0.45 }} />
                </span>
                Classic / Hard
              </span>
            </div>
          </Section>

          <Section
            title="Time of day · last 30d"
            freshness="live"
            tooltip="Hour-of-day distribution of puzzle_started events over the rolling 30-day window. Times are UTC (PostHog's storage tz); for UK that's GMT in winter, BST minus 1 in summer. Watch the morning-commute spike (07 to 09 UTC) and evening peak (19 to 22 UTC)."
          >
            <div className="space-y-1.5">
              {hoursFilled.map((h) => (
                <div
                  key={h.hour}
                  className="grid grid-cols-[60px_1fr_60px] gap-3 items-center text-xs"
                >
                  <span className="tabular-nums text-[color:var(--color-muted)]">
                    {String(h.hour).padStart(2, "0")}:00
                  </span>
                  <BarCell value={h.starts} max={hoursMax} color="var(--color-ink)" />
                  <span className="tabular-nums text-right">{fmt(h.starts)}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section
            title="Moves to solve · last 30d"
            freshness="live"
            tooltip="Histogram of move counts across every solve in the last 30 days. The shape of this curve is the difficulty fingerprint. A bell-shaped curve centred around 12 to 20 moves = well-tuned. A long flat tail past 60 = too many players bashing rather than solving cleanly."
          >
            <div className="space-y-1.5">
              {moves.length === 0 && <Empty />}
              {moves.map((m) => (
                <div key={m.moves ?? "null"} className="grid grid-cols-[40px_1fr_40px] gap-3 items-center text-xs">
                  <span className="tabular-nums text-[color:var(--color-muted)]">{m.moves}</span>
                  <BarCell value={m.solves} max={movesMax} color="#7a9070" />
                  <span className="tabular-nums text-right">{m.solves}</span>
                </div>
              ))}
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
