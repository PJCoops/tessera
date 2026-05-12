// Lightweight IP-based rate limiting for public POST endpoints.
//
// Backed by the same Upstash Redis we already use for the subscriber
// list. Fail-open: if KV is unconfigured or the limiter throws we let
// the request through rather than break the user-facing flow. The goal
// is to put a ceiling on abuse, not to harden a payments API.
//
// Identifier: first IP in x-forwarded-for, falling back to x-real-ip.
// On Vercel both are set by the edge; locally everything maps to one
// bucket which is fine for dev.

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { NextRequest } from "next/server";

type Window = `${number} ${"s" | "m" | "h" | "d"}`;

let redis: Redis | null | undefined;
function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

const limiters = new Map<string, Ratelimit>();
function getLimiter(name: string, limit: number, window: Window): Ratelimit | null {
  const r = getRedis();
  if (!r) return null;
  const key = `${name}:${limit}:${window}`;
  let l = limiters.get(key);
  if (!l) {
    l = new Ratelimit({
      redis: r,
      limiter: Ratelimit.slidingWindow(limit, window),
      prefix: `rl:${name}`,
      analytics: false,
    });
    limiters.set(key, l);
  }
  return l;
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip") ?? "unknown";
}

export type RateLimitResult = { ok: true } | { ok: false; retryAfter: number };

export async function rateLimit(
  req: NextRequest,
  name: string,
  limit: number,
  window: Window
): Promise<RateLimitResult> {
  const l = getLimiter(name, limit, window);
  if (!l) return { ok: true };
  try {
    const res = await l.limit(clientIp(req));
    if (res.success) return { ok: true };
    const retryAfter = Math.max(1, Math.ceil((res.reset - Date.now()) / 1000));
    return { ok: false, retryAfter };
  } catch (e) {
    console.error(`[rate-limit:${name}]`, e);
    return { ok: true };
  }
}
