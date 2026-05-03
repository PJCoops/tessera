// Single-source-of-truth subscriber list for the daily-reminder cron.
//
// Why we duplicate this with Loops: Loops has no "list contacts in
// mailing list" endpoint. Their model assumes you trigger emails per
// contact (via API event or transactional). To send today's reminder to
// every subscriber we need our own iterable list — Loops itself stays
// authoritative for unsubscribe state and email body templates.
//
// Storage: Upstash Redis (Vercel KV-style). One Redis SET per locale
// at "subscribers:daily:<locale>". A legacy single-locale set still
// lives at "subscribers:daily" — read alongside the English set so the
// existing list keeps receiving emails without a migration step.
//
// Required env (provided by the Vercel storage integration):
//   KV_REST_API_URL
//   KV_REST_API_TOKEN
import { Redis } from "@upstash/redis";
import { LOCALES, type Locale } from "./i18n";

// Legacy key written by the original single-locale flow. Kept readable
// as the English fallback so previously-subscribed users keep getting
// their daily reminder. New writes always go to the per-locale keys.
const LEGACY_KEY = "subscribers:daily";

function keyFor(locale: Locale): string {
  return `${LEGACY_KEY}:${locale}`;
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

export async function addSubscriber(email: string, locale: Locale): Promise<void> {
  const r = client();
  if (!r) return;
  await r.sadd(keyFor(locale), email.toLowerCase());
}

export async function removeSubscriber(email: string, locale: Locale): Promise<void> {
  const r = client();
  if (!r) return;
  await r.srem(keyFor(locale), email.toLowerCase());
  // Also clear the legacy key in case the user was on the old list.
  if (locale === "en") await r.srem(LEGACY_KEY, email.toLowerCase());
}

// Returns subscribers for a single locale, merged with the legacy set
// when locale === "en" so pre-locale signups keep getting English emails.
export async function listSubscribers(locale: Locale): Promise<string[]> {
  const r = client();
  if (!r) return [];
  const sets = [keyFor(locale)];
  if (locale === "en") sets.push(LEGACY_KEY);
  const lists = await Promise.all(
    sets.map(async (k) => {
      const m = await r.smembers(k);
      return Array.isArray(m) ? (m as string[]) : [];
    })
  );
  return Array.from(new Set(lists.flat()));
}

// Map of locale → subscriber count, including the legacy set in `en`.
// Used by the cron to log how many it fans out per locale.
export async function subscriberCounts(): Promise<Record<Locale, number>> {
  const r = client();
  const out = {} as Record<Locale, number>;
  if (!r) {
    for (const l of LOCALES) out[l] = 0;
    return out;
  }
  for (const l of LOCALES) {
    const list = await listSubscribers(l);
    out[l] = list.length;
  }
  return out;
}
