// Social referral metrics. Driven by the UTM tags the
// scripts/daily-social-post script appends to each platform's share URL
// (utm_source=x|bluesky|facebook|reddit, utm_medium=social,
// utm_campaign=daily-post). Instagram captions aren't clickable so
// instagram never appears as a utm_source — IG bio-link traffic would
// need its own tag set on the bio URL.
//
// Both metrics group by utm_source and return one row per platform. The
// stats page can render them as a small table or bar chart without any
// additional shaping.

import type { MetricDef } from "../types";

export type SocialReferralRow = {
  source: string;
  clicks: number;
  starts: number;
  start_rate: number;
};

// Clicks (pageviews where utm_source matches a known platform) and
// downstream puzzle_started counts per platform over the last 7 days.
// start_rate is the conversion rate from click → engaged player; the
// honest "is this platform driving real plays" signal.
export const socialReferralsLast7d: MetricDef<SocialReferralRow[]> = {
  key: "social.referrals.last7d",
  label: "Social referrals (last 7 days)",
  description:
    "Clicks and downstream puzzle_started events by utm_source, last 7 days UTC. utm_source values come from the daily-social-post script (x, bluesky, facebook, reddit). start_rate = unique starters / unique clickers per platform.",
  window: "last7d",
  format: "raw",
  source: "precomputed",
  hogql: `
    WITH tagged AS (
      SELECT
        distinct_id,
        toString(properties.utm_source) AS source,
        event
      FROM events
      WHERE toString(properties.utm_campaign) = 'daily-post'
        AND toString(properties.utm_source) IN ('x', 'bluesky', 'facebook', 'reddit')
        \${WINDOW}\${EXCLUDE}
    )
    SELECT
      source,
      toInt(uniqIf(distinct_id, event = '$pageview')) AS clicks,
      toInt(uniqIf(distinct_id, event = 'puzzle_started')) AS starts,
      round(
        if(
          uniqIf(distinct_id, event = '$pageview') = 0,
          0,
          uniqIf(distinct_id, event = 'puzzle_started') / uniqIf(distinct_id, event = '$pageview')
        ),
        3
      ) AS start_rate
    FROM tagged
    GROUP BY source
    ORDER BY clicks DESC
  `,
  parse: (rows) =>
    (rows as SocialReferralRow[]).map((r) => ({
      source: String(r.source ?? "unknown"),
      clicks: Number(r.clicks ?? 0),
      starts: Number(r.starts ?? 0),
      start_rate: Number(r.start_rate ?? 0),
    })),
  fallback: [],
};

export type SocialHourlyRow = {
  hour: number;
  source: string;
  clicks: number;
};

// Hour-of-day distribution per platform, last 7 days UTC. Lets us see
// when each platform's referred traffic actually lands — answers "are
// we posting at the right time" by showing whether the click cluster
// hugs the 07:17 UTC post or drifts later in the day.
export const socialHourlyLast7d: MetricDef<SocialHourlyRow[]> = {
  key: "social.referrals.hourly.last7d",
  label: "Social referrals by hour (last 7 days)",
  description:
    "Distinct clickers per platform per hour-of-day (UTC), last 7 days. Used to spot whether each platform's traffic peak aligns with our 07:17 UTC post or sits hours later.",
  window: "last7d",
  format: "raw",
  source: "precomputed",
  hogql: `
    SELECT
      toInt(toHour(timestamp)) AS hour,
      toString(properties.utm_source) AS source,
      toInt(uniq(distinct_id)) AS clicks
    FROM events
    WHERE event = '$pageview'
      AND toString(properties.utm_campaign) = 'daily-post'
      AND toString(properties.utm_source) IN ('x', 'bluesky', 'facebook', 'reddit')
      \${WINDOW}\${EXCLUDE}
    GROUP BY hour, source
    ORDER BY source, hour
  `,
  parse: (rows) =>
    (rows as SocialHourlyRow[]).map((r) => ({
      hour: Number(r.hour ?? 0),
      source: String(r.source ?? "unknown"),
      clicks: Number(r.clicks ?? 0),
    })),
  fallback: [],
};
