// FCM (Android) / APNs (iOS) push token registration (spec §10). Tokens
// are account-linked so the server can schedule per-timezone sends and
// sweep them on sign-out / account deletion — distinct from the anonymous
// web-push store (Upstash).

import type { Sql } from "./db";

export type DevicePlatform = "ios" | "android";

export function isDevicePlatform(v: unknown): v is DevicePlatform {
  return v === "ios" || v === "android";
}

/**
 * Register (or refresh) one device's push token. Upserts on
 * (user_id, token) — the same token re-registering (e.g. app relaunch)
 * just bumps tz_offset/updated_at rather than erroring or duplicating.
 */
export async function registerDeviceToken(
  sql: Sql,
  userId: string,
  platform: DevicePlatform,
  token: string,
  tzOffset: number,
): Promise<void> {
  await sql`
    insert into device_tokens (user_id, platform, token, tz_offset)
    values (${userId}, ${platform}, ${token}, ${tzOffset})
    on conflict (user_id, token) do update
      set platform = excluded.platform,
          tz_offset = excluded.tz_offset,
          updated_at = now()
  `;
}

/**
 * Deregister one token — called on sign-out so a device that's no longer
 * attached to the account stops receiving its push (account deletion
 * already sweeps every token for the user via softDeleteAccount /
 * the auth.users cascade).
 */
export async function deregisterDeviceToken(sql: Sql, userId: string, token: string): Promise<void> {
  await sql`delete from device_tokens where user_id = ${userId} and token = ${token}`;
}
