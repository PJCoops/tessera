// RevenueCat entitlement re-verification (docs/flutter-app-spec.md §8.2).
// The webhook is only a trigger: on any event we call RevenueCat's REST
// API to read the subscriber's *current* entitlements and write that
// truth to profiles.ads_removed. The webhook payload is never trusted to
// set the flag on its own.
//
// Required env: REVENUECAT_API_KEY (secret key, server-side only)

import type { Sql } from "./db";

/** The single non-consumable entitlement that removes ads. */
export const REMOVE_ADS_ENTITLEMENT = "remove_ads";

type RcEntitlement = { expires_date: string | null; product_identifier?: string };
type RcSubscriber = { subscriber?: { entitlements?: Record<string, RcEntitlement> } };

/** Reads RevenueCat and returns whether `remove_ads` is currently active. */
export async function revenueCatAdsRemoved(appUserId: string): Promise<boolean> {
  const key = process.env.REVENUECAT_API_KEY;
  if (!key) {
    console.warn("billing: REVENUECAT_API_KEY unset, cannot re-verify");
    return false;
  }
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
      { headers: { Authorization: `Bearer ${key}` }, signal: ctrl.signal },
    );
    if (!res.ok) {
      console.error(`billing: RevenueCat subscribers ${appUserId} -> ${res.status}`);
      return false;
    }
    const body = (await res.json()) as RcSubscriber;
    const ent = body.subscriber?.entitlements?.[REMOVE_ADS_ENTITLEMENT];
    if (!ent) return false;
    // Non-consumable: expires_date is null. A dated entitlement counts
    // only while it's in the future.
    return ent.expires_date === null || new Date(ent.expires_date).getTime() > Date.now();
  } catch (e) {
    console.error("billing: RevenueCat re-verify failed:", e);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Apply a RevenueCat event: re-verify, write profiles.ads_removed, and
 * log the flip. Idempotent on `eventId` (a replayed webhook is a no-op).
 * Returns the value written, or null if the event was already processed.
 */
export async function applyRevenueCatEvent(
  sql: Sql,
  args: { eventId: string; eventType: string; appUserId: string; raw: unknown },
): Promise<{ adsRemoved: boolean; duplicate: boolean }> {
  const seen = await sql`select 1 from entitlement_events where event_id = ${args.eventId}`;
  if (seen.length > 0) {
    const cur = await sql<{ ads_removed: boolean }[]>`
      select ads_removed from entitlement_events where event_id = ${args.eventId}
    `;
    return { adsRemoved: cur[0]?.ads_removed ?? false, duplicate: true };
  }

  const adsRemoved = await revenueCatAdsRemoved(args.appUserId);

  await sql.begin(async (tx) => {
    await tx`
      update profiles set ads_removed = ${adsRemoved}, updated_at = now()
       where id = ${args.appUserId}
    `;
    await tx`
      insert into entitlement_events (event_id, user_id, event_type, ads_removed, raw)
      values (${args.eventId}, ${args.appUserId}, ${args.eventType}, ${adsRemoved},
              ${sql.json(args.raw as never)})
      on conflict (event_id) do nothing
    `;
  });

  return { adsRemoved, duplicate: false };
}
