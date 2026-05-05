// Push notification subscribers, mirroring the email pattern in
// `subscribers.ts`. One Redis HASH per locale at "push:daily:<locale>".
//
// We use HASH (not SET) because each subscription is a structured blob
// — endpoint URL plus auth/p256dh keys — and we need to delete a single
// expired endpoint when web-push returns 404/410. SET would force us to
// store the entire JSON as the member, which makes deletion awkward.
//
// Hash layout:
//   key   = SHA-256(endpoint), first 16 hex chars
//   value = JSON.stringify(PushSubscriptionJSON)
//
// Required env (provided by the Vercel storage integration):
//   KV_REST_API_URL
//   KV_REST_API_TOKEN

import { Redis } from "@upstash/redis";
import { createHash } from "node:crypto";
import { type Locale } from "./i18n";

export type StoredPushSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

function keyFor(locale: Locale): string {
  return `push:daily:${locale}`;
}

// Short stable ID for a subscription, used as the HASH field. We don't
// need cryptographic strength here — just a reasonable collision margin
// across the subscriber population. 16 hex chars = 64 bits of entropy
// from the endpoint URL, which is plenty.
function endpointId(endpoint: string): string {
  return createHash("sha256").update(endpoint).digest("hex").slice(0, 16);
}

let cached: Redis | null = null;
function client(): Redis | null {
  if (cached) return cached;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  cached = new Redis({ url, token });
  return cached;
}

export function isConfigured(): boolean {
  return client() !== null;
}

export async function addPushSubscriber(
  sub: StoredPushSubscription,
  locale: Locale
): Promise<void> {
  const r = client();
  if (!r) return;
  await r.hset(keyFor(locale), { [endpointId(sub.endpoint)]: JSON.stringify(sub) });
}

export async function removePushSubscriber(endpoint: string, locale: Locale): Promise<void> {
  const r = client();
  if (!r) return;
  await r.hdel(keyFor(locale), endpointId(endpoint));
}

// Best-effort: removes the subscription from every locale's hash. Used
// by the cron when web-push reports a permanently expired endpoint and
// we don't know (or trust) which locale list it came from.
export async function removePushSubscriberFromAll(
  endpoint: string,
  locales: readonly Locale[]
): Promise<void> {
  const r = client();
  if (!r) return;
  const id = endpointId(endpoint);
  await Promise.all(locales.map((l) => r.hdel(keyFor(l), id)));
}

export async function listPushSubscribers(locale: Locale): Promise<StoredPushSubscription[]> {
  const r = client();
  if (!r) return [];
  const all = (await r.hgetall(keyFor(locale))) as Record<string, string> | null;
  if (!all) return [];
  const out: StoredPushSubscription[] = [];
  for (const raw of Object.values(all)) {
    try {
      // Upstash returns parsed JSON for stringified objects in some
      // versions; accept both shapes so a library upgrade doesn't
      // silently drop subscribers.
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (parsed && typeof parsed.endpoint === "string" && parsed.keys) {
        out.push(parsed as StoredPushSubscription);
      }
    } catch {
      // Skip corrupted entries rather than failing the whole fan-out.
    }
  }
  return out;
}

export async function pushSubscriberCount(locale: Locale): Promise<number> {
  const r = client();
  if (!r) return 0;
  const n = await r.hlen(keyFor(locale));
  return typeof n === "number" ? n : 0;
}
