// Weekly cohort retention. One HogQL query, rendered into a heatmap
// table. The query is heavy (joins on the events table twice) so
// each visit is bounded by Vercel's serverless cold-start budget +
// PostHog's response time — typically a couple of seconds.
//
// distinct_id is device-scoped, so a player on phone + laptop
// inflates the cohort size and understates retention. Directional
// only until we can identify by email.

import { hogql } from "../../../lib/posthog-api";
import { EXCLUDE } from "../../_lib";
import { CohortTable, Section, type CohortRow } from "../../_components";

export const dynamic = "force-dynamic";

export default async function CohortsStatsPage() {
  let cohorts: CohortRow[] = [];
  let error: string | null = null;
  try {
    cohorts = await hogql<CohortRow>(`
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
    `);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <div>
      <h1 className="text-2xl font-light tracking-tight mb-6">Cohorts</h1>

      {error ? (
        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-medium">Failed to load cohorts</p>
          <pre className="mt-2 whitespace-pre-wrap text-xs">{error}</pre>
        </div>
      ) : (
        <Section
          title="Cohort retention · weekly cohorts"
          freshness="live"
          tooltip="The honest stickiness chart. Each row is the players who started their first puzzle in a given week, then the % of that cohort who came back to play on day 1, 3, 7, 14, and 30. Industry benchmarks for daily puzzles: D1 ≥40% is great, D7 ≥25% is strong, D30 ≥15% is sticky. NYT Mini sits around D30 ~30% (rough public estimate). distinct_id is per-device so cross-device players inflate cohort_size and undercount the rates, so these are floors, not ceilings."
        >
          <p className="mb-4 text-xs text-[color:var(--color-muted)] max-w-prose">
            Each row is the share of a week's first-time players who came back
            on day N. Heat = sage when retention is higher. Weekly cohorts of
            the last 8 weeks. distinct_id is per-device, so cross-device
            players inflate cohort size and undercount retention.
          </p>
          <CohortTable rows={cohorts} />
        </Section>
      )}
    </div>
  );
}
