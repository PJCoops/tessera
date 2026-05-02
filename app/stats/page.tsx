import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hogql } from "../lib/posthog-api";
import { puzzleNumber, todayUtc } from "../lib/rng";

const EPOCH = "2026-04-27"; // Tessera #1, mirrors TesseraGame.tsx

export const metadata: Metadata = {
  title: "Stats",
  robots: { index: false, follow: false },
};

// Always fetch fresh-ish data; underlying hogql() caches each query 5 min.
// Refreshes pull from PostHog when the cache window expires.
export const dynamic = "force-dynamic";

const COOKIE_NAME = "stats_auth";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

// Comma-separated PostHog distinct_ids to exclude from every query, so your
// own test sessions don't pollute the dashboard. Append new IDs as you test
// from new devices (find them in PostHog → Activity → click any event).
function buildExcludeClause(): string {
  const raw = process.env.STATS_EXCLUDE_IDS;
  if (!raw) return "";
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    // Defensive: HogQL strings are single-quoted, so escape any embedded
    // single quotes.
    .map((id) => `'${id.replace(/'/g, "''")}'`);
  if (ids.length === 0) return "";
  return ` AND distinct_id NOT IN (${ids.join(",")})`;
}
const EXCLUDE = buildExcludeClause();

async function signIn(formData: FormData) {
  "use server";
  const token = String(formData.get("t") ?? "");
  const expected = process.env.STATS_TOKEN;
  if (!expected || token !== expected) {
    redirect("/stats?e=1");
  }
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/stats",
  });
  redirect("/stats");
}

async function signOut() {
  "use server";
  const jar = await cookies();
  jar.delete({ name: COOKIE_NAME, path: "/stats" });
  redirect("/stats");
}

// Mirrors lib/tier.ts. Kept inline as a SQL fragment for HogQL multiIf().
// If tier ranges change in lib/tier.ts, update both places.
const TIER_ORDER = ["Legendary", "Genius", "Wordsmith", "Persistent", "Tenacious"] as const;
const TIER_COLORS: Record<(typeof TIER_ORDER)[number], string> = {
  Legendary: "#d9b25a",
  Genius: "#7a9070",
  Wordsmith: "#5b8aa8",
  Persistent: "#a87a5b",
  Tenacious: "#7a6f8a",
};
const TIER_SQL = `
  multiIf(
    toInt(toString(properties.moves)) <= 10, 'Legendary',
    toInt(toString(properties.moves)) <= 20, 'Genius',
    toInt(toString(properties.moves)) <= 35, 'Wordsmith',
    toInt(toString(properties.moves)) <= 60, 'Persistent',
    'Tenacious'
  )
`;

type DailyRow = { day: string; started: number; solved: number; revealed: number };
type MovesRow = { moves: number | null; solves: number };
type HintsRow = { enabled: unknown; toggles: number; users: number };
type PuzzleRow = {
  num: number | null;
  solves: number;
  avg_moves: number | null;
  median_moves: number | null;
};
type TierRow = { tier: string; solves: number };
type TodayRow = {
  num: number | null;
  solves: number;
  fastest: number | null;
  avg_moves: number | null;
  bonus: number;
  top_streak: number | null;
};
type ExtremeRow = { num: number | null; solves: number; avg_moves: number | null };
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
  bonus_solves: number;
  top_streak: number | null;
};
type BiggestDayRow = { day: string; solves: number };
type ReturningRow = { returning: number; total: number; top_player_solves: number };
type RecentIdRow = { distinct_id: string; events: number; first_seen: string; last_seen: string };
type CohortRow = {
  cohort_week: string;
  cohort_size: number;
  d1: number;
  d3: number;
  d7: number;
  d14: number;
  d30: number;
};

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string }>;
}) {
  const params = await searchParams;
  const expected = process.env.STATS_TOKEN;
  const cookieToken = (await cookies()).get(COOKIE_NAME)?.value;
  if (!expected || cookieToken !== expected) {
    return <Login error={params.e === "1"} />;
  }

  let daily: DailyRow[] = [];
  let moves: MovesRow[] = [];
  let hints: HintsRow[] = [];
  let puzzles: PuzzleRow[] = [];
  let todayTiers: TierRow[] = [];
  let allTiers: TierRow[] = [];
  let todayRows: TodayRow[] = [];
  let hardest: ExtremeRow[] = [];
  let easiest: ExtremeRow[] = [];
  let summary: SummaryRow[] = [];
  let allTime: AllTimeRow[] = [];
  let biggestDay: BiggestDayRow[] = [];
  let returning: ReturningRow[] = [];
  let recentIds: RecentIdRow[] = [];
  let cohorts: CohortRow[] = [];
  let error: string | null = null;
  try {
    [
      daily,
      moves,
      hints,
      puzzles,
      todayTiers,
      allTiers,
      todayRows,
      hardest,
      easiest,
      summary,
      allTime,
      biggestDay,
      returning,
      recentIds,
      cohorts,
    ] = await Promise.all([
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
        hogql<HintsRow>(`
          SELECT properties.enabled AS enabled,
            toInt(count()) AS toggles,
            toInt(uniq(distinct_id)) AS users
          FROM events
          WHERE event = 'hide_hints_toggled' AND timestamp >= now() - INTERVAL 30 DAY${EXCLUDE}
          GROUP BY enabled
        `),
        hogql<PuzzleRow>(`
          SELECT toInt(toString(properties.num)) AS num,
            toInt(count()) AS solves,
            round(avg(toInt(toString(properties.moves))), 1) AS avg_moves,
            quantile(0.5)(toInt(toString(properties.moves))) AS median_moves
          FROM events
          WHERE event = 'puzzle_solved' AND timestamp >= now() - INTERVAL 30 DAY${EXCLUDE}
          GROUP BY num
          HAVING num IS NOT NULL
          ORDER BY num DESC
          LIMIT 14
        `),
        hogql<TierRow>(`
          SELECT ${TIER_SQL} AS tier, toInt(count()) AS solves
          FROM events
          WHERE event = 'puzzle_solved' AND toDate(timestamp) = today()${EXCLUDE}
          GROUP BY tier
        `),
        hogql<TierRow>(`
          SELECT ${TIER_SQL} AS tier, toInt(count()) AS solves
          FROM events
          WHERE event = 'puzzle_solved' AND timestamp >= now() - INTERVAL 30 DAY${EXCLUDE}
          GROUP BY tier
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
        hogql<ExtremeRow>(`
          SELECT toInt(toString(properties.num)) AS num,
            toInt(count()) AS solves,
            round(avg(toInt(toString(properties.moves))), 1) AS avg_moves
          FROM events
          WHERE event = 'puzzle_solved' AND timestamp >= now() - INTERVAL 30 DAY${EXCLUDE}
          GROUP BY num
          HAVING solves >= 5
          ORDER BY avg_moves DESC
          LIMIT 1
        `),
        hogql<ExtremeRow>(`
          SELECT toInt(toString(properties.num)) AS num,
            toInt(count()) AS solves,
            round(avg(toInt(toString(properties.moves))), 1) AS avg_moves
          FROM events
          WHERE event = 'puzzle_solved' AND timestamp >= now() - INTERVAL 30 DAY${EXCLUDE}
          GROUP BY num
          HAVING solves >= 5
          ORDER BY avg_moves ASC
          LIMIT 1
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
            toInt(uniqIf(distinct_id, event = '$pageview')) AS unique_visitors,
            toInt(uniqIf(distinct_id, event = 'puzzle_started')) AS unique_players,
            toInt(uniqIf(distinct_id, event = 'puzzle_solved')) AS unique_solvers,
            toInt(sumIf(toInt(toString(properties.moves)), event = 'puzzle_solved')) AS total_moves,
            toInt(countIf(event = 'puzzle_solved' AND toString(properties.bonus) = 'true')) AS bonus_solves,
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
        // Diagnostic: NOT filtered by EXCLUDE so we can see *all* recently
        // active distinct_ids and identify which ones are us.
        hogql<RecentIdRow>(`
          SELECT distinct_id,
            toInt(count()) AS events,
            toString(min(timestamp)) AS first_seen,
            toString(max(timestamp)) AS last_seen
          FROM events
          WHERE timestamp >= now() - INTERVAL 7 DAY
          GROUP BY distinct_id
          ORDER BY events DESC
          LIMIT 20
        `),
        // Cohort retention. For each player, find the day of their first
        // puzzle_started, bucket into ISO weeks, then count how many of
        // that cohort fired any puzzle_started event N days later.
        // Limited to the most recent 8 cohort-weeks; older ones are too
        // sparse and clutter the table.
        // distinct_id is device-scoped so cross-device players inflate
        // cohort size and understate retention — accepted as directional
        // until we can identify by email.
        hogql<CohortRow>(`
          WITH player_first AS (
            SELECT distinct_id, min(toDate(timestamp)) AS first_day
            FROM events
            WHERE event = 'puzzle_started'${EXCLUDE}
            GROUP BY distinct_id
          ),
          activity AS (
            SELECT distinct distinct_id, toDate(timestamp) AS day
            FROM events
            WHERE event = 'puzzle_started'${EXCLUDE}
          )
          SELECT toString(toStartOfWeek(pf.first_day)) AS cohort_week,
            toInt(uniq(pf.distinct_id)) AS cohort_size,
            toInt(uniqIf(pf.distinct_id, dateDiff('day', pf.first_day, a.day) = 1)) AS d1,
            toInt(uniqIf(pf.distinct_id, dateDiff('day', pf.first_day, a.day) = 3)) AS d3,
            toInt(uniqIf(pf.distinct_id, dateDiff('day', pf.first_day, a.day) = 7)) AS d7,
            toInt(uniqIf(pf.distinct_id, dateDiff('day', pf.first_day, a.day) = 14)) AS d14,
            toInt(uniqIf(pf.distinct_id, dateDiff('day', pf.first_day, a.day) = 30)) AS d30
          FROM player_first AS pf
          LEFT JOIN activity AS a ON pf.distinct_id = a.distinct_id
          WHERE pf.first_day >= today() - INTERVAL 56 DAY
          GROUP BY cohort_week
          ORDER BY cohort_week DESC
          LIMIT 8
        `),
      ]);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const today = daily[0];
  const todayMeta = todayRows[0];
  const summ = summary[0];
  const at = allTime[0];
  const big = biggestDay[0];
  const ret = returning[0];
  const returningPct = ret?.total ? (ret.returning / ret.total) * 100 : 0;
  const allTimeSolveRate = at?.total_started ? (at.total_solved / at.total_started) * 100 : 0;
  const visitorEngageRate = at?.unique_visitors
    ? ((at.unique_players ?? 0) / at.unique_visitors) * 100
    : 0;
  const playerSolveRate = at?.unique_players
    ? ((at.unique_solvers ?? 0) / at.unique_players) * 100
    : 0;
  const totalTilesFlippedAllTime = (at?.total_moves ?? 0) * 2;
  const totals = daily.reduce(
    (acc, d) => ({
      started: acc.started + (d.started ?? 0),
      solved: acc.solved + (d.solved ?? 0),
      revealed: acc.revealed + (d.revealed ?? 0),
    }),
    { started: 0, solved: 0, revealed: 0 }
  );
  const solveRate = totals.started ? (totals.solved / totals.started) * 100 : 0;
  const revealRate = totals.started ? (totals.revealed / totals.started) * 100 : 0;
  const dailyMax = Math.max(1, ...daily.map((d) => Math.max(d.started, d.solved, d.revealed)));
  const movesMax = Math.max(1, ...moves.map((m) => m.solves));

  // Sort tier rows into the canonical order so the bars always read
  // Legendary → Tenacious left to right.
  const sortTiers = (rows: TierRow[]) =>
    [...TIER_ORDER]
      .map((t) => rows.find((r) => r.tier === t) ?? { tier: t, solves: 0 })
      .filter(Boolean) as TierRow[];
  const todayTiersOrdered = sortTiers(todayTiers);
  const allTiersOrdered = sortTiers(allTiers);

  const todayTotal = todayTiersOrdered.reduce((s, r) => s + r.solves, 0);
  const allTotal = allTiersOrdered.reduce((s, r) => s + r.solves, 0);

  const bonusRate = summ?.total_solves
    ? (summ.bonus_solves / summ.total_solves) * 100
    : 0;
  const totalTilesFlippedWeek = (summ?.total_moves_week ?? 0) * 2;

  // Today's puzzle number, derived from UTC date so the blurb is correct
  // even when there are no solves yet.
  const todayDate = todayUtc();
  const todayNum = puzzleNumber(todayDate, EPOCH);
  const todayPretty = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${todayDate}T00:00:00Z`));
  // Always render the blurb (even with zero solves so far) so it's available
  // to copy-edit before posting.
  const social = buildSocialBlurb(
    todayMeta,
    todayTiersOrdered,
    todayTotal,
    todayNum,
    todayPretty
  );

  return (
    <div className="self-start w-full max-w-3xl">
      <header className="mb-8 flex items-baseline justify-between">
        <div>
          <p className="text-[var(--text-kicker)] uppercase tracking-[var(--tracking-kicker)] text-[color:var(--color-muted)]">
            Tessera · stats
          </p>
          <h1 className="text-2xl font-light tracking-tight mt-1">Player activity</h1>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-[color:var(--color-muted)] tabular-nums">
            Fetched {new Date().toISOString().slice(11, 19)} UTC
          </p>
          <form action={signOut}>
            <button
              type="submit"
              className="text-xs text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)] underline-offset-4 hover:underline"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      {error ? (
        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-medium">Failed to load stats</p>
          <pre className="mt-2 whitespace-pre-wrap text-xs">{error}</pre>
        </div>
      ) : (
        <>
          {/* HERO — all-time big numbers */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
            <Hero
              label="Visitors"
              value={fmt(at?.unique_visitors ?? 0)}
              suffix="loaded the page"
            />
            <Hero
              label="Engaged players"
              value={fmt(at?.unique_players ?? 0)}
              suffix={
                at?.unique_visitors
                  ? `${visitorEngageRate.toFixed(0)}% of visitors started a puzzle`
                  : "started a puzzle"
              }
            />
            <Hero
              label="Solvers"
              value={fmt(at?.unique_solvers ?? 0)}
              suffix={
                at?.unique_players
                  ? `${playerSolveRate.toFixed(0)}% of players solved one`
                  : "solved at least one"
              }
            />
          </section>

          {/* SOCIAL — pre-formatted blurb at the top so it's the first thing
             you see when checking the dashboard each morning. */}
          <section className="mb-12">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-sm font-medium">Today’s social blurb</h2>
              <p className="text-[10px] text-[color:var(--color-muted)]">Click to select all · tweak before posting</p>
            </div>
            <pre className="whitespace-pre-wrap break-words p-5 rounded-md bg-[color:var(--color-cream)] border border-[color:var(--color-rule)] text-sm leading-relaxed font-[inherit] select-all cursor-text">
              {social}
            </pre>
          </section>

          {/* SECONDARY — today + headline records */}
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-12">
            <Big label="Today started" value={today?.started ?? 0} />
            <Big label="Today solved" value={today?.solved ?? 0} />
            <Big
              label="Today fastest"
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

          {/* MARKETING — fun derived all-time stats */}
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
              label="Tiles flipped (all time)"
              value={fmt(totalTilesFlippedAllTime)}
              suffix={`${fmt(at?.total_moves ?? 0)} swaps`}
            />
          </section>


          {/* Today tier split */}
          <Section title={`Today’s tiers · ${todayTotal} solves`}>
            {todayTotal === 0 ? (
              <Empty />
            ) : (
              <TierBar rows={todayTiersOrdered} total={todayTotal} />
            )}
          </Section>

          {/* Highlights row */}
          <Section title="Highlights">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Highlight
                label="Hardest puzzle (30d)"
                value={hardest[0]?.num ? `#${hardest[0].num}` : "—"}
                sub={hardest[0]?.avg_moves != null ? `avg ${hardest[0].avg_moves} moves` : ""}
              />
              <Highlight
                label="Easiest puzzle (30d)"
                value={easiest[0]?.num ? `#${easiest[0].num}` : "—"}
                sub={easiest[0]?.avg_moves != null ? `avg ${easiest[0].avg_moves} moves` : ""}
              />
              <Highlight
                label="Top streak (90d)"
                value={summ?.top_streak ? `${summ.top_streak} 🔥` : "—"}
                sub={summ?.unique_solvers ? `${summ.unique_solvers} solvers` : ""}
              />
              <Highlight
                label="Bonus rate (90d)"
                value={`${bonusRate.toFixed(0)}%`}
                sub={summ?.total_solves ? `${summ.total_solves} solves` : ""}
              />
              <Highlight
                label="Tiles flipped (7d)"
                value={totalTilesFlippedWeek.toLocaleString()}
                sub={`${(summ?.total_moves_week ?? 0).toLocaleString()} swaps`}
              />
              <Highlight
                label="14d solve rate"
                value={`${solveRate.toFixed(0)}%`}
                sub={`${totals.solved}/${totals.started}`}
              />
            </div>
          </Section>

          <Section title="Last 14 days">
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

          <Section title="Cohort retention · weekly cohorts">
            <p className="text-[11px] text-[color:var(--color-muted)] mb-3 max-w-prose">
              Each row is players whose first puzzle landed in that ISO week.
              Columns show the share of that cohort that came back N days later.
              Device-scoped (PostHog distinct_id), so cross-device players
              understate the numbers — directional, not exact.
            </p>
            <CohortTable rows={cohorts} />
          </Section>

          <Section title={`Tier distribution · last 30d · ${allTotal} solves`}>
            {allTotal === 0 ? <Empty /> : <TierBar rows={allTiersOrdered} total={allTotal} />}
            <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-[color:var(--color-muted)]">
              {TIER_ORDER.map((t) => (
                <LegendDot key={t} color={TIER_COLORS[t]} label={t} />
              ))}
            </div>
          </Section>

          <Section title="Moves to solve · last 30d">
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

          <Section title="Per-puzzle difficulty · last 30d">
            <div className="space-y-1">
              <div className="grid grid-cols-[60px_1fr_1fr_1fr] gap-3 text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">
                <span>#</span>
                <span>Solves</span>
                <span>Avg moves</span>
                <span>Median</span>
              </div>
              {puzzles.length === 0 && <Empty />}
              {puzzles.map((p) => (
                <div key={p.num ?? "null"} className="grid grid-cols-[60px_1fr_1fr_1fr] gap-3 text-xs tabular-nums">
                  <span className="text-[color:var(--color-muted)]">#{p.num}</span>
                  <span>{p.solves}</span>
                  <span>{p.avg_moves ?? "—"}</span>
                  <span>{p.median_moves ?? "—"}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Hide hints toggle · last 30d">
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

  // Pick a phrasing that scales with solve count, so the blurb reads less
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
      today.bonus === 1
        ? "1 perfect bonus grid ✦"
        : `${today.bonus} perfect bonus grids ✦`
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

function Login({ error }: { error: boolean }) {
  return (
    <form className="self-start w-full max-w-xs flex flex-col gap-3" action={signIn}>
      <p className="text-[var(--text-kicker)] uppercase tracking-[var(--tracking-kicker)] text-[color:var(--color-muted)]">
        Tessera · stats
      </p>
      <input
        type="password"
        name="t"
        autoFocus
        placeholder="Token"
        className="px-3 py-2 text-sm border border-[color:var(--color-rule)] rounded-md bg-[color:var(--color-paper)]"
      />
      {error && <p className="text-xs text-red-700">Wrong token.</p>}
      <button
        type="submit"
        className="px-4 py-2 text-sm bg-[color:var(--color-ink)] text-[color:var(--color-paper)] rounded-md hover:opacity-90"
      >
        Open
      </button>
    </form>
  );
}

function Hero({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <div className="border border-[color:var(--color-rule)] rounded-lg p-6 bg-[color:var(--color-cream)]">
      <p className="text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">{label}</p>
      <p className="text-5xl sm:text-6xl font-light tabular-nums mt-2 leading-none tracking-tight">
        {value}
      </p>
      {suffix && (
        <p className="text-[11px] text-[color:var(--color-muted)] mt-2">{suffix}</p>
      )}
    </div>
  );
}

function Big({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number | string;
  suffix?: string;
}) {
  return (
    <div className="border border-[color:var(--color-rule)] rounded-md p-4">
      <p className="text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">{label}</p>
      <p className="text-3xl font-light tabular-nums mt-1 leading-tight">{value}</p>
      {suffix && (
        <p className="text-[11px] text-[color:var(--color-muted)] mt-1">{suffix}</p>
      )}
    </div>
  );
}

function fmt(n: number): string {
  return n.toLocaleString();
}

function Highlight({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border border-[color:var(--color-rule)] rounded-md p-4">
      <p className="text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">{label}</p>
      <p className="text-xl font-light tabular-nums mt-1">{value}</p>
      {sub && <p className="text-[11px] text-[color:var(--color-muted)] mt-0.5">{sub}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-sm font-medium mb-3">{title}</h2>
      {children}
    </section>
  );
}

function BarCell({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-3 bg-[color:var(--color-cream)] rounded-sm overflow-hidden">
        <div className="h-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="w-8 text-right tabular-nums text-[color:var(--color-ink-soft)]">{value}</span>
    </div>
  );
}

function TierBar({ rows, total }: { rows: TierRow[]; total: number }) {
  return (
    <div className="space-y-2">
      <div className="flex w-full h-6 rounded-md overflow-hidden border border-[color:var(--color-rule)]">
        {rows.map((r) => {
          const pct = total ? (r.solves / total) * 100 : 0;
          if (pct === 0) return null;
          return (
            <div
              key={r.tier}
              title={`${r.tier}: ${r.solves} (${pct.toFixed(0)}%)`}
              style={{ width: `${pct}%`, background: TIER_COLORS[r.tier as keyof typeof TIER_COLORS] }}
            />
          );
        })}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-x-3 gap-y-1 text-xs">
        {rows.map((r) => {
          const pct = total ? (r.solves / total) * 100 : 0;
          return (
            <div key={r.tier} className="flex items-center gap-1.5 tabular-nums">
              <span
                className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
                style={{ background: TIER_COLORS[r.tier as keyof typeof TIER_COLORS] }}
              />
              <span className="text-[color:var(--color-muted)]">{r.tier}</span>
              <span className="ml-auto">
                {r.solves} · {pct.toFixed(0)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block w-2 h-2 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

function Empty() {
  return <p className="text-xs text-[color:var(--color-muted)] italic">No data yet</p>;
}

function CohortTable({ rows }: { rows: CohortRow[] }) {
  if (rows.length === 0) return <Empty />;
  const cols: { key: keyof Omit<CohortRow, "cohort_week" | "cohort_size">; label: string }[] = [
    { key: "d1", label: "D1" },
    { key: "d3", label: "D3" },
    { key: "d7", label: "D7" },
    { key: "d14", label: "D14" },
    { key: "d30", label: "D30" },
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs tabular-nums">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">
            <th className="text-left font-normal py-1 pr-3">Cohort week</th>
            <th className="text-right font-normal py-1 px-2">Size</th>
            {cols.map((c) => (
              <th key={c.key} className="text-right font-normal py-1 px-2">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.cohort_week} className="border-t border-[color:var(--color-rule)]">
              <td className="py-1.5 pr-3 text-[color:var(--color-muted)]">
                {r.cohort_week.slice(0, 10)}
              </td>
              <td className="py-1.5 px-2 text-right">{r.cohort_size}</td>
              {cols.map((c) => {
                const value = r[c.key];
                const pct = r.cohort_size > 0 ? (value / r.cohort_size) * 100 : 0;
                return (
                  <td key={c.key} className="py-1 px-2 text-right">
                    <CohortCell value={value} pct={pct} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CohortCell({ value, pct }: { value: number; pct: number }) {
  // Heatmap: deeper sage as retention rises. Empty cells render flat so
  // sparse cohorts don't pretend to have data.
  const intensity = Math.min(1, pct / 50); // 50% retention = full sage
  const bg = value === 0 ? "transparent" : `rgba(122, 144, 112, ${0.1 + intensity * 0.6})`;
  return (
    <span
      className="inline-block min-w-[3.5rem] px-2 py-1 rounded-sm"
      style={{ background: bg }}
    >
      {value === 0 ? (
        <span className="text-[color:var(--color-muted)]">—</span>
      ) : (
        <>
          <span>{pct.toFixed(0)}%</span>
          <span className="text-[10px] text-[color:var(--color-muted)] ml-1">
            ({value})
          </span>
        </>
      )}
    </span>
  );
}
