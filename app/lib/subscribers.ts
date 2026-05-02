// Single-source-of-truth subscriber list for the daily-reminder cron.
//
// Why we duplicate this with Loops: Loops has no "list contacts in
// mailing list" endpoint. Their model assumes you trigger emails per
// contact (via API event or transactional). To send today's reminder to
// every subscriber we need our own iterable list — Loops itself stays
// authoritative for unsubscribe state and email body templates.
//
// Storage: Upstash Redis (Vercel KV-style). A single Redis SET keyed
// "subscribers:daily" holds the lowercased email strings.
//
// Required env (provided by the Vercel storage integration):
//   KV_REST_API_URL
//   KV_REST_API_TOKEN
import { Redis } from "@upstash/redis";

const KEY = "subscribers:daily";

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

export async function addSubscriber(email: string): Promise<void> {
  const r = client();
  if (!r) return;
  await r.sadd(KEY, email.toLowerCase());
}

export async function removeSubscriber(email: string): Promise<void> {
  const r = client();
  if (!r) return;
  await r.srem(KEY, email.toLowerCase());
}

export async function listSubscribers(): Promise<string[]> {
  const r = client();
  if (!r) return [];
  const members = await r.smembers(KEY);
  return Array.isArray(members) ? (members as string[]) : [];
}

export async function subscriberCount(): Promise<number> {
  const r = client();
  if (!r) return 0;
  return await r.scard(KEY);
}
