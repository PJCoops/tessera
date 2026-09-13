// First-party server-side activation events (spec §11), logged from API
// routes under legitimate interest — they exist specifically to cover the
// mobile funnel gap between "app opens" and "first result", which the
// client can't measure with PostHog's browser/mobile SDK yet: no client
// analytics call is allowed before consent resolves (§8.3), and consent
// isn't asked until the result screen. These four events are the only
// ones logged this way; anything richer stays client-side PostHog,
// post-consent.
//
// Uses the same PostHog project as the client SDKs (NEXT_PUBLIC_POSTHOG_*)
// — no separate account or key needed. A capture failure must never break
// the request it's attached to.

import { PostHog } from "posthog-node";

let client: PostHog | null | undefined;

function getClient(): PostHog | null {
  if (client !== undefined) return client;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  client = key ? new PostHog(key, { host, flushAt: 1, flushInterval: 0 }) : null;
  return client;
}

export type ServerAnalyticsEvent =
  | "puzzle_fetched"
  | "result_recorded"
  | "account_created"
  | "sync_completed";

export function captureServerEvent(
  distinctId: string,
  event: ServerAnalyticsEvent,
  properties: Record<string, string | number | boolean | null>,
): void {
  try {
    getClient()?.capture({ distinctId, event, properties });
  } catch {
    // analytics must never break the request
  }
}
