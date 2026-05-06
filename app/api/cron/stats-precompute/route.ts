// Stats precompute cron. Runs daily at 09:30 UTC, 30 minutes after the
// daily-reminder fires, so the morning surge is included in today's
// numbers. Walks every metric where source: 'precomputed', executes
// its HogQL, writes the result to Upstash. The dashboard reads only
// from Upstash for these metrics, so dashboard refreshes never hit
// PostHog under load.
//
// Auth: same `Authorization: Bearer ${CRON_SECRET}` pattern as the
// daily-reminder cron, plus a `?key=...` query fallback for manual
// curl invocation during development.
//
// Failure mode: per-metric. If one metric's HogQL errors, the manifest
// records it and we keep the previous Redis value. Other metrics
// continue. The dashboard never goes blank because of a single bad
// query.

import { NextRequest, NextResponse } from "next/server";
import {
  precomputeMetric,
  precomputedMetrics,
  writeManifest,
} from "../../../lib/metrics";

// Concurrency for HogQL. PostHog tolerates parallel queries but bursts
// of 10+ on the same project occasionally hit soft rate limits. Four
// is a comfortable middle ground for early-stage volumes.
const CONCURRENCY = 4;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, reason: "cron_secret_missing" },
      { status: 503 }
    );
  }
  const auth = req.headers.get("authorization");
  const queryKey = req.nextUrl.searchParams.get("key");
  if (auth !== `Bearer ${secret}` && queryKey !== secret) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const start = Date.now();
  const metrics = precomputedMetrics();
  const results: Record<
    string,
    { ok: boolean; ms: number; bytes: number; error?: string }
  > = {};

  // Simple worker pool. Avoid Promise.all over the whole list because
  // a single slow metric would otherwise hold up its concurrency slot
  // unnecessarily — the queue keeps work flowing.
  const queue = [...metrics];
  const workers = Array.from(
    { length: Math.min(CONCURRENCY, queue.length) },
    async () => {
      while (queue.length) {
        const def = queue.shift();
        if (!def) break;
        const r = await precomputeMetric(def);
        results[def.key] = r;
      }
    }
  );
  await Promise.all(workers);

  const durationMs = Date.now() - start;
  const manifest = {
    runAt: new Date().toISOString(),
    durationMs,
    metrics: results,
  };
  await writeManifest(manifest);

  const okCount = Object.values(results).filter((r) => r.ok).length;
  const failCount = Object.values(results).length - okCount;

  return NextResponse.json({
    ok: failCount === 0,
    runAt: manifest.runAt,
    durationMs,
    okCount,
    failCount,
    metrics: results,
  });
}
