// Puzzles — per-puzzle stats over the last 14 days, hardest/easiest
// puzzles in the last 30, today's tier distribution, and the
// 30-day tier distribution.

import { hogql } from "../../../lib/posthog-api";
import { EXCLUDE } from "../../_lib";
import {
  Section,
  TierBarByMode,
  LegendDot,
  Empty,
  TIER_ORDER,
  TIER_BAR_COLORS,
  TIER_SQL,
  MODE_SQL,
  groupTiersByMode,
  type TierByModeRow,
} from "../../_components";

export const dynamic = "force-dynamic";

type PuzzleRow = {
  num: number | null;
  mode: "classic" | "hard";
  solves: number;
  avg_moves: number | null;
  median_moves: number | null;
};
type ExtremeRow = {
  num: number | null;
  mode: "classic" | "hard";
  solves: number;
  avg_moves: number | null;
};

export default async function PuzzlesStatsPage() {
  let puzzles: PuzzleRow[] = [];
  let todayTiers: TierByModeRow[] = [];
  let allTiers: TierByModeRow[] = [];
  let hardest: ExtremeRow[] = [];
  let easiest: ExtremeRow[] = [];
  let error: string | null = null;
  try {
    [puzzles, todayTiers, allTiers, hardest, easiest] = await Promise.all([
      hogql<PuzzleRow>(`
        SELECT toInt(toString(properties.num)) AS num,
          ${MODE_SQL} AS mode,
          toInt(count()) AS solves,
          round(avg(toInt(toString(properties.moves))), 1) AS avg_moves,
          quantile(0.5)(toInt(toString(properties.moves))) AS median_moves
        FROM events
        WHERE event = 'puzzle_solved' AND timestamp >= now() - INTERVAL 30 DAY${EXCLUDE}
        GROUP BY num, mode
        HAVING num IS NOT NULL
        ORDER BY num DESC, mode ASC
        LIMIT 28
      `),
      hogql<TierByModeRow>(`
        SELECT ${TIER_SQL} AS tier, ${MODE_SQL} AS mode, toInt(count()) AS solves
        FROM events
        WHERE event = 'puzzle_solved' AND toDate(timestamp) = today()${EXCLUDE}
        GROUP BY tier, mode
      `),
      hogql<TierByModeRow>(`
        SELECT ${TIER_SQL} AS tier, ${MODE_SQL} AS mode, toInt(count()) AS solves
        FROM events
        WHERE event = 'puzzle_solved' AND timestamp >= now() - INTERVAL 30 DAY${EXCLUDE}
        GROUP BY tier, mode
      `),
      hogql<ExtremeRow>(`
        SELECT toInt(toString(properties.num)) AS num,
          ${MODE_SQL} AS mode,
          toInt(count()) AS solves,
          round(avg(toInt(toString(properties.moves))), 1) AS avg_moves
        FROM events
        WHERE event = 'puzzle_solved' AND timestamp >= now() - INTERVAL 30 DAY${EXCLUDE}
        GROUP BY num, mode
        HAVING solves >= 5
        ORDER BY avg_moves DESC
        LIMIT 2
      `),
      hogql<ExtremeRow>(`
        SELECT toInt(toString(properties.num)) AS num,
          ${MODE_SQL} AS mode,
          toInt(count()) AS solves,
          round(avg(toInt(toString(properties.moves))), 1) AS avg_moves
        FROM events
        WHERE event = 'puzzle_solved' AND timestamp >= now() - INTERVAL 30 DAY${EXCLUDE}
        GROUP BY num, mode
        HAVING solves >= 5
        ORDER BY avg_moves ASC
        LIMIT 2
      `),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const todayByMode = groupTiersByMode(todayTiers);
  const allByMode = groupTiersByMode(allTiers);
  const todayTotal = todayTiers.reduce((s, r) => s + r.solves, 0);
  const allTotal = allTiers.reduce((s, r) => s + r.solves, 0);

  return (
    <div>
      <h1 className="text-2xl font-light tracking-tight mb-6">Puzzles</h1>

      {error ? (
        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-medium">Failed to load puzzle stats</p>
          <pre className="mt-2 whitespace-pre-wrap text-xs">{error}</pre>
        </div>
      ) : (
        <>
          <Section title={`Today's tiers · ${todayTotal} solves`} freshness="live">
            {todayTotal === 0 ? <Empty /> : <TierBarByMode byMode={todayByMode} />}
          </Section>

          <Section title="Hardest & easiest · last 30d" freshness="live">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ExtremeHighlight label="Hardest puzzle" rows={hardest} />
              <ExtremeHighlight label="Easiest puzzle" rows={easiest} />
            </div>
            <p className="mt-3 text-[10px] text-[color:var(--color-muted)]">
              Puzzles with at least 5 solves only — split by mode since
              4×4 and 5×5 puzzles share `num` but differ in difficulty.
            </p>
          </Section>

          <Section title={`Tier distribution · last 30d · ${allTotal} solves`} freshness="live">
            {allTotal === 0 ? <Empty /> : <TierBarByMode byMode={allByMode} />}
            <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-[color:var(--color-muted)]">
              {TIER_ORDER.map((t) => (
                <LegendDot key={t} color={TIER_BAR_COLORS[t]} label={t} />
              ))}
            </div>
          </Section>

          <Section title="Per-puzzle difficulty · last 30d" freshness="live">
            <div className="space-y-1">
              <div className="grid grid-cols-[60px_60px_1fr_1fr_1fr] gap-3 text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">
                <span>#</span>
                <span>Mode</span>
                <span>Solves</span>
                <span>Avg moves</span>
                <span>Median</span>
              </div>
              {puzzles.length === 0 && <Empty />}
              {puzzles.map((p) => (
                <div
                  key={`${p.num ?? "null"}-${p.mode}`}
                  className="grid grid-cols-[60px_60px_1fr_1fr_1fr] gap-3 text-xs tabular-nums"
                >
                  <span className="text-[color:var(--color-muted)]">#{p.num}</span>
                  <span className="text-[color:var(--color-muted)]">
                    {p.mode === "hard" ? "5×5" : "4×4"}
                  </span>
                  <span>{p.solves}</span>
                  <span>{p.avg_moves ?? "—"}</span>
                  <span>{p.median_moves ?? "—"}</span>
                </div>
              ))}
            </div>
          </Section>
        </>
      )}
    </div>
  );
}

// Render up to one Hardest/Easiest highlight per mode. With Hard
// launching today, the Hard side will read "—" until at least one
// 5×5 puzzle clears the ≥5-solve threshold.
function ExtremeHighlight({
  label,
  rows,
}: {
  label: string;
  rows: ExtremeRow[];
}) {
  const classic = rows.find((r) => r.mode === "classic") ?? null;
  const hard = rows.find((r) => r.mode === "hard") ?? null;
  return (
    <div className="border border-[color:var(--color-rule)] rounded-md p-4">
      <p className="text-[10px] uppercase tracking-wider text-[color:var(--color-muted)] mb-2">
        {label}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <ExtremeColumn modeLabel="4×4" row={classic} />
        <ExtremeColumn modeLabel="5×5" row={hard} />
      </div>
    </div>
  );
}

function ExtremeColumn({
  modeLabel,
  row,
}: {
  modeLabel: string;
  row: ExtremeRow | null;
}) {
  return (
    <div>
      <p className="text-[10px] text-[color:var(--color-muted)]">{modeLabel}</p>
      <p className="text-xl font-light tabular-nums mt-0.5">
        {row?.num ? `#${row.num}` : "—"}
      </p>
      {row?.avg_moves != null && (
        <p className="text-[11px] text-[color:var(--color-muted)] mt-0.5">
          avg {row.avg_moves} moves · {row.solves} solves
        </p>
      )}
    </div>
  );
}
