// Account growth stats. Two backends:
//   - PostHog: behavioural funnel (CTA tapped → code sent → verified → synced)
//   - Supabase: ground-truth account rows (profiles table)
//
// Mini-leagues are queried conditionally; if the schema isn't deployed
// yet the section degrades to "—" cards rather than erroring the page.

import type { Metadata } from "next";
import { cachedHogql } from "../../../lib/posthog-api";
import { getDb } from "../../../lib/db";
import { EXCLUDE } from "../../_lib";
import { Big, Section, fmt } from "../../_components";

export const metadata: Metadata = {
  title: "Accounts · Stats",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type FunnelRow = {
  cta_tapped: number;
  codes_sent: number;
  verified: number;
  synced: number;
};

type AccountCountRow = {
  total: string;
  with_handle: string;
  new_today: string;
  new_7d: string;
  new_30d: string;
};

export default async function AccountsStatsPage() {
  let funnel: FunnelRow[] = [];
  let accounts: AccountCountRow[] = [];
  let leagueCount = 0;
  let memberCount = 0;
  let leaguesAvailable = false;
  let error: string | null = null;

  try {
    [funnel] = await Promise.all([
      cachedHogql<FunnelRow>(`
        SELECT
          toInt(countIf(event = 'account_cta_clicked')) AS cta_tapped,
          toInt(countIf(event = 'sign_in_code_sent'))   AS codes_sent,
          toInt(countIf(event = 'sign_in_verified'))     AS verified,
          toInt(countIf(event = 'sync_completed'))       AS synced
        FROM events
        WHERE event IN ('account_cta_clicked', 'sign_in_code_sent', 'sign_in_verified', 'sync_completed')
          AND timestamp >= now() - INTERVAL 30 DAY${EXCLUDE}
      `),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  // Supabase account counts — independent of PostHog, fail gracefully.
  const sql = getDb();
  if (sql) {
    try {
      accounts = await sql<AccountCountRow[]>`
        SELECT
          count(*)::text                                                             AS total,
          count(*) FILTER (WHERE display_name IS NOT NULL)::text                    AS with_handle,
          count(*) FILTER (WHERE created_at::date = current_date)::text             AS new_today,
          count(*) FILTER (WHERE created_at >= now() - interval '7 days')::text     AS new_7d,
          count(*) FILTER (WHERE created_at >= now() - interval '30 days')::text    AS new_30d
        FROM profiles
      `;
    } catch (e) {
      console.error("[stats/accounts] profile counts:", e);
    }

    // Mini-leagues — conditional on schema being deployed.
    try {
      const [lRows, mRows] = await Promise.all([
        sql<{ n: string }[]>`SELECT count(*)::text AS n FROM leagues`,
        sql<{ n: string }[]>`SELECT count(*)::text AS n FROM league_members`,
      ]);
      leagueCount = parseInt(lRows[0]?.n ?? "0", 10);
      memberCount = parseInt(mRows[0]?.n ?? "0", 10);
      leaguesAvailable = true;
    } catch {
      // Table doesn't exist yet — suppress, show "—" cards.
    }
  }

  const f = funnel[0];
  const a = accounts[0];

  const totalAccounts = parseInt(a?.total ?? "0", 10);
  const withHandle = parseInt(a?.with_handle ?? "0", 10);
  const handlePct = totalAccounts > 0 ? Math.round((withHandle / totalAccounts) * 100) : 0;

  const avgLeagueSize =
    leaguesAvailable && leagueCount > 0
      ? (memberCount / leagueCount).toFixed(1)
      : null;

  return (
    <div>
      <h1 className="text-2xl font-light tracking-tight mb-6">Accounts</h1>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900 mb-6">
          <p className="font-medium">PostHog query failed</p>
          <pre className="mt-2 whitespace-pre-wrap text-xs">{error}</pre>
        </div>
      )}

      <Section
        title="Sign-up funnel"
        freshness="live"
        tooltip="Behavioural events over the last 30 days. Each step is a distinct PostHog event — the drop between steps shows where players abandon the flow."
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Big
            label="Save-streak taps"
            value={f ? fmt(f.cta_tapped) : "—"}
            suffix="last 30 days"
            tooltip="account_cta_clicked events: how many times the post-win 'save your streak' prompt was tapped."
          />
          <Big
            label="Codes sent"
            value={f ? fmt(f.codes_sent) : "—"}
            suffix={
              f && f.cta_tapped > 0
                ? `${Math.round((f.codes_sent / f.cta_tapped) * 100)}% of taps`
                : "last 30 days"
            }
            tooltip="sign_in_code_sent events: player entered their email and requested the 6-digit OTP."
          />
          <Big
            label="Accounts verified"
            value={f ? fmt(f.verified) : "—"}
            suffix={
              f && f.codes_sent > 0
                ? `${Math.round((f.verified / f.codes_sent) * 100)}% of codes`
                : "last 30 days"
            }
            tooltip="sign_in_verified events: OTP accepted and session established. Roughly equals new accounts created."
          />
          <Big
            label="Sync events"
            value={f ? fmt(f.synced) : "—"}
            suffix="last 30 days"
            tooltip="sync_completed events: cross-device syncs that finished. Fires on every sync, not just the first, so it can exceed the verified count for active multi-device accounts. Not a funnel subset of verified."
          />
        </div>
      </Section>

      <Section
        title="Registered accounts"
        freshness="live"
        tooltip="Ground-truth counts from the profiles table in Supabase. Updates in real time as players sign up."
      >
        {!sql ? (
          <p className="text-sm text-[color:var(--color-muted)]">
            DATABASE_URL not configured — Supabase stats unavailable.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Big
              label="Total accounts"
              value={a ? fmt(totalAccounts) : "—"}
              tooltip="Rows in the profiles table. One per verified sign-up."
            />
            <Big
              label="Handles set"
              value={a ? fmt(withHandle) : "—"}
              suffix={a ? `${handlePct}% of accounts` : undefined}
              tooltip="Profiles with a display_name set. Players who've claimed a handle."
            />
            <Big
              label="New today"
              value={a ? fmt(parseInt(a.new_today, 10)) : "—"}
              tooltip="Profiles created since midnight UTC today."
            />
            <Big
              label="New last 7 days"
              value={a ? fmt(parseInt(a.new_7d, 10)) : "—"}
              suffix={
                a && parseInt(a.new_30d, 10) > 0
                  ? `${fmt(parseInt(a.new_30d, 10))} last 30 days`
                  : "last 7 days"
              }
              tooltip="Profiles created in the last 7 days. Suffix shows the 30-day figure for context."
            />
          </div>
        )}
      </Section>

      <Section
        title="Mini-leagues"
        freshness="live"
        tooltip="League and member counts from Supabase. Only available once the leagues schema is deployed."
      >
        {!sql ? (
          <p className="text-sm text-[color:var(--color-muted)]">
            DATABASE_URL not configured.
          </p>
        ) : !leaguesAvailable ? (
          <p className="text-sm text-[color:var(--color-muted)]">
            League schema not yet deployed — run the leagues migration to see counts here.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Big
              label="Leagues"
              value={fmt(leagueCount)}
              tooltip="Total mini-leagues created."
            />
            <Big
              label="Members"
              value={fmt(memberCount)}
              tooltip="Total league_members rows. One per (league, player) pair."
            />
            <Big
              label="Avg league size"
              value={avgLeagueSize ?? "—"}
              suffix={avgLeagueSize ? "members per league" : undefined}
              tooltip="Total members divided by total leagues."
            />
          </div>
        )}
      </Section>
    </div>
  );
}
