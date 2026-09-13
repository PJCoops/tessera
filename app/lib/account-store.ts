// Account lifecycle: soft-delete with a grace window, and the privileged
// hard-delete run by the purge cron (docs/flutter-app-spec.md §6.3).
//
// Hard-delete removes the auth.users row directly over the postgres.js
// connection (which authenticates as the DB role in DATABASE_URL and is
// not subject to RLS). Every user-scoped table FKs auth.users(id) with
// ON DELETE CASCADE, so profiles, puzzle_results, league_members, owned
// leagues, device_tokens and entitlement_events all clear in one go.

import type { Sql } from "./db";

/** Hours a soft-deleted account stays recoverable before the purge cron. */
export const DELETION_GRACE_HOURS = 48;

export type AccountState = { exists: boolean; deletedAt: Date | null };

export async function getAccountState(sql: Sql, userId: string): Promise<AccountState> {
  const rows = await sql<{ deleted_at: Date | null }[]>`
    select deleted_at from profiles where id = ${userId}
  `;
  if (rows.length === 0) return { exists: false, deletedAt: null };
  return { exists: true, deletedAt: rows[0].deleted_at };
}

/**
 * The server-authoritative half of the ads-removed entitlement (§8.2): the
 * RevenueCat webhook is the only writer of `profiles.ads_removed`, this is
 * the only reader clients need. A client ORs this with its own store's
 * cached entitlement so a purchase is honoured immediately on the
 * purchasing device even before the webhook round-trip lands here.
 */
export async function getAdsRemoved(sql: Sql, userId: string): Promise<boolean> {
  const rows = await sql<{ ads_removed: boolean }[]>`
    select ads_removed from profiles where id = ${userId}
  `;
  return rows[0]?.ads_removed ?? false;
}

/**
 * Mark the account for deletion. Idempotent: a second call keeps the
 * original `deleted_at` (so the grace window can't be extended by
 * re-requesting). Returns whether a deletion was already pending and the
 * timestamp the account becomes permanent.
 */
export async function softDeleteAccount(
  sql: Sql,
  userId: string,
): Promise<{ alreadyPending: boolean; permanentAt: Date }> {
  const before = await getAccountState(sql, userId);
  const rows = await sql<{ deleted_at: Date }[]>`
    update profiles
       set deleted_at = coalesce(deleted_at, now()), updated_at = now()
     where id = ${userId}
     returning deleted_at
  `;
  const deletedAt = rows[0]?.deleted_at ?? new Date();
  // Drop push tokens immediately so a pending-deletion account stops
  // getting notifications even before the hard delete.
  await sql`delete from device_tokens where user_id = ${userId}`;
  return {
    alreadyPending: before.deletedAt != null,
    permanentAt: new Date(deletedAt.getTime() + DELETION_GRACE_HOURS * 3600_000),
  };
}

/** Cancel a pending deletion during the grace window. */
export async function restoreAccount(sql: Sql, userId: string): Promise<boolean> {
  const rows = await sql`
    update profiles set deleted_at = null, updated_at = now()
     where id = ${userId} and deleted_at is not null
     returning id
  `;
  return rows.length > 0;
}

/**
 * Everything the app stores about one user, for the GDPR data-export
 * path (§14.2). Read-only; no PII beyond what's already in the tables.
 */
export async function exportAccountData(sql: Sql, userId: string): Promise<Record<string, unknown>> {
  const [profile] = await sql`
    select id, display_name, colour_blind, ads_removed, analytics_id,
           imported_max_streak_classic, imported_max_streak_hard,
           created_at, updated_at, deleted_at
      from profiles where id = ${userId}
  `;
  const results = await sql`
    select mode, puzzle_number, moves, bonus, revealed, verified, locale,
           time_ms, country, completed_at, created_at
      from puzzle_results where user_id = ${userId}
     order by mode, puzzle_number
  `;
  const ownedLeagues = await sql`
    select id, name, invite_code, created_at from leagues where owner_id = ${userId}
  `;
  const memberships = await sql`
    select l.id, l.name, m.joined_at
      from league_members m join leagues l on l.id = m.league_id
     where m.user_id = ${userId}
  `;
  const devices = await sql`
    select platform, tz_offset, created_at, updated_at
      from device_tokens where user_id = ${userId}
  `;
  return {
    exportedAt: new Date().toISOString(),
    profile: profile ?? null,
    puzzleResults: results,
    leaguesOwned: ownedLeagues,
    leagueMemberships: memberships,
    deviceTokens: devices,
  };
}

/** Hard-delete every account whose grace window has elapsed. Returns the count. */
export async function purgeExpiredDeletions(sql: Sql): Promise<number> {
  const stale = await sql<{ id: string }[]>`
    select id from profiles
     where deleted_at is not null
       and deleted_at < now() - (${DELETION_GRACE_HOURS} * interval '1 hour')
  `;
  let purged = 0;
  for (const { id } of stale) {
    await sql`delete from auth.users where id = ${id}`; // cascades everywhere
    purged++;
  }
  return purged;
}
