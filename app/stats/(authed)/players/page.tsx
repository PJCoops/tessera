// Players — language breakdown, hide-hints toggle preferences,
// returning rate. All live HogQL.

import { hogql } from "../../../lib/posthog-api";
import { EXCLUDE } from "../../_lib";
import { Big, Section, Empty, fmt } from "../../_components";

export const dynamic = "force-dynamic";

type LangRow = {
  language: string;
  unique_players: number;
  started: number;
  solved: number;
  revealed: number;
  avg_moves: number | null;
};
type HintsRow = { enabled: unknown; toggles: number; users: number };
type ReturningRow = { returning: number; total: number; top_player_solves: number };

export default async function PlayersStatsPage() {
  let langs: LangRow[] = [];
  let hints: HintsRow[] = [];
  let returning: ReturningRow[] = [];
  let error: string | null = null;
  try {
    [langs, hints, returning] = await Promise.all([
      hogql<LangRow>(`
        SELECT coalesce(toString(properties.language), 'en') AS language,
          toInt(uniq(distinct_id)) AS unique_players,
          toInt(countIf(event = 'puzzle_started')) AS started,
          toInt(countIf(event = 'puzzle_solved')) AS solved,
          toInt(countIf(event = 'puzzle_revealed')) AS revealed,
          round(avgIf(toInt(toString(properties.moves)), event = 'puzzle_solved'), 1) AS avg_moves
        FROM events
        WHERE timestamp >= now() - INTERVAL 30 DAY
          AND event IN ('puzzle_started', 'puzzle_solved', 'puzzle_revealed')${EXCLUDE}
        GROUP BY language
        ORDER BY started DESC
      `),
      hogql<HintsRow>(`
        SELECT properties.enabled AS enabled,
          toInt(count()) AS toggles,
          toInt(uniq(distinct_id)) AS users
        FROM events
        WHERE event = 'hide_hints_toggled' AND timestamp >= now() - INTERVAL 30 DAY${EXCLUDE}
        GROUP BY enabled
      `),
      hogql<ReturningRow>(`
        SELECT
          toInt(countIf(n >= 2)) AS returning,
          toInt(count()) AS total,
          toInt(max(n)) AS top_player_solves
        FROM (
          SELECT distinct_id, count() AS n
          FROM events
          WHERE event = 'puzzle_solved'${EXCLUDE}
          GROUP BY distinct_id
        )
      `),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const ret = returning[0];
  const returningPct = ret?.total ? (ret.returning / ret.total) * 100 : 0;

  return (
    <div>
      <h1 className="text-2xl font-light tracking-tight mb-6">Players</h1>

      {error ? (
        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-medium">Failed to load player stats</p>
          <pre className="mt-2 whitespace-pre-wrap text-xs">{error}</pre>
        </div>
      ) : (
        <>
          <Section title="Returning players · all time" freshness="live">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Big
                label="Returning rate"
                value={`${returningPct.toFixed(0)}%`}
                suffix={ret?.total ? `${fmt(ret.returning)}/${fmt(ret.total)}` : undefined}
              />
              <Big
                label="Most-played player"
                value={ret?.top_player_solves ? `${ret.top_player_solves}×` : "—"}
                suffix="solves"
              />
            </div>
            <p className="mt-3 text-[10px] text-[color:var(--color-muted)] max-w-prose">
              "Returning" = a distinct_id that solved on at least 2 different
              puzzle days. distinct_id is per-device, so a player on phone +
              laptop counts as two.
            </p>
          </Section>

          <Section title="By language · last 30d" freshness="live">
            <div className="space-y-1">
              <div className="grid grid-cols-[60px_repeat(5,1fr)] gap-3 text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">
                <span>Lang</span>
                <span>Players</span>
                <span>Started</span>
                <span>Solved</span>
                <span>Revealed</span>
                <span>Avg moves</span>
              </div>
              {langs.length === 0 && <Empty />}
              {langs.map((l) => (
                <div
                  key={l.language}
                  className="grid grid-cols-[60px_repeat(5,1fr)] gap-3 text-xs tabular-nums"
                >
                  <span className="text-[color:var(--color-muted)] uppercase">{l.language}</span>
                  <span>{l.unique_players}</span>
                  <span>{l.started}</span>
                  <span>{l.solved}</span>
                  <span>{l.revealed}</span>
                  <span>{l.avg_moves ?? "—"}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[10px] text-[color:var(--color-muted)] max-w-prose">
              Events from before the locale rollout have no <code>language</code> property
              and are bucketed as <code>en</code> (the only route that existed then).
            </p>
          </Section>

          <Section title="Hide hints toggle · last 30d" freshness="live">
            <div className="space-y-1.5 text-xs">
              {hints.length === 0 && <Empty />}
              {hints.map((h) => (
                <div key={String(h.enabled)} className="grid grid-cols-[80px_1fr_1fr] gap-3 tabular-nums">
                  <span className="text-[color:var(--color-muted)]">
                    {h.enabled === true || h.enabled === "true" ? "On" : "Off"}
                  </span>
                  <span>{h.toggles} toggles</span>
                  <span>{h.users} users</span>
                </div>
              ))}
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
