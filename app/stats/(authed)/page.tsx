// Overview — the front page of /stats. Three things only:
//   1. HERO — all-time visitors / engaged players / solvers, each with
//      a "today" sub-stat in the top-right.
//   2. SOCIAL BLURB — pre-formatted copy for r/TesseraPuzzle / X /
//      newsletter, click-to-select.
//   3. SECONDARY (today + records) — today started/solved/fastest/bonus
//      and the headline all-time records (biggest day, top streak,
//      most-played player, returning %, all-time solve rate, tiles).
//
// All section drilldowns live on dedicated routes — see the sidenav.
// This page only fetches what it renders, so the Overview is fast
// even when the rest of the dashboard is busy.

import type { Metadata } from "next";
import { hogql } from "../../lib/posthog-api";
import { puzzleNumber, todayUtc } from "../../lib/rng";
import { EXCLUDE } from "../_lib";
import { Hero, Big, Section, fmt, sortTiers, type TierRow } from "../_components";
import { DailyTrendChart } from "./DailyTrendChart";

const EPOCH = "2026-04-27"; // Tessera #1, mirrors TesseraGame.tsx

export const metadata: Metadata = {
  title: "Stats",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// Row shapes for the queries this page actually runs. Pruned from the
// monolith: anything used only by another page (per-puzzle, cohorts,
// languages, etc.) lives in that page's file now.
type DailyRow = { day: string; started: number; solved: number; revealed: number };
type DailyTrendRow = {
  day: string;
  visitors: number;
  players: number;
  solves: number;
};
type TodayRow = {
  num: number | null;
  solves: number;
  fastest: number | null;
  avg_moves: number | null;
  bonus: number;
  top_streak: number | null;
};
type SummaryRow = {
  total_solves: number;
  bonus_solves: number;
  total_moves_week: number;
  top_streak: number | null;
  unique_solvers: number;
};
type AllTimeRow = {
  total_started: number;
  total_solved: number;
  total_revealed: number;
  unique_visitors: number;
  unique_players: number;
  unique_solvers: number;
  total_moves: number;
  bonus: number;
  top_streak: number | null;
};
type BiggestDayRow = { day: string; solves: number };
type ReturningRow = { returning: number; total: number; top_player_solves: number };
type TodayUniquesRow = { visitors: number; players: number; solvers: number };
type DataSinceRow = { first_event: string | null };

export default async function StatsOverviewPage() {
  let daily: DailyRow[] = [];
  let dailyTrend: DailyTrendRow[] = [];
  let todayRows: TodayRow[] = [];
  let todayTiers: TierRow[] = [];
  let summary: SummaryRow[] = [];
  let allTime: AllTimeRow[] = [];
  let biggestDay: BiggestDayRow[] = [];
  let returning: ReturningRow[] = [];
  let todayUniques: TodayUniquesRow[] = [];
  let dataSince: DataSinceRow[] = [];
  let error: string | null = null;
  try {
    [
      daily,
      dailyTrend,
      todayRows,
      todayTiers,
      summary,
      allTime,
      biggestDay,
      returning,
      todayUniques,
      dataSince,
    ] = await Promise.all([
      hogql<DailyRow>(`
        SELECT toString(toDate(timestamp)) AS day,
          toInt(countIf(event = 'puzzle_started')) AS started,
          toInt(countIf(event = 'puzzle_solved')) AS solved,
          toInt(countIf(event = 'puzzle_revealed')) AS revealed
        FROM events
        WHERE timestamp >= now() - INTERVAL 2 DAY
          AND event IN ('puzzle_started', 'puzzle_solved', 'puzzle_revealed')${EXCLUDE}
        GROUP BY day
        ORDER BY day DESC
        LIMIT 1
      `),
      // Trend over the launch window. Visitors and engaged players are
      // unique distinct_ids per day (matches the Hero counts); solves
      // is the raw event count (matches "Grids cracked today"). Pull
      // 90d server-side; the chart's range pills (7/30/90) slice
      // client-side so switching is instant.
      hogql<DailyTrendRow>(`
        SELECT toString(toDate(timestamp)) AS day,
          toInt(uniqIf(distinct_id, event IN ('$pageview', 'puzzle_started'))) AS visitors,
          toInt(uniqIf(distinct_id, event = 'puzzle_started')) AS players,
          toInt(countIf(event = 'puzzle_solved')) AS solves
        FROM events
        WHERE timestamp >= now() - INTERVAL 90 DAY${EXCLUDE}
        GROUP BY day
        ORDER BY day ASC
      `),
      hogql<TodayRow>(`
        SELECT toInt(toString(properties.num)) AS num,
          toInt(count()) AS solves,
          toInt(min(toInt(toString(properties.moves)))) AS fastest,
          round(avg(toInt(toString(properties.moves))), 1) AS avg_moves,
          toInt(countIf(toString(properties.bonus) = 'true')) AS bonus,
          toInt(max(toInt(toString(properties.streak)))) AS top_streak
        FROM events
        WHERE event = 'puzzle_solved' AND toDate(timestamp) = today()${EXCLUDE}
        GROUP BY num
      `),
      // Today's tier rows are still needed here so the social blurb
      // can show "🏆 X% Legendary · Y% Genius · ..." without
      // double-fetching when someone visits the Overview.
      hogql<TierRow>(`
        SELECT
          multiIf(
            toInt(toString(properties.moves)) <= 10, 'Legendary',
            toInt(toString(properties.moves)) <= 20, 'Genius',
            toInt(toString(properties.moves)) <= 35, 'Wordsmith',
            toInt(toString(properties.moves)) <= 60, 'Persistent',
            'Tenacious'
          ) AS tier,
          toInt(count()) AS solves
        FROM events
        WHERE event = 'puzzle_solved' AND toDate(timestamp) = today()${EXCLUDE}
        GROUP BY tier
      `),
      hogql<SummaryRow>(`
        SELECT
          toInt(count()) AS total_solves,
          toInt(countIf(toString(properties.bonus) = 'true')) AS bonus_solves,
          toInt(sumIf(toInt(toString(properties.moves)), timestamp >= now() - INTERVAL 7 DAY)) AS total_moves_week,
          toInt(max(toInt(toString(properties.streak)))) AS top_streak,
          toInt(uniq(distinct_id)) AS unique_solvers
        FROM events
        WHERE event = 'puzzle_solved' AND timestamp >= now() - INTERVAL 90 DAY${EXCLUDE}
      `),
      hogql<AllTimeRow>(`
        SELECT
          toInt(countIf(event = 'puzzle_started')) AS total_started,
          toInt(countIf(event = 'puzzle_solved')) AS total_solved,
          toInt(countIf(event = 'puzzle_revealed')) AS total_revealed,
          toInt(uniqIf(distinct_id, event IN ('$pageview', 'puzzle_started'))) AS unique_visitors,
          toInt(uniqIf(distinct_id, event = 'puzzle_started')) AS unique_players,
          toInt(uniqIf(distinct_id, event = 'puzzle_solved')) AS unique_solvers,
          toInt(sumIf(toInt(toString(properties.moves)), event = 'puzzle_solved')) AS total_moves,
          toInt(countIf(event = 'puzzle_solved' AND toString(properties.bonus) = 'true')) AS bonus,
          toInt(maxIf(toInt(toString(properties.streak)), event = 'puzzle_solved')) AS top_streak
        FROM events
        WHERE 1=1${EXCLUDE}
      `),
      hogql<BiggestDayRow>(`
        SELECT toString(toDate(timestamp)) AS day,
          toInt(count()) AS solves
        FROM events
        WHERE event = 'puzzle_solved'${EXCLUDE}
        GROUP BY day
        ORDER BY solves DESC
        LIMIT 1
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
      hogql<TodayUniquesRow>(`
        SELECT
          toInt(uniqIf(distinct_id, event IN ('$pageview', 'puzzle_started'))) AS visitors,
          toInt(uniqIf(distinct_id, event = 'puzzle_started')) AS players,
          toInt(uniqIf(distinct_id, event = 'puzzle_solved')) AS solvers
        FROM events
        WHERE toDate(timestamp) = today()${EXCLUDE}
      `),
      hogql<DataSinceRow>(`
        SELECT toString(min(timestamp)) AS first_event
        FROM events
        WHERE 1=1${EXCLUDE}
      `),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const today = daily[0];
  // Single source of truth for today's solve count: read from the
  // daily query so the Big card and the social blurb agree.
  const todaySolvedAuthoritative = today?.solved ?? 0;
  const todayMeta = todayRows[0];
  const summ = summary[0];
  const at = allTime[0];
  const td = todayUniques[0];
  const big = biggestDay[0];
  const ret = returning[0];

  const todayTiersOrdered = sortTiers(todayTiers);
  const returningPct = ret?.total ? (ret.returning / ret.total) * 100 : 0;
  const allTimeSolveRate = at?.total_started ? (at.total_solved / at.total_started) * 100 : 0;
  const visitorEngageRate = at?.unique_visitors
    ? ((at.unique_players ?? 0) / at.unique_visitors) * 100
    : 0;
  const playerSolveRate = at?.unique_players
    ? ((at.unique_solvers ?? 0) / at.unique_players) * 100
    : 0;
  const totalTilesFlippedAllTime = (at?.total_moves ?? 0) * 2;

  const todayDate = todayUtc();
  const todayNum = puzzleNumber(todayDate, EPOCH);
  const todayPretty = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${todayDate}T00:00:00Z`));

  // Data-collection start. PostHog wasn't wired up on day 1 of the
  // puzzle, so all-time numbers undercount the early days.
  const firstEventTs = dataSince[0]?.first_event ?? null;
  const firstEventDate = firstEventTs ? firstEventTs.slice(0, 10) : null;
  const firstEventPuzzle = firstEventDate ? puzzleNumber(firstEventDate, EPOCH) : null;
  const firstEventLabel = firstEventDate
    ? `Data since ${firstEventDate}${firstEventPuzzle ? ` · puzzle #${firstEventPuzzle}` : ""}`
    : null;

  const social = buildSocialBlurb(
    todayMeta,
    todayTiersOrdered,
    todaySolvedAuthoritative,
    todayNum,
    todayPretty
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-light tracking-tight">Player activity</h1>
        {firstEventLabel && (
          <p className="text-[10px] text-[color:var(--color-muted)] mt-1">{firstEventLabel}</p>
        )}
      </div>

      {error ? (
        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-medium">Failed to load stats</p>
          <pre className="mt-2 whitespace-pre-wrap text-xs">{error}</pre>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
            <Hero
              label="Visitors"
              value={fmt(at?.unique_visitors ?? 0)}
              suffix="loaded the page"
              today={fmt(td?.visitors ?? 0)}
            />
            <Hero
              label="Engaged players"
              value={fmt(at?.unique_players ?? 0)}
              suffix={
                at?.unique_visitors
                  ? `${visitorEngageRate.toFixed(0)}% of visitors started a puzzle`
                  : "started a puzzle"
              }
              today={fmt(td?.players ?? 0)}
            />
            <Hero
              label="Solvers"
              value={fmt(at?.unique_solvers ?? 0)}
              suffix={
                at?.unique_players
                  ? `${playerSolveRate.toFixed(0)}% of players solved one`
                  : "solved at least one"
              }
              today={fmt(td?.solvers ?? 0)}
            />
          </section>

          <Section title="Daily trend" freshness="live">
            <DailyTrendChart data={dailyTrend} />
          </Section>

          <section className="mb-12">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-sm font-medium">Today’s social blurb</h2>
              <p className="text-[10px] text-[color:var(--color-muted)]">
                Click to select all · tweak before posting
              </p>
            </div>
            <pre className="whitespace-pre-wrap break-words p-5 rounded-md bg-[color:var(--color-cream)] border border-[color:var(--color-rule)] text-sm leading-relaxed font-[inherit] select-all cursor-text">
              {social}
            </pre>
          </section>

          <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-12">
            <Big label="Grids started today" value={today?.started ?? 0} />
            <Big label="Grids cracked today" value={todaySolvedAuthoritative} />
            <Big
              label="Fastest solve today"
              value={todayMeta?.fastest != null ? String(todayMeta.fastest) : "—"}
              suffix={todayMeta?.fastest != null ? "moves" : undefined}
            />
            <Big
              label="Bonus rate today"
              value={
                todayMeta?.solves
                  ? `${Math.round((todayMeta.bonus / todayMeta.solves) * 100)}%`
                  : "—"
              }
            />
          </section>

          <section className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-12">
            <Big
              label="Biggest day ever"
              value={big?.solves ? fmt(big.solves) : "—"}
              suffix={big?.day ? `solves · ${big.day}` : undefined}
            />
            <Big
              label="Top streak ever"
              value={at?.top_streak ? `${at.top_streak} 🔥` : "—"}
            />
            <Big
              label="Most-played player"
              value={ret?.top_player_solves ? `${ret.top_player_solves}×` : "—"}
              suffix="solves"
            />
            <Big
              label="Returning players"
              value={`${returningPct.toFixed(0)}%`}
              suffix={ret?.total ? `${fmt(ret.returning)}/${fmt(ret.total)}` : undefined}
            />
            <Big
              label="All-time solve rate"
              value={`${allTimeSolveRate.toFixed(0)}%`}
              suffix={
                at?.total_started
                  ? `${fmt(at.total_solved)}/${fmt(at.total_started)}`
                  : undefined
              }
            />
            <Big
              label="Tiles flipped"
              value={fmt(totalTilesFlippedAllTime)}
              suffix={`${fmt(at?.total_moves ?? 0)} swaps · all time`}
            />
          </section>
        </>
      )}
    </div>
  );
}

// Pre-formatted blurb for r/TesseraPuzzle / X / newsletter. Kept on
// the Overview page because that's the one place it shows.
function buildSocialBlurb(
  today: TodayRow | undefined,
  tiers: TierRow[],
  total: number,
  puzzleNum: number,
  prettyDate: string
): string {
  const lines: string[] = [];
  const header = `✨ Tessera #${puzzleNum} · ${prettyDate}`;

  if (!today || !today.solves) {
    lines.push(header);
    lines.push("");
    lines.push("Today's grid is fresh and waiting 🪄");
    lines.push("First crack at it gets bragging rights.");
    lines.push("");
    lines.push("tesserapuzzle.com");
    return lines.join("\n");
  }

  // Phrasing scales with solve count so the blurb reads less
  // formulaic on quiet days vs busy days.
  const solves = today.solves;
  const headlineLine =
    solves === 1
      ? "1 brave soul cracked today's grid 🎯"
      : solves <= 5
      ? `${solves} early birds cracked today's grid 🎯`
      : solves <= 50
      ? `${solves} of you cracked today's grid 🎯`
      : `${solves.toLocaleString()} grids cracked today 🎯`;

  lines.push(header);
  lines.push("");
  lines.push(headlineLine);
  if (today.fastest != null) {
    const flair =
      today.fastest <= 8 ? " (chef's kiss 👨‍🍳)" : today.fastest <= 12 ? " ⚡" : " ⚡";
    lines.push(`Fastest solve: ${today.fastest} moves${flair}`);
  }
  if (today.bonus > 0) {
    lines.push(
      today.bonus === 1 ? "1 perfect bonus grid ✦" : `${today.bonus} perfect bonus grids ✦`
    );
  }

  if (total > 0) {
    const top = tiers
      .filter((t) => t.solves > 0)
      .map((t) => `${Math.round((t.solves / total) * 100)}% ${t.tier}`)
      .slice(0, 3)
      .join(" · ");
    if (top) {
      lines.push("");
      lines.push(`🏆 ${top}`);
    }
  }

  if (today.top_streak && today.top_streak >= 3) {
    lines.push(`🔥 Top streak today: ${today.top_streak} days`);
  }

  lines.push("");
  lines.push("New grid drops at UTC midnight.");
  lines.push("tesserapuzzle.com");
  return lines.join("\n");
}
