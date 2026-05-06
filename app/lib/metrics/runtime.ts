// Metric resolution. Pages call `getMetric(key)` and get back a typed
// MetricResult, never raw HogQL. Two execution paths:
//
//   - source: "precomputed" → read JSON blob from Upstash at
//     stats:precomputed:<key>. Written by the morning cron.
//   - source: "live"        → execute HogQL through `posthog-api.ts`,
//     wrapped in Next's unstable_cache with 60s TTL so concurrent
//     dashboard refreshes don't fan out into N PostHog queries.
//
// On either path, failure returns the metric's declared fallback with
// `stale: true` so the dashboard keeps rendering. We never want a
// single bad query to break the whole page.

import { unstable_cache } from "next/cache";
import { Redis } from "@upstash/redis";
import { hogql } from "../posthog-api";
import { applyWindow } from "./time-windows";
import type { MetricDef, MetricResult } from "./types";

const PRECOMPUTED_KEY_PREFIX = "stats:precomputed:";
const PRECOMPUTED_MANIFEST_KEY = "stats:precomputed:_manifest";

let cached: Redis | null = null;
function redis(): Redis | null {
  if (cached) return cached;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  cached = new Redis({ url, token });
  return cached;
}

// Live HogQL with a 60-second per-query memoization. The cache key
// includes the resolved (window-substituted) HogQL so the same query
// hashes identically across requests, but two metrics with different
// windows don't collide. unstable_cache keys must be string arrays.
function liveExecutor<T>(def: MetricDef<T>): () => Promise<T> {
  const resolved = applyWindow(def.hogql, def.window);
  const cacheKey = ["metric", def.key, def.window, resolved];
  return unstable_cache(
    async () => {
      const rows = await hogql(resolved);
      return def.parse(rows as unknown[]);
    },
    cacheKey,
    {
      revalidate: 60,
      // 'metrics' is the broad tag the dashboard's Refresh button hits
      // via revalidateTag('metrics'), so a click bypasses the 60s TTL.
      // 'metric:<key>' lets us invalidate a single metric in code if
      // ever needed (e.g. after a backfill).
      tags: ["metrics", `metric:${def.key}`],
    }
  );
}

// Read a precomputed value. Returns null when the key is missing
// (e.g. the cron hasn't run yet, or this metric was added after the
// last run). Caller falls back to the metric's declared default.
async function readPrecomputed<T>(def: MetricDef<T>): Promise<{ value: T; refreshedAt: string } | null> {
  const r = redis();
  if (!r) return null;
  const raw = (await r.get(`${PRECOMPUTED_KEY_PREFIX}${def.key}`)) as
    | { v: T; t: string }
    | string
    | null;
  if (!raw) return null;
  // Upstash auto-deserialises JSON; tolerate either form so an SDK
  // upgrade doesn't silently break us.
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as { v: T; t: string };
      return { value: parsed.v, refreshedAt: parsed.t };
    } catch {
      return null;
    }
  }
  return { value: raw.v, refreshedAt: raw.t };
}

export async function getMetric<T>(def: MetricDef<T>): Promise<MetricResult<T>> {
  if (def.source === "precomputed") {
    try {
      const hit = await readPrecomputed(def);
      if (hit) {
        return { value: hit.value, source: "precomputed", refreshedAt: hit.refreshedAt, stale: false };
      }
      return {
        value: def.fallback,
        source: "precomputed",
        refreshedAt: new Date(0).toISOString(),
        stale: true,
      };
    } catch (e) {
      console.error(`[metric:${def.key}] precomputed read failed:`, e);
      return {
        value: def.fallback,
        source: "precomputed",
        refreshedAt: new Date(0).toISOString(),
        stale: true,
      };
    }
  }

  // Live path
  try {
    const value = await liveExecutor(def)();
    return { value, source: "live", refreshedAt: new Date().toISOString(), stale: false };
  } catch (e) {
    console.error(`[metric:${def.key}] live query failed:`, e);
    return {
      value: def.fallback,
      source: "live",
      refreshedAt: new Date().toISOString(),
      stale: true,
    };
  }
}

// Used by the daily cron to populate Redis. Executes the metric's
// HogQL directly (bypassing the live cache, which is request-scoped),
// writes the result to `stats:precomputed:<key>`, and returns timing
// info for the manifest.
export async function precomputeMetric<T>(def: MetricDef<T>): Promise<{
  ok: boolean;
  ms: number;
  bytes: number;
  error?: string;
}> {
  if (def.source !== "precomputed") {
    return { ok: false, ms: 0, bytes: 0, error: "metric is not precomputed" };
  }
  const r = redis();
  if (!r) return { ok: false, ms: 0, bytes: 0, error: "redis_not_configured" };

  const start = Date.now();
  try {
    const resolved = applyWindow(def.hogql, def.window);
    const rows = await hogql(resolved);
    const value = def.parse(rows as unknown[]);
    const blob = { v: value, t: new Date().toISOString() };
    const json = JSON.stringify(blob);
    await r.set(`${PRECOMPUTED_KEY_PREFIX}${def.key}`, blob);
    return { ok: true, ms: Date.now() - start, bytes: json.length };
  } catch (e) {
    return {
      ok: false,
      ms: Date.now() - start,
      bytes: 0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

// Manifest of the latest precompute run. Powers the Health page.
export type PrecomputeManifest = {
  runAt: string;
  durationMs: number;
  metrics: Record<string, { ok: boolean; ms: number; bytes: number; error?: string }>;
};

export async function readManifest(): Promise<PrecomputeManifest | null> {
  const r = redis();
  if (!r) return null;
  const m = (await r.get(PRECOMPUTED_MANIFEST_KEY)) as PrecomputeManifest | null;
  return m;
}

export async function writeManifest(m: PrecomputeManifest): Promise<void> {
  const r = redis();
  if (!r) return;
  await r.set(PRECOMPUTED_MANIFEST_KEY, m);
}
