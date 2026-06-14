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
import { cachedHogql } from "../../lib/posthog-api";
import { puzzleNumber, todayUtc } from "../../lib/rng";
import { EXCLUDE } from "../_lib";
import { Hero, Big, Section, fmt, sortTiers, TIER_SQL, MODE_SQL, type TierRow } from "../_components";
import { DailyTrendChart } from "./DailyTrendChart";
import { SocialBlurbTabs } from "./SocialBlurbTabs";

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
  solvers: number;
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
// Per-day solver retention, derived from the streak property on
// puzzle_solved. PostHog runs cookieless by default (memory persistence,
// distinct_id resets every session), so cross-day identity joins are
// structurally impossible for the ~99% of players who never opt into
// analytics. The streak counter lives in localStorage independent of
// consent, and recordWin only increments it when yesterday's puzzle was
// also solved — so a solve today with streak >= 2 *is* a player who came
// back from yesterday. `returned` = solves today with streak >= 2;
// `solvers` = all solves today. Retention = returned / solvers.
type ReturnedRow = { day: string; returned: number; solvers: number };
// Streak-derived habit metrics over the last 30 days of solves. See the
// query comment for how each field is built. avg_dau / mau is the
// stickiness estimate; returning / total is the repeat-play share.
type StickinessRow = {
  avg_dau: number | null;
  mau: number;
  returning: number;
  total: number;
};
// Headline "% of solvers with a personal-best streak of 7+ days".
// Computed as a single number on the server so the Overview card
// doesn't pull the full histogram (that lives on /stats/players).
type SevenPlusStreakRow = { seven_plus: number; total_solvers: number };
// Share rate: count of share_clicked events ÷ count of puzzle_solved
// events over the same 30-day window. Both pulled in one row so the
// ratio stays consistent. share_clicked landed on 2026-05-10, so the
// 30-day backfill is empty for older windows; the dashboard renders
// "—" in that case rather than a misleading 0%.
type ShareRateRow = { shares: number; solves: number; since: string | null };

export default async function StatsOverviewPage() {
  let daily: DailyRow[] = [];
  let dailyTrend: DailyTrendRow[] = [];
  let todayRows: TodayRow[] = [];
  let todayTiers: TierRow[] = [];
  let todayHardRows: TodayRow[] = [];
  let todayHardTiers: TierRow[] = [];
  let todayClassicSolvedRows: { solved: number }[] = [];
  let todayHardSolvedRows: { solved: number }[] = [];
  let summary: SummaryRow[] = [];
  let allTime: AllTimeRow[] = [];
  let biggestDay: BiggestDayRow[] = [];
  let returning: ReturningRow[] = [];
  let todayUniques: TodayUniquesRow[] = [];
  let dataSince: DataSinceRow[] = [];
  let returned: ReturnedRow[] = [];
  let stickiness: StickinessRow[] = [];
  let sevenPlusStreak: SevenPlusStreakRow[] = [];
  let shareRate: ShareRateRow[] = [];
  let error: string | null = null;
  // Today's puzzle number is the source of truth for every "today"
  // query below. Without this filter, late solvers of yesterday's
  // puzzle (UTC rollover stragglers) leak into today's rows and the
  // social blurb ends up describing the wrong puzzle.
  const todayPuzzleNum = puzzleNumber(todayUtc(), EPOCH);
  try {
    [
      daily,
      dailyTrend,
      todayRows,
      todayTiers,
      todayHardRows,
      todayHardTiers,
      todayClassicSolvedRows,
      todayHardSolvedRows,
      summary,
      allTime,
      biggestDay,
      returning,
      todayUniques,
      dataSince,
      returned,
      stickiness,
      sevenPlusStreak,
      shareRate,
    ] = await Promise.all([
      cachedHogql<DailyRow>(`
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
      // Trend over the launch window. All three series are unique
      // distinct_ids per day so they line up with the Hero counts
      // (visitors / engaged players / solvers) — the chart is the
      // trend version of the heroes, not a separate "events" view.
      // Pull 90d server-side; the chart's range pills (7/30/90)
      // slice client-side so switching is instant.
      cachedHogql<DailyTrendRow>(`
        SELECT toString(toDate(timestamp)) AS day,
          toInt(uniqIf(distinct_id, event IN ('$pageview', 'puzzle_started'))) AS visitors,
          toInt(uniqIf(distinct_id, event = 'puzzle_started')) AS players,
          toInt(uniqIf(distinct_id, event = 'puzzle_solved')) AS solvers
        FROM events
        WHERE timestamp >= now() - INTERVAL 90 DAY${EXCLUDE}
        GROUP BY day
        ORDER BY day ASC
      `),
      // Today's per-puzzle stats, split by mode so each mode has its
      // own social blurb (tab-switched on the page). Pooling Classic
      // and Hard would muddy the "fastest 8 moves" headline — same
      // move count means very different things across modes.
      cachedHogql<TodayRow>(`
        SELECT toInt(toString(properties.num)) AS num,
          toInt(count()) AS solves,
          toInt(min(toInt(toString(properties.moves)))) AS fastest,
          round(avg(toInt(toString(properties.moves))), 1) AS avg_moves,
          toInt(countIf(toString(properties.bonus) = 'true')) AS bonus,
          toInt(max(toInt(toString(properties.streak)))) AS top_streak
        FROM events
        WHERE event = 'puzzle_solved'
          AND toDate(timestamp) = today()
          AND toInt(toString(properties.num)) = ${todayPuzzleNum}
          AND ${MODE_SQL} = 'classic'${EXCLUDE}
        GROUP BY num
      `),
      // Today's tier rows feed the social blurb's "🏆 X% Legendary
      // · ..." line. One query per mode so each blurb's percentages
      // total 100% within its own mode.
      cachedHogql<TierRow>(`
        SELECT ${TIER_SQL} AS tier, toInt(count()) AS solves
        FROM events
        WHERE event = 'puzzle_solved'
          AND toDate(timestamp) = today()
          AND toInt(toString(properties.num)) = ${todayPuzzleNum}
          AND ${MODE_SQL} = 'classic'${EXCLUDE}
        GROUP BY tier
      `),
      cachedHogql<TodayRow>(`
        SELECT toInt(toString(properties.num)) AS num,
          toInt(count()) AS solves,
          toInt(min(toInt(toString(properties.moves)))) AS fastest,
          round(avg(toInt(toString(properties.moves))), 1) AS avg_moves,
          toInt(countIf(toString(properties.bonus) = 'true')) AS bonus,
          toInt(max(toInt(toString(properties.streak)))) AS top_streak
        FROM events
        WHERE event = 'puzzle_solved'
          AND toDate(timestamp) = today()
          AND toInt(toString(properties.num)) = ${todayPuzzleNum}
          AND ${MODE_SQL} = 'hard'${EXCLUDE}
        GROUP BY num
      `),
      cachedHogql<TierRow>(`
        SELECT ${TIER_SQL} AS tier, toInt(count()) AS solves
        FROM events
        WHERE event = 'puzzle_solved'
          AND toDate(timestamp) = today()
          AND toInt(toString(properties.num)) = ${todayPuzzleNum}
          AND ${MODE_SQL} = 'hard'${EXCLUDE}
        GROUP BY tier
      `),
      // Authoritative per-mode solve counts for today. The per-num
      // TodayRow queries above split today's events into rows by
      // properties.num, so taking [0] under-counts whenever stray
      // events (other nums, missing props) sneak in. The social blurb
      // uses these for both the headline solve count and the
      // tier-percentage divisor so percentages can't exceed 100%.
      cachedHogql<{ solved: number }>(`
        SELECT toInt(count()) AS solved
        FROM events
        WHERE event = 'puzzle_solved'
          AND toDate(timestamp) = today()
          AND toInt(toString(properties.num)) = ${todayPuzzleNum}
          AND ${MODE_SQL} = 'classic'${EXCLUDE}
      `),
      cachedHogql<{ solved: number }>(`
        SELECT toInt(count()) AS solved
        FROM events
        WHERE event = 'puzzle_solved'
          AND toDate(timestamp) = today()
          AND toInt(toString(properties.num)) = ${todayPuzzleNum}
          AND ${MODE_SQL} = 'hard'${EXCLUDE}
      `),
      cachedHogql<SummaryRow>(`
        SELECT
          toInt(count()) AS total_solves,
          toInt(countIf(toString(properties.bonus) = 'true')) AS bonus_solves,
          toInt(sumIf(toInt(toString(properties.moves)), timestamp >= now() - INTERVAL 7 DAY)) AS total_moves_week,
          toInt(max(toInt(toString(properties.streak)))) AS top_streak,
          toInt(uniq(distinct_id)) AS unique_solvers
        FROM events
        WHERE event = 'puzzle_solved' AND timestamp >= now() - INTERVAL 90 DAY${EXCLUDE}
      `),
      cachedHogql<AllTimeRow>(`
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
      cachedHogql<BiggestDayRow>(`
        SELECT toString(toDate(timestamp)) AS day,
          toInt(count()) AS solves
        FROM events
        WHERE event = 'puzzle_solved'${EXCLUDE}
        GROUP BY day
        ORDER BY solves DESC
        LIMIT 1
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
      cachedHogql<TodayUniquesRow>(`
        SELECT
          toInt(uniqIf(distinct_id, event IN ('$pageview', 'puzzle_started'))) AS visitors,
          toInt(uniqIf(distinct_id, event = 'puzzle_started')) AS players,
          toInt(uniqIf(distinct_id, event = 'puzzle_solved')) AS solvers
        FROM events
        WHERE toDate(timestamp) = today()${EXCLUDE}
      `),
      cachedHogql<DataSinceRow>(`
        SELECT toString(min(timestamp)) AS first_event
        FROM events
        WHERE 1=1${EXCLUDE}
      `),
      // Per-day solver retention via the streak property (see ReturnedRow).
      // streak >= 2 means yesterday's puzzle was also solved, so this is a
      // genuine day-over-day return signal that survives cookieless mode.
      cachedHogql<ReturnedRow>(`
        SELECT
          toString(toDate(timestamp)) AS day,
          toInt(countIf(toInt(properties.streak) >= 2)) AS returned,
          toInt(count()) AS solvers
        FROM events
        WHERE event = 'puzzle_solved'${EXCLUDE}
          AND timestamp >= now() - INTERVAL 16 DAY
        GROUP BY day
        ORDER BY day DESC
        LIMIT 16
      `),
      // Habit metrics from the streak property — DAU/MAU by distinct_id is
      // meaningless cookieless (rotating ids inflate MAU ~5x). Over the last
      // 30 days of solves (one per player per day):
      //   solves        = total solves (avg/30 = avg daily solvers = DAU)
      //   run_starts    = solves with streak == 1, i.e. a streak beginning
      //                   (first play or return after a gap). Stands in for
      //                   monthly unique players — far closer than the
      //                   rotating-id MAU, though it double-counts players
      //                   who lapse and restart within the window.
      //   returning     = solves with streak >= 2 (continued from yesterday)
      cachedHogql<StickinessRow>(`
        SELECT
          round(count() / 30.0, 1) AS avg_dau,
          toInt(countIf(toInt(properties.streak) = 1)) AS mau,
          toInt(countIf(toInt(properties.streak) >= 2)) AS returning,
          toInt(count()) AS total
        FROM events
        WHERE event = 'puzzle_solved'${EXCLUDE}
          AND toInt(properties.streak) >= 1
          AND timestamp >= now() - INTERVAL 30 DAY
      `),
      // Headline streak metric: of all-time solvers, how many have hit
      // a personal-best streak of 7+ days. Mirrors the histogram on
      // /stats/players but returns just the two numbers we render.
      cachedHogql<SevenPlusStreakRow>(`
        SELECT
          toInt(countIf(max_streak >= 7)) AS seven_plus,
          toInt(count()) AS total_solvers
        FROM (
          SELECT distinct_id,
            toInt(max(toIntOrZero(toString(properties.streak)))) AS max_streak
          FROM events
          WHERE event = 'puzzle_solved'${EXCLUDE}
          GROUP BY distinct_id
        )
      `),
      // Share rate: share_clicked events ÷ puzzle_solved events. Both
      // numerator and denominator are bounded to the date share_clicked
      // first fired (2026-05-10 in practice, but read dynamically so it
      // self-corrects), so the denominator can't include solves from
      // days when sharing wasn't tracked yet. Comparing N days of shares
      // against 30 days of solves would lowball the rate by ~5x in the
      // first month. The dashboard shows "—" rather than 0% when shares
      // is 0 to avoid presenting a missing-data state as a real metric.
      cachedHogql<ShareRateRow>(`
        WITH first_share AS (
          SELECT min(timestamp) AS ts
          FROM events
          WHERE event = 'share_clicked'${EXCLUDE}
        )
        SELECT
          toInt(countIf(event = 'share_clicked')) AS shares,
          toInt(countIf(event = 'puzzle_solved' AND timestamp >= (SELECT ts FROM first_share))) AS solves,
          formatDateTime((SELECT ts FROM first_share), '%Y-%m-%d') AS since
        FROM events
        WHERE event IN ('share_clicked', 'puzzle_solved')${EXCLUDE}
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
  const allTimeSolveRate = at?.total_started ? (at.total_solved / at.total_started) * 100 : 0;
  const visitorEngageRate = at?.unique_visitors
    ? ((at.unique_players ?? 0) / at.unique_visitors) * 100
    : 0;
  const playerSolveRate = at?.unique_players
    ? ((at.unique_solvers ?? 0) / at.unique_players) * 100
    : 0;
  const totalTilesFlippedAllTime = (at?.total_moves ?? 0) * 2;

  // Day-over-day retention, streak-based (see ReturnedRow). For each day:
  //   retention[d] = returned[d] / solvers[d]
  //                = share of today's solvers whose streak >= 2, i.e. who
  //                  also solved yesterday's puzzle.
  // We average the last 7 days for the headline and surface yesterday's
  // value as suffix context. Today is excluded because it's still
  // accumulating solves and would understate the rate.
  const retByDay = new Map(returned.map((r) => [r.day, r]));
  const retentionDaily: { day: string; pct: number }[] = [];
  const todayIso = todayUtc();
  for (let i = 1; i <= 8 && retentionDaily.length < 7; i++) {
    const d = new Date(`${todayIso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - i);
    const day = d.toISOString().slice(0, 10);
    const row = retByDay.get(day);
    if (row && row.solvers > 0) {
      retentionDaily.push({ day, pct: (row.returned / row.solvers) * 100 });
    }
  }
  const retention7d = retentionDaily.length
    ? retentionDaily.reduce((s, r) => s + r.pct, 0) / retentionDaily.length
    : null;
  const retentionYesterday = retentionDaily[0]?.pct ?? null;

  // Habit metrics from the streak property (see the query). Stickiness =
  // avg daily solvers / monthly run-starts (a cookieless-proof MAU proxy);
  // >20% is a real daily habit, >50% is Wordle-tier. Returning = share of
  // solves continuing a streak. Both null-guard against an empty window.
  const stick = stickiness[0];
  const stickinessPct =
    stick?.avg_dau != null && stick.mau > 0 ? (stick.avg_dau / stick.mau) * 100 : null;
  const returningPct = stick?.total ? (stick.returning / stick.total) * 100 : 0;

  const sps = sevenPlusStreak[0];
  const sevenPlusPct =
    sps && sps.total_solvers > 0 ? (sps.seven_plus / sps.total_solvers) * 100 : null;

  const sr = shareRate[0];
  const sharePct = sr && sr.shares > 0 && sr.solves > 0 ? (sr.shares / sr.solves) * 100 : null;

  const todayDate = todayUtc();
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

  const todayHardMeta = todayHardRows[0];
  const todayHardTiersOrdered = sortTiers(todayHardTiers);
  const todayClassicSolved = todayClassicSolvedRows[0]?.solved ?? 0;
  const todayHardSolved = todayHardSolvedRows[0]?.solved ?? 0;

  const socialClassic = buildSocialBlurb(
    todayMeta,
    todayTiersOrdered,
    todayClassicSolved,
    todayPuzzleNum,
    todayPretty,
    "classic"
  );
  const socialHard = buildSocialBlurb(
    todayHardMeta,
    todayHardTiersOrdered,
    todayHardSolved,
    todayPuzzleNum,
    todayPretty,
    "hard"
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
              tooltip="Distinct browsers (PostHog distinct_id) that loaded the page or started a puzzle. Same person on phone + laptop counts twice; ad-block-evading union of $pageview and puzzle_started."
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
              tooltip="Distinct browsers that started at least one puzzle. Subset of Visitors. The percentage shows what share of visitors got past the start screen."
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
              tooltip="Distinct browsers that solved at least one puzzle. Subset of Engaged players. The percentage is the player-to-solver conversion."
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
            <SocialBlurbTabs classic={socialClassic} hard={socialHard} />
          </section>

          <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-12">
            <Big
              label="Grids started today"
              value={today?.started ?? 0}
              tooltip="Total puzzle_started events today across all puzzles and modes. Counts replays and refreshes, not unique players. For unique players today see the Engaged players Hero."
            />
            <Big
              label="Grids cracked today"
              value={todaySolvedAuthoritative}
              tooltip="Total puzzle_solved events today across all puzzles. Includes re-solves of older puzzles via the history menu, so this can exceed the number of unique solvers today."
            />
            <Big
              label="Fastest solve today"
              value={todayMeta?.fastest != null ? String(todayMeta.fastest) : "—"}
              suffix={todayMeta?.fastest != null ? "moves" : undefined}
              tooltip="Lowest move count among solves of today's puzzle (Classic mode only). Hard mode is excluded so the social blurb's headline stays comparable day to day."
            />
            <Big
              label="Solve rate today"
              value={
                td?.players
                  ? `${Math.round((td.solvers / td.players) * 100)}%`
                  : "—"
              }
              suffix={
                td?.players
                  ? `${td.solvers} of ${td.players} players`
                  : undefined
              }
              tooltip="Today's unique solvers ÷ today's unique players who started a puzzle. Both are distinct-browser counts."
            />
          </section>

          <section className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-12">
            <Big
              label="Biggest day ever"
              value={big?.solves ? fmt(big.solves) : "—"}
              suffix={big?.day ? `solves · ${big.day}` : undefined}
              tooltip="The single calendar day (UTC) with the most puzzle_solved events recorded."
            />
            <Big
              label="Top streak ever"
              value={at?.top_streak ? `${at.top_streak} 🔥` : "—"}
              tooltip="Longest consecutive-day solve streak any single player has reached. The streak counter increments client-side and is sent with each puzzle_solved event."
            />
            <Big
              label="Most-played player"
              value={ret?.top_player_solves ? `${ret.top_player_solves}×` : "—"}
              suffix="solves"
              tooltip="Total puzzle_solved events for the most prolific browser. Includes replays."
            />
            <Big
              label="Returning players"
              value={`${returningPct.toFixed(0)}%`}
              suffix={
                stick?.total ? `${fmt(stick.returning)}/${fmt(stick.total)} solves` : undefined
              }
              tooltip="Share of the last 30 days' solves played by someone continuing a streak (streak 2+, so they solved the day before too). Read from the streak counter in localStorage, which survives our cookieless analytics — unlike a distinct_id count, which rotates every session and can't tell a returning player from a new one."
            />
            <Big
              label="Stickiness (DAU/MAU)"
              value={stickinessPct != null ? `${stickinessPct.toFixed(0)}%` : "—"}
              suffix={
                stick && stick.avg_dau != null && stick.mau > 0
                  ? `${fmt(Math.round(stick.avg_dau))} DAU / ~${fmt(stick.mau)} MAU est.`
                  : undefined
              }
              tooltip="DAU/MAU daily-habit ratio. DAU = avg daily solvers over 30 days. True MAU (unique monthly players) is unmeasurable under cookieless analytics — distinct_id resets each session — so MAU is estimated as the number of streak runs started in the window (each a player beginning or resuming a streak). Rough, but far closer than the ~5x-inflated rotating-id count. Benchmarks: >20% real habit; >50% Wordle-tier. Treat as directional."
            />
            <Big
              label="Share rate"
              value={sharePct != null ? `${sharePct.toFixed(0)}%` : "—"}
              suffix={
                sr && sr.solves > 0
                  ? `${fmt(sr.shares)} shares / ${fmt(sr.solves)} solves${
                      sr.since ? ` · since ${sr.since}` : ""
                    }`
                  : undefined
              }
              tooltip="Share-clicked events as a share of solves since share tracking began (2026-05-10). The denominator is bounded to the same window as the numerator so the rate isn't diluted by older solves with no shares to compare against. Tracks the Wordle-style 'I want to brag' loop, the closest thing to a free-acquisition channel for a daily puzzle. A healthy daily puzzle sits in the 5 to 15% range."
            />
            <Big
              label="7+ day streakers"
              value={sevenPlusPct != null ? `${sevenPlusPct.toFixed(0)}%` : "—"}
              suffix={
                sps && sps.total_solvers > 0
                  ? `${fmt(sps.seven_plus)} of ${fmt(sps.total_solvers)} solvers`
                  : undefined
              }
              tooltip="Share of all-time solvers whose personal-best streak is 7 days or more. The visceral 'this is a daily habit' number. Hard to fake: a player only reaches 7 by showing up every day for a week. Full distribution on /stats/players."
            />
            <Big
              label="Daily retention"
              value={retention7d != null ? `${retention7d.toFixed(0)}%` : "—"}
              suffix={
                retentionYesterday != null
                  ? `7-day avg · yesterday ${retentionYesterday.toFixed(0)}%`
                  : undefined
              }
              tooltip="Day-over-day retention: of today's solvers, the share whose streak is 2+, meaning they also solved yesterday's puzzle. Headline averages the last 7 days; suffix is yesterday alone. Read from the streak counter (localStorage), which survives our cookieless analytics, so unlike a distinct_id join this counts anonymous returning players too. For weekly cohorts (D1/D7/D30) see /stats/cohorts."
            />
            <Big
              label="All-time solve rate"
              value={`${allTimeSolveRate.toFixed(0)}%`}
              suffix={
                at?.total_started
                  ? `${fmt(at.total_solved)}/${fmt(at.total_started)}`
                  : undefined
              }
              tooltip="Total puzzle_solved events ÷ total puzzle_started events, all time. Event-level (not unique-player), so replays inflate both numerator and denominator."
            />
            <Big
              label="Tiles flipped"
              value={fmt(totalTilesFlippedAllTime)}
              suffix={`${fmt(at?.total_moves ?? 0)} swaps · all time`}
              tooltip="Total tiles moved across every solve. Each swap moves 2 tiles, so this is the swap count × 2. Vanity number for the social blurb."
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
  prettyDate: string,
  mode: "classic" | "hard"
): string {
  const lines: string[] = [];
  const modeTag = mode === "hard" ? " · Hard" : "";
  const header = `✨ Tessera #${puzzleNum}${modeTag} · ${prettyDate}`;
  const cta = "Think you can do better? tesserapuzzle.com";

  if (!today || total <= 0) {
    lines.push(header);
    lines.push("");
    lines.push(
      mode === "hard"
        ? "Hard mode is wide open today 🪄"
        : "Today's grid is fresh and waiting 🪄"
    );
    lines.push("First crack at it gets bragging rights.");
    lines.push("");
    lines.push(cta);
    return lines.join("\n");
  }

  // Phrasing scales with solve count so the blurb reads less
  // formulaic on quiet days vs busy days. `total` is the
  // mode-scoped authoritative count for today; `today.solves`
  // is per-num and can under-count if stray events leak in.
  const solves = total;
  const grid = mode === "hard" ? "Hard grid" : "grid";
  const gridsPlural = mode === "hard" ? "Hard grids" : "grids";
  const headlineLine =
    solves === 1
      ? `1 brave soul cracked today's ${grid} 🎯`
      : solves <= 5
      ? `${solves} early birds cracked today's ${grid} 🎯`
      : solves <= 50
      ? `${solves} of you cracked today's ${grid} 🎯`
      : `${solves.toLocaleString()} ${gridsPlural} cracked today 🎯`;

  lines.push(header);
  lines.push("");
  lines.push(headlineLine);
  if (today.fastest != null) {
    // Hard-mode threshold is tighter because Hard solves trend longer.
    const fast = today.fastest;
    const kiss =
      mode === "hard" ? fast <= 12 : fast <= 8;
    const flair = kiss ? " (chef's kiss 👨‍🍳)" : " ⚡";
    lines.push(`Fastest solve: ${fast} moves${flair}`);
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
  lines.push(cta);
  return lines.join("\n");
}
