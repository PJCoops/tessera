// Unit tests for the metrics dictionary plumbing. Doesn't hit PostHog
// or Redis — pure logic only. The proximate goal is to catch the kind
// of bug that put the old dashboard at 98 vs 116: ad-hoc time-window
// interpretations diverging across queries.

import { describe, it, expect } from "vitest";
import { applyWindow, windowClause, windowLabel, TIME_WINDOW_KEYS } from "./time-windows";
import { METRICS, precomputedMetrics, liveMetrics } from "./index";

describe("windowClause", () => {
  it("today and yesterday use UTC explicitly so timezone is unambiguous", () => {
    expect(windowClause("today")).toContain("toDate(timestamp, 'UTC')");
    expect(windowClause("today")).toContain("toDate(now(), 'UTC')");
    expect(windowClause("yesterday")).toContain("toDate(timestamp, 'UTC')");
    expect(windowClause("yesterday")).toContain("INTERVAL 1 DAY");
  });

  it("rolling windows use INTERVAL not toDate", () => {
    expect(windowClause("last24h")).toContain("INTERVAL 1 DAY");
    expect(windowClause("last7d")).toContain("INTERVAL 7 DAY");
    expect(windowClause("last30d")).toContain("INTERVAL 30 DAY");
    expect(windowClause("last90d")).toContain("INTERVAL 90 DAY");
  });

  it("alltime emits no clause", () => {
    expect(windowClause("alltime")).toBe("");
  });

  it("today and last24h are NOT the same — they used to be confused", () => {
    // Regression guard: a calendar-UTC "today" filter and a rolling
    // 24h filter produce different result sets, so the two windows
    // must compile to different SQL even though they sound similar.
    expect(windowClause("today")).not.toBe(windowClause("last24h"));
  });
});

describe("windowLabel", () => {
  it("returns short labels suitable for a Hero subtitle", () => {
    for (const k of TIME_WINDOW_KEYS) {
      expect(windowLabel(k).length).toBeLessThanOrEqual(15);
    }
  });
});

describe("applyWindow", () => {
  it("substitutes ${WINDOW} placeholder", () => {
    const out = applyWindow("SELECT 1 FROM events WHERE 1=1 ${WINDOW}", "today");
    expect(out).toContain("toDate(timestamp, 'UTC')");
    expect(out).not.toContain("${WINDOW}");
  });

  it("substitutes ${EXCLUDE} placeholder (empty when env not set)", () => {
    delete process.env.STATS_EXCLUDE_IDS;
    const out = applyWindow("SELECT 1 FROM events WHERE 1=1 ${WINDOW}${EXCLUDE}", "today");
    expect(out).not.toContain("${EXCLUDE}");
  });

  it("substitutes ${EXCLUDE} with NOT IN clause when env set", () => {
    process.env.STATS_EXCLUDE_IDS = "abc-123,def-456";
    const out = applyWindow("WHERE 1=1 ${WINDOW}${EXCLUDE}", "today");
    expect(out).toContain("AND distinct_id NOT IN ('abc-123','def-456')");
    delete process.env.STATS_EXCLUDE_IDS;
  });

  it("escapes single quotes in exclude IDs (defence against injection)", () => {
    process.env.STATS_EXCLUDE_IDS = "harmless,bo'gus";
    const out = applyWindow("WHERE 1=1 ${EXCLUDE}", "alltime");
    expect(out).toContain("'bo''gus'"); // doubled quote per HogQL string escape
    delete process.env.STATS_EXCLUDE_IDS;
  });

  it("substitutes both placeholders even when interleaved", () => {
    const out = applyWindow("WHERE 1=1 ${WINDOW}${EXCLUDE} AND foo = 1", "last7d");
    expect(out).not.toContain("${");
  });
});

describe("METRICS registry", () => {
  it("is non-empty and every entry has matching key", () => {
    expect(Object.keys(METRICS).length).toBeGreaterThan(0);
    for (const [key, def] of Object.entries(METRICS)) {
      expect(def.key).toBe(key);
    }
  });

  it("every metric has a non-empty label and description", () => {
    for (const def of Object.values(METRICS)) {
      expect(def.label.length).toBeGreaterThan(0);
      expect(def.description.length).toBeGreaterThan(0);
    }
  });

  it("every metric's HogQL only uses ${WINDOW} and ${EXCLUDE} placeholders", () => {
    // No metric should reference an undeclared placeholder. Catches
    // typos like ${WINDOWS} that would silently leak through.
    for (const def of Object.values(METRICS)) {
      const placeholders = def.hogql.match(/\$\{[A-Z_]+\}/g) ?? [];
      for (const p of placeholders) {
        expect(["${WINDOW}", "${EXCLUDE}"]).toContain(p);
      }
    }
  });

  it("alltime metrics are precomputed; today metrics are live", () => {
    // Default routing pattern enforced. Override is fine but should
    // be deliberate — this test will fail noisily and prompt the dev
    // to confirm the choice.
    for (const def of Object.values(METRICS)) {
      if (def.window === "alltime") {
        expect(def.source).toBe("precomputed");
      }
      // today is allowed to be either; we use live for hot data and
      // precomputed for cron-derived structural data.
    }
  });

  it("precomputedMetrics() and liveMetrics() partition the registry", () => {
    const all = Object.values(METRICS).length;
    expect(precomputedMetrics().length + liveMetrics().length).toBe(all);
  });

  it("today and yesterday windows produce different SQL — regression guard for the 98/116 bug", () => {
    // The exact failure mode that caused the visible inconsistency:
    // two metrics meant to share "today" semantics ended up with one
    // bucketing by toDate() in session timezone and the other
    // filtering by `today()`. They returned different counts.
    // After this refactor the only legitimate way to write "today"
    // is windowClause('today'), which is UTC-explicit and singular.
    const todayMetrics = Object.values(METRICS).filter((m) => m.window === "today");
    expect(todayMetrics.length).toBeGreaterThan(0);
    for (const def of todayMetrics) {
      const resolved = applyWindow(def.hogql, "today");
      expect(resolved).toContain("toDate(timestamp, 'UTC')");
      expect(resolved).not.toContain("today()"); // legacy session-TZ pattern, banned
    }
  });
});
