// Players — language breakdown, hide-hints toggle preferences,
// returning rate. All live HogQL.

import { cachedHogql } from "../../../lib/posthog-api";
import { EXCLUDE } from "../../_lib";
import { Big, Section, Empty, BarCell, fmt } from "../../_components";

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
// Per-distinct_id peak streak, bucketed. Bucket order is preserved by
// the multiIf branches; we re-sort in TS to guarantee display order.
type StreakBucketRow = { bucket: string; players: number };
// Mobile / Tablet / Desktop / Unknown breakdown over the last 30 days.
type DeviceRow = {
  device: string;
  users: number;
  started: number;
  solved: number;
};
// Per-country breakdown for the last 30 days. Uses PostHog's
// $geoip_country_name (autocaptured server-side from the request IP).
type CountryRow = {
  country: string;
  users: number;
  solvers: number;
};

export default async function PlayersStatsPage() {
  let langs: LangRow[] = [];
  let hints: HintsRow[] = [];
  let returning: ReturningRow[] = [];
  let streaks: StreakBucketRow[] = [];
  let devices: DeviceRow[] = [];
  let countries: CountryRow[] = [];
  let error: string | null = null;
  try {
    [langs, hints, returning, streaks, devices, countries] = await Promise.all([
      cachedHogql<LangRow>(`
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
      cachedHogql<HintsRow>(`
        SELECT properties.enabled AS enabled,
          toInt(count()) AS toggles,
          toInt(uniq(distinct_id)) AS users
        FROM events
        WHERE event = 'hide_hints_toggled' AND timestamp >= now() - INTERVAL 30 DAY${EXCLUDE}
        GROUP BY enabled
      `),
      cachedHogql<ReturningRow>(`
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
      // Streak histogram: bucket each player by their personal-best
      // streak. We take max(streak) per distinct_id from puzzle_solved
      // events (the streak counter is sent on each solve). Players
      // who only solved once have streak 1; the 0 bucket exists only
      // for legacy events that pre-date the streak property.
      cachedHogql<StreakBucketRow>(`
        SELECT bucket, toInt(count()) AS players
        FROM (
          SELECT
            distinct_id,
            multiIf(
              max_streak >= 30, '30+',
              max_streak >= 14, '14-29',
              max_streak >= 7, '7-13',
              max_streak >= 3, '3-6',
              max_streak >= 1, '1-2',
              '0'
            ) AS bucket
          FROM (
            SELECT distinct_id,
              toInt(max(toIntOrZero(toString(properties.streak)))) AS max_streak
            FROM events
            WHERE event = 'puzzle_solved'${EXCLUDE}
            GROUP BY distinct_id
          )
        )
        GROUP BY bucket
      `),
      // Device split — uses PostHog's autocaptured $device_type. Falls
      // back to 'Unknown' for events from clients that didn't surface
      // it (rare, mostly very old browsers / scripted requests).
      cachedHogql<DeviceRow>(`
        SELECT
          coalesce(toString(properties.$device_type), 'Unknown') AS device,
          toInt(uniq(distinct_id)) AS users,
          toInt(countIf(event = 'puzzle_started')) AS started,
          toInt(countIf(event = 'puzzle_solved')) AS solved
        FROM events
        WHERE event IN ('puzzle_started', 'puzzle_solved')
          AND timestamp >= now() - INTERVAL 30 DAY${EXCLUDE}
        GROUP BY device
        ORDER BY users DESC
      `),
      // Geographic split: PostHog populates $geoip_country_name from
      // the request IP. Top 12 countries by unique users; everything
      // else collapses into the table tail. Solvers (uniq distinct_id
      // with puzzle_solved) is the engagement-quality column, not raw
      // event count, so a country with one player solving twice
      // doesn't out-rank a country with two players solving once.
      cachedHogql<CountryRow>(`
        SELECT
          coalesce(toString(properties.$geoip_country_name), 'Unknown') AS country,
          toInt(uniq(distinct_id)) AS users,
          toInt(uniqIf(distinct_id, event = 'puzzle_solved')) AS solvers
        FROM events
        WHERE event IN ('puzzle_started', 'puzzle_solved')
          AND timestamp >= now() - INTERVAL 30 DAY${EXCLUDE}
        GROUP BY country
        ORDER BY users DESC
        LIMIT 12
      `),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const ret = returning[0];
  const returningPct = ret?.total ? (ret.returning / ret.total) * 100 : 0;

  // Canonical bucket order — display low-to-high so the long-streak
  // tail reads on the right, matching the moves-to-solve histogram.
  const STREAK_ORDER = ["0", "1-2", "3-6", "7-13", "14-29", "30+"] as const;
  const streakRows = STREAK_ORDER.map(
    (b) => streaks.find((s) => s.bucket === b) ?? { bucket: b, players: 0 }
  );
  const streakTotal = streakRows.reduce((s, r) => s + r.players, 0);
  const streakMax = Math.max(1, ...streakRows.map((r) => r.players));
  const sevenPlus = streakRows
    .filter((r) => r.bucket === "7-13" || r.bucket === "14-29" || r.bucket === "30+")
    .reduce((s, r) => s + r.players, 0);
  const sevenPlusPct = streakTotal > 0 ? (sevenPlus / streakTotal) * 100 : 0;

  const deviceTotal = devices.reduce((s, d) => s + d.users, 0);
  const countryTotal = countries.reduce((s, c) => s + c.users, 0);

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
          <Section
            title="Returning players · all time"
            freshness="live"
            tooltip="Repeat-solver behaviour across the lifetime of the project. The headline rate is what share of solvers come back for a second puzzle. A useful proxy for habit formation but device-scoped: cross-device players inflate the denominator and undercount the rate."
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Big
                label="Returning rate"
                value={`${returningPct.toFixed(0)}%`}
                suffix={ret?.total ? `${fmt(ret.returning)}/${fmt(ret.total)}` : undefined}
                tooltip="Of all-time solvers, the share that solved more than once. Denominator is solvers (not visitors). Note: counts puzzle_solved events ≥ 2, so a player who replayed the same puzzle twice in one day registers as returning. Stickiness signal, but a noisy one. See the Cohorts page for cleaner D1/D7/D30 numbers."
              />
              <Big
                label="Most-played player"
                value={ret?.top_player_solves ? `${ret.top_player_solves}×` : "—"}
                suffix="solves"
                tooltip="Total puzzle_solved events from the most active distinct_id. Includes replays."
              />
            </div>
            <p className="mt-3 text-[10px] text-[color:var(--color-muted)] max-w-prose">
              "Returning" = a distinct_id that solved on at least 2 different
              puzzle days. distinct_id is per-device, so a player on phone +
              laptop counts as two.
            </p>
          </Section>

          <Section
            title={`Streak distribution · ${fmt(streakTotal)} solvers`}
            freshness="live"
            tooltip="Each solver bucketed by their personal-best streak (consecutive days solving the daily puzzle). The right-side tail (7+) is the habit-formed core: players who have woven Tessera into their daily routine. The lead card surfaces the 7+ share as the headline habit number."
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <Big
                label="7+ day streakers"
                value={`${sevenPlusPct.toFixed(0)}%`}
                suffix={
                  streakTotal > 0
                    ? `${fmt(sevenPlus)} of ${fmt(streakTotal)} solvers`
                    : undefined
                }
                tooltip="Share of all-time solvers whose personal-best streak is 7 days or more. The 'visceral habit' number: easy to grasp, hard to fake. Anything ≥10% on a young product is meaningful; ≥20% is exceptional."
              />
              <Big
                label="14+ day streakers"
                value={
                  streakTotal > 0
                    ? `${(((streakRows.find((r) => r.bucket === "14-29")?.players ?? 0) +
                        (streakRows.find((r) => r.bucket === "30+")?.players ?? 0)) /
                        streakTotal *
                        100).toFixed(0)}%`
                    : "—"
                }
                suffix={
                  streakTotal > 0
                    ? `${fmt(
                        (streakRows.find((r) => r.bucket === "14-29")?.players ?? 0) +
                          (streakRows.find((r) => r.bucket === "30+")?.players ?? 0)
                      )} solvers`
                    : undefined
                }
                tooltip="Share of all-time solvers with a personal-best streak of 14+ days. Two-week streaks are well past 'I'm trying it out' and squarely in 'this is part of my morning'. Pair with cohort retention to triangulate stickiness."
              />
            </div>
            <div className="space-y-1.5">
              {streakRows.map((r) => (
                <div
                  key={r.bucket}
                  className="grid grid-cols-[60px_1fr_60px] gap-3 items-center text-xs"
                >
                  <span className="tabular-nums text-[color:var(--color-muted)]">
                    {r.bucket} {r.bucket === "0" ? "" : "days"}
                  </span>
                  <BarCell value={r.players} max={streakMax} color="#b88a3a" />
                  <span className="tabular-nums text-right">
                    {streakTotal > 0 ? `${((r.players / streakTotal) * 100).toFixed(0)}%` : "—"}
                  </span>
                </div>
              ))}
            </div>
          </Section>

          <Section
            title="Device split · last 30d"
            freshness="live"
            tooltip="Mobile / Tablet / Desktop / Unknown breakdown from PostHog's $device_type property. Mobile-heavy splits track the daily-commute reading habit."
          >
            {devices.length === 0 ? (
              <Empty />
            ) : (
              <div className="space-y-1">
                <div className="grid grid-cols-[100px_1fr_1fr_1fr_60px] gap-3 text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">
                  <span>Device</span>
                  <span>Players</span>
                  <span>Started</span>
                  <span>Solved</span>
                  <span>Share</span>
                </div>
                {devices.map((d) => (
                  <div
                    key={d.device}
                    className="grid grid-cols-[100px_1fr_1fr_1fr_60px] gap-3 text-xs tabular-nums"
                  >
                    <span className="text-[color:var(--color-muted)]">{d.device}</span>
                    <span>{fmt(d.users)}</span>
                    <span>{fmt(d.started)}</span>
                    <span>{fmt(d.solved)}</span>
                    <span className="text-right">
                      {deviceTotal > 0 ? `${Math.round((d.users / deviceTotal) * 100)}%` : "—"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section
            title="Geographic split · last 30d"
            freshness="live"
            tooltip="Top 12 countries by unique players, with the share who reached a solve. Country comes from PostHog's autocaptured $geoip_country_name (request IP). Note: VPN users and 'Unknown' country events are not stripped."
          >
            {countries.length === 0 ? (
              <Empty />
            ) : (
              <div className="space-y-1">
                <div className="grid grid-cols-[1fr_80px_80px_60px] gap-3 text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">
                  <span>Country</span>
                  <span>Players</span>
                  <span>Solvers</span>
                  <span>Share</span>
                </div>
                {countries.map((c) => (
                  <div
                    key={c.country}
                    className="grid grid-cols-[1fr_80px_80px_60px] gap-3 text-xs tabular-nums"
                  >
                    <span className="text-[color:var(--color-muted)]">{c.country}</span>
                    <span>{fmt(c.users)}</span>
                    <span>{fmt(c.solvers)}</span>
                    <span className="text-right">
                      {countryTotal > 0
                        ? `${Math.round((c.users / countryTotal) * 100)}%`
                        : "—"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section
            title="By language · last 30d"
            freshness="live"
            tooltip="Per-language breakdown over the rolling 30-day window. Language is the locale the player is using (currently en or sv), derived from the route they're on. Pre-locale events are bucketed as en. Useful for sizing localisation upside."
          >
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

          <Section
            title="Hide hints toggle · last 30d"
            freshness="live"
            tooltip="How often players toggle the hint overlay (showing the colour cues for each tile's correct row/column) on or off. 'On' = hints visible. Heavy 'Off' usage signals confident, repeat players who want a harder puzzle without switching to Hard mode."
          >
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
