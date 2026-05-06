// Daily activity — 14-day breakdown chart and the moves-to-solve
// distribution. Both are PostHog-backed live queries; precomputing
// would only help once we're seeing many concurrent dashboard users.

import { hogql } from "../../../lib/posthog-api";
import { EXCLUDE } from "../../_lib";
import { BarCell, LegendDot, Section, Empty } from "../../_components";

export const dynamic = "force-dynamic";

type DailyRow = { day: string; started: number; solved: number; revealed: number };
type MovesRow = { moves: number | null; solves: number };

export default async function DailyStatsPage() {
  let daily: DailyRow[] = [];
  let moves: MovesRow[] = [];
  let error: string | null = null;
  try {
    [daily, moves] = await Promise.all([
      hogql<DailyRow>(`
        SELECT toString(toDate(timestamp)) AS day,
          toInt(countIf(event = 'puzzle_started')) AS started,
          toInt(countIf(event = 'puzzle_solved')) AS solved,
          toInt(countIf(event = 'puzzle_revealed')) AS revealed
        FROM events
        WHERE timestamp >= now() - INTERVAL 14 DAY
          AND event IN ('puzzle_started', 'puzzle_solved', 'puzzle_revealed')${EXCLUDE}
        GROUP BY day
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

  const dailyMax = Math.max(1, ...daily.map((d) => Math.max(d.started, d.solved, d.revealed)));
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
                  <BarCell value={d.started} max={dailyMax} color="#0a0a0a" />
                  <BarCell value={d.solved} max={dailyMax} color="#7a9070" />
                  <BarCell value={d.revealed} max={dailyMax} color="#b88a3a" />
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-3 text-[10px] text-[color:var(--color-muted)]">
              <LegendDot color="#0a0a0a" label="Started" />
              <LegendDot color="#7a9070" label="Solved" />
              <LegendDot color="#b88a3a" label="Revealed" />
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
