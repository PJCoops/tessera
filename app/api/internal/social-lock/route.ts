// Daily idempotency lock for social posting.
//
// Two clients call this:
//   - /api/cron/daily-social (GET to check before dispatching workflow)
//   - scripts/daily-social-post/index.mjs (GET at start to bail, POST at
//     end to record a successful day)
//
// Storage: Upstash Redis. One key per UTC date with a 36h TTL so old
// entries expire on their own. The lock value is the post-id-bag we
// return (X / bluesky / fb / ig ids) so any future debugging can see
// which run claimed the day.

import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { todayUtc } from "../../../lib/rng";

const KEY_PREFIX = "social:posted";
const TTL_SECONDS = 36 * 60 * 60;

function client(): Redis | null {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function authed(req: NextRequest, secret: string): boolean {
  const header = req.headers.get("authorization");
  const queryKey = req.nextUrl.searchParams.get("key");
  return header === `Bearer ${secret}` || queryKey === secret;
}

function keyFor(date?: string | null): string {
  const d = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayUtc();
  return `${KEY_PREFIX}:${d}`;
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, reason: "cron_secret_missing" }, { status: 503 });
  }
  if (!authed(req, secret)) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }
  const redis = client();
  if (!redis) {
    return NextResponse.json({ ok: false, reason: "kv_not_configured" }, { status: 503 });
  }
  const key = keyFor(req.nextUrl.searchParams.get("date"));
  const value = await redis.get<string | object>(key);
  return NextResponse.json({ ok: true, key, locked: value !== null, value });
}

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, reason: "cron_secret_missing" }, { status: 503 });
  }
  if (!authed(req, secret)) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }
  const redis = client();
  if (!redis) {
    return NextResponse.json({ ok: false, reason: "kv_not_configured" }, { status: 503 });
  }
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    // Empty body is fine — we'll record a placeholder.
  }
  const key = keyFor(req.nextUrl.searchParams.get("date"));
  const payload = body ?? { lockedAt: new Date().toISOString() };
  await redis.set(key, payload, { ex: TTL_SECONDS });
  return NextResponse.json({ ok: true, key, value: payload });
}
