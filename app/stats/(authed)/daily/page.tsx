// Daily activity — 14-day breakdown chart and the moves-to-solve
// distribution. Both are PostHog-backed live queries; precomputing
// would only help once we're seeing many concurrent dashboard users.

import { hogql } from "../../../lib/posthog-api";
import { EXCLUDE } from "../../_lib";
import { BarCell, StackedBarCell, LegendDot, Section, Empty, MODE_SQL } from "../../_components";

export const dynamic = "force-dynamic";

type DailyByModeRow = {
  day: string;
  mode: "classic" | "hard";
  started: number;
  solved: number;
  revealed: number;
};
type MovesRow = { moves: number | null; solves: number };

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
  let error: string | null = null;
  try {
    [dailyRaw, moves] = await Promise.all([
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
          <Section title="Last 14 days" freshness="live">
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
                  <StackedBarCell classic={d.started.classic} hard={d.started.hard} max={dailyMax} color="#0a0a0a" />
                  <StackedBarCell classic={d.solved.classic} hard={d.solved.hard} max={dailyMax} color="#7a9070" />
                  <StackedBarCell classic={d.revealed.classic} hard={d.revealed.hard} max={dailyMax} color="#b88a3a" />
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-[color:var(--color-muted)]">
              <LegendDot color="#0a0a0a" label="Started" />
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

          <Section title="Moves to solve · last 30d" freshness="live">
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
