# Stats rebuild — plan for the morning

> **Status**: drafted 5 May 2026, revised same evening after you pushed back on overkill auth and inflated estimates.
> **Decisions locked**: multi-page sidenav, hybrid caching (live + cron-precomputed), keep `STATS_TOKEN` cookie auth (just make it stickier), same-deploy host-based routing.
> **Honest estimate**: 4–6 hours end-to-end for phases 1–5. Not days.

## Context

The `/stats` page works but is bumping into four real problems:

1. **Inconsistent numbers** between sections (e.g. "Today solved" reading 98 in one card and 116 in another, "324 engaged players" hero conflicting with later sections). Root cause: every section has its own ad-hoc HogQL query, with subtly different time-window semantics (UTC day vs session-TZ day, `now() - INTERVAL X DAY` vs `toDate(timestamp) = today()`), and the labels above each number don't reflect those subtleties.
2. **Slow first paint**. The page fans out 17 HogQL queries in `Promise.all` on every request. Each query takes 0.5–2s end-to-end. Even parallel, the page waits on the slowest.
3. **No headroom for traffic**. Every dashboard refresh hits PostHog directly. If we get to 100 daily checks (you, the team, an investor link, a public-stats blog post) it's 1,700+ HogQL queries/day, all on the same shared resource.
4. **Cosmetic + security gaps**. Lives at the same origin as the puzzle (mixing public + private under one cookie domain), behind a single shared `STATS_TOKEN` with no audit trail or per-person revocation.

This document describes the full rebuild. It's deliberately ambitious — the user asked for "scale, accuracy, performance, security, and MORE."

## Goals

| Concern | Outcome |
|---|---|
| Subdomain | `stats.tesserapuzzle.com`, host-routed inside the same Next deploy |
| Auth | Keep `STATS_TOKEN` cookie. Bump cookie max-age to 1 year. Sign in once per device per year. Done. |
| Correctness | Single metrics dictionary in code; every label and query derived from one definition; UTC discipline everywhere; tested against fixtures |
| Performance | Each page loads in <500ms p95 |
| Scale | Dashboard never queries PostHog under load; precomputed JSON in Upstash, refreshed by a cron |
| UX | Sidenav with pages: Overview / Daily / Puzzles / Players / Cohorts / Push / Health |
| Extras | Push-notification metrics, anomaly alerts, mobile-responsive, optional public "Tessera by the numbers" page |

## Architecture overview

```
              ┌─────────────────────────────────────┐
DNS  ─CNAME─→ │  Vercel (existing tessera project)  │
              └─────────────────────────────────────┘
                         │
                         ▼
              ┌─────────────────────────────────────┐
              │  middleware.ts  (host-based routing)│
              │  - tesserapuzzle.com → /            │
              │  - stats.tesserapuzzle.com → /stats │
              │  - else → 404                       │
              └─────────────────────────────────────┘
                         │
                         ▼
              ┌─────────────────────────────────────┐
              │  app/stats/(authed)/(sections)/...  │
              │  Sidenav layout, one route per page │
              └─────────────────────────────────────┘
                         │
                         ▼
              ┌─────────────────────────────────────┐
              │  app/lib/metrics/  (the dictionary) │
              │  - one definition per metric        │
              │  - getMetric(key) → typed value     │
              └─────────────────────────────────────┘
                         │
              ┌──────────┴───────────┐
              ▼                      ▼
   ┌─────────────────┐    ┌─────────────────────┐
   │ Upstash Redis   │    │ PostHog (HogQL)     │
   │ (precomputed,   │    │ (live, 60s cache,   │
   │  refreshed by   │    │  only for hot       │
   │  05:05 UTC cron)│    │  metrics)           │
   └─────────────────┘    └─────────────────────┘
```

The cron is the keystone. It runs every morning right after the daily-reminder cron, executes one big batch of HogQL, writes a structured `stats:precomputed:<page>` blob to Upstash. The dashboard reads only Upstash for any historical metric. Hot metrics (today's heroes, today's puzzle solves) hit PostHog with a 60-second `unstable_cache` wrapper so concurrent dashboard refreshes don't fan out.

## Phase 1 — Foundation

**Goal**: the structural plumbing, with no UI changes yet. Stats stays at `/stats` and looks identical, but the underlying architecture is in place.

### 1.1 Subdomain + middleware

- Add `stats.tesserapuzzle.com` as a domain in Vercel project settings (CNAME → `cname.vercel-dns.com`).
- New `middleware.ts` at the repo root:
  - On `request.headers.host === "stats.tesserapuzzle.com"`: rewrite all paths to `/stats/<original>`.
  - On `request.headers.host === "stats.tesserapuzzle.com"` AND path starts with `/api/` (which we don't want exposed on stats subdomain): return 404.
  - On `tesserapuzzle.com` with path starting with `/stats`: redirect to `https://stats.tesserapuzzle.com/<path-minus-stats>` so old bookmarks keep working.
- Update `app/layout.tsx` Metadata `metadataBase` resolution so OG/canonical aren't broken on the subdomain (likely just a host-aware `metadataBase`).

### 1.2 Auth: keep it boring

The existing flow already works — paste the token once, get a cookie, you're in. Two small changes and we're done:

- Bump cookie `max-age` from 30 days to 1 year. You sign in once per device per year.
- Set the cookie's `Domain=.tesserapuzzle.com` so it's valid on both the apex and the new `stats.` subdomain. (Currently it's host-only and would need a re-sign-in after the subdomain switch.)

That's the whole auth task. ~10 minutes.

If we ever want per-device revocation or an audit trail, we can layer it on later. For now, the threat model is "stop random people who guess `/stats`," which a strong `STATS_TOKEN` already handles.

### 1.3 Metrics dictionary

This is the keystone fix for the data-inconsistency complaint. All metrics live in one file. Every label, every query, every Hero card consumes from this dictionary.

```
app/lib/metrics/
├── index.ts              ← export every metric
├── types.ts              ← MetricDef, MetricResult, TimeWindow
├── definitions/
│   ├── visitors.ts       ← unique_visitors_today, unique_visitors_alltime, ...
│   ├── players.ts
│   ├── solvers.ts
│   ├── puzzles.ts
│   ├── tiers.ts
│   ├── retention.ts
│   ├── languages.ts
│   └── push.ts           ← (Phase 5)
├── time-windows.ts       ← UTC-disciplined windows: today, yesterday, last7d, last30d, last90d, alltime
└── runtime.ts            ← getMetric(key) → reads cache or executes query
```

Each `MetricDef` is:

```ts
type MetricDef = {
  key: string;                    // 'visitors.today'
  label: string;                  // "Visitors today"
  description: string;            // shown in tooltips
  window: TimeWindow;             // 'today' | 'yesterday' | 'last7d' | ...
  format: 'count' | 'percent' | 'duration';
  source: 'live' | 'precomputed'; // routing decision
  hogql: string;                  // the actual query
  parse: (rows: unknown[]) => number | string;
};
```

The dashboard never writes raw HogQL inline. It does `<Hero metric="visitors.today" />`. The Hero component reads the definition, gets the label, asks the runtime for the value, and renders. Labels and values are guaranteed in sync.

**UTC discipline**: every time-window helper uses `toDate(timestamp, 'UTC')` and `toStartOfDay(now(), 'UTC')`. This is the proximate fix for "98 vs 116 today solved" — those two queries are using different timezone interpretations of "today."

**Tests**: `app/lib/metrics/metrics.test.ts` — snapshot every metric's HogQL against a fixture, plus assert that `today` and `yesterday` windows don't overlap (regression guard for the timezone bug).

### 1.4 Cron precompute scaffold

- New route `/api/cron/stats-precompute` — runs at 05:05 UTC (added to `vercel.json` after the existing daily-reminder cron).
- Auth: same `CRON_SECRET` pattern as daily-reminder.
- Behaviour: walks every metric in the dictionary where `source === 'precomputed'`, executes its HogQL, writes results to Upstash under `stats:precomputed:<key>`.
- Writes a manifest at `stats:precomputed:_manifest` with `{ runAt, durationMs, metrics: { key: { ok, ms, error? } } }` for the Health page.
- Concurrency: 4 queries at a time. PostHog HogQL doesn't love big bursts.
- Failure mode: if a single metric fails, log it in the manifest, keep the previous value in Redis. Don't break the dashboard for one bad query.

### 1.5 Live-query layer

- `app/lib/metrics/runtime.ts` for `source === 'live'` metrics:
  - Wrap each HogQL execution in `unstable_cache(fn, [key], { revalidate: 60, tags: [`metric:${key}`] })`.
  - On manual override `?nocache=1` (gated by auth), skip the cache.
  - All "today" hero numbers go through this path. Maximum one PostHog query per metric per minute, regardless of refresh rate.

## Phase 2 — Page split with sidenav

The current `/stats/page.tsx` becomes the **Overview** page. Other sections move to dedicated routes. Each route runs only its own queries, so first paint of any single page is bounded by the slowest metric on that page (≤500ms with the cache + precompute layers).

### Routes (under `app/stats/(authed)/`)

```
/stats                  → Overview        — 3 hero cards + today's social blurb
/stats/daily            → Daily           — 14-day chart + today details
/stats/puzzles          → Puzzles         — per-puzzle breakdown, hardest/easiest
/stats/players          → Players         — returning rate, top players, distinct counts
/stats/cohorts          → Cohorts         — weekly cohort retention table
/stats/push             → Push            — subscribed, sent, delivered, clicked, expired
/stats/health           → Health          → cron status, last precompute manifest, audit log, error log
```

The `(authed)` route group wraps all of these in a layout that checks the existing `STATS_TOKEN` cookie and renders the sidenav. The current sign-in form (already in `app/stats/page.tsx`) gets extracted to its own route at `/stats/signin` and stays unchanged in behaviour.

### Sidenav design

- Persistent left rail on desktop (collapses to a hamburger on `<sm`).
- Sections grouped: Today (Overview, Daily) / Players (Players, Cohorts, Push) / System (Health, Sign out).
- Each item is a normal `<Link>`, App Router prefetches on hover so navigation between pages is instant.
- Footer of the rail: `Fetched <time>` (per-page) and a "Refresh now" button that calls `revalidatePath`.

### Streaming + Suspense

Each page composes from independent metric components:

```tsx
<Suspense fallback={<HeroSkeleton />}>
  <Hero metric="visitors.today" />
</Suspense>
<Suspense fallback={<ChartSkeleton />}>
  <DailyChart metric="daily.last14d" />
</Suspense>
```

This means slower metrics don't block faster ones — first byte ships immediately, sections appear as their data resolves. Critical for the Cohorts page where the retention query is the slowest.

## Phase 3 — Caching + perf hardening

### 3.1 Hybrid cache routing

| Metric class | Source | Refresh |
|---|---|---|
| Today's heroes (visitors/players/solvers, today's puzzle solves, today's tiers) | Live | 60s `unstable_cache` |
| Today's social blurb | Live | 60s |
| Daily 14-day chart | Precomputed | 05:05 UTC daily |
| All-time totals | Precomputed | 05:05 UTC daily |
| Cohort retention | Precomputed | 05:05 UTC daily |
| Per-puzzle breakdown | Precomputed | 05:05 UTC daily |
| Hardest/easiest puzzles | Precomputed | 05:05 UTC daily |
| Health (cron manifest, audit log) | Live (Redis) | No cache; Redis is fast |

### 3.2 Reads, not queries

The dashboard's data layer becomes:

```ts
async function readMetric(key: string) {
  const def = METRICS[key];
  if (def.source === 'precomputed') {
    return JSON.parse(await redis.get(`stats:precomputed:${key}`)) ?? def.fallback;
  }
  return cachedHogql(def.hogql, def.parse, { ttl: 60 });
}
```

Every page is a tree of `<Metric>` components that each call `readMetric`. No raw queries in pages.

### 3.3 Bundle + render

- Audit `app/stats/page.tsx` for heavy client components (any framer-motion, charts). Move charts to dynamic imports with SSR off where the chart needs `window`.
- Charts: replace any inline rendering with `recharts` server-side via `next-export` pattern, or use bare SVG (no JS for static views).
- Move the social-blurb generator to a server-only module — currently it builds inline in the page render path; can precompute alongside the cron.

## Phase 4 — Correctness audit

This is the explicit list of inconsistencies you flagged tonight, with the fix for each.

| Symptom (current behaviour) | Root cause | Fix |
|---|---|---|
| "Today solved" Big card reads 98, "Today's tiers · 116 solves" header reads 116 | `daily[0].solved` uses `GROUP BY toDate(timestamp)` with no TZ; `todayTiers` uses `WHERE toDate(timestamp) = today()` (PostHog session TZ). Different "today" boundaries. | Single `solved.today` metric in the dictionary. Both consumers read from it. UTC explicit. |
| "324 engaged players" hero vs different number later | `at.unique_players` (all-time) vs other queries scoped to recent windows. Labels don't disambiguate. | Hero suffix already prefixes "all time ·". Apply the same pattern to every Big/Big-secondary card. Add explicit windowed labels everywhere. |
| Engagement rate could exceed 100% (fixed earlier) | `$pageview` blocked by ad-blockers; `puzzle_started` not | Already patched; visitors now = union of both events. |
| 30-day vs 14-day vs 7-day window mixing in same screen | Each query picked an arbitrary window | Time-window helpers in `metrics/time-windows.ts`. Dashboard never picks raw windows; metric defs do. |
| Today/yesterday boundary uncertainty | Some queries use `now() - INTERVAL 1 DAY` (last 24h) vs `WHERE toDate(timestamp) = today()` (calendar) | Document both windows distinctly: `last24h` and `today` are separate `TimeWindow` keys in the dictionary. |

### Snapshot regression suite

- `app/lib/metrics/snapshot.test.ts` — given a small fixture of synthetic events, every metric's output is snapshot-tested. Future changes that move a number unintentionally fail loudly.
- `app/stats/page.test.tsx` — RTL-renders each page against mocked Redis + mocked HogQL, asserts the labelled values render in the right cards.

## Phase 5 — Push notification metrics

Now that PWA push is shipping, we need to see the funnel:

- New events from the existing client code:
  - `push_subscribed` — fired in `PushReminderToggle.subscribe()` after successful POST to `/api/push/subscribe`.
  - `push_unsubscribed` — fired in `unsubscribe()`.
  - `push_received` — fired by the service worker on `push` event (via `postMessage` to any active client, falling back to a beacon if no client is open).
  - `push_clicked` — fired by the service worker on `notificationclick`.
- New metrics:
  - `push.subscribers` (live, from Upstash HLEN per locale)
  - `push.sends_today` (precomputed, from cron logs — extend the daily-reminder cron to write its `attempted/succeeded/failed/expired` blob to `stats:cron:daily-reminder:<date>`)
  - `push.click_through_today` (live)
  - `push.subscribed_funnel` (precomputed) — visitors → installed → subscribed → received → clicked
- New page `/stats/push`:
  - 4-step funnel
  - Per-locale breakdown
  - Recent expirations chart (so we can tell if a deploy is breaking something)

## Phase 6 — Extras (cherry-pick)

Listed in priority order. Each is independent.

### 6.1 Mobile responsive

The current dashboard is desktop-first. Audit and fix on iPhone:
- Sidenav becomes a top tab strip with horizontal scroll.
- Hero cards stack to single column on `<sm`.
- Tables (cohorts, daily breakdown) get a horizontal scroll affordance.

### 6.2 Anomaly alerts

- After the precompute cron runs, compute today's hero numbers vs the trailing 7-day average.
- If any hero metric drops >50% or rises >300% vs trailing average, fire a Slack webhook (or a Loops `stats_anomaly` event to your own email).
- Tunable thresholds in env.

### 6.3 CSV export

- Per page, "Download CSV" button.
- Server action returns CSV-formatted dump of the current page's metrics.
- Useful for ad-hoc analysis in Sheets.

### 6.4 Comparison mode

- Toggle: "vs yesterday" / "vs last week" / "vs all time avg"
- Each Hero card adds a small delta indicator (▲ +12%, ▼ −4%).
- Implementation: every metric has a paired metric for the comparison window; the dictionary makes this trivial.

### 6.5 Public stats page (optional)

- `tesserapuzzle.com/numbers` — public, no auth. Shows aggregate, non-identifying numbers: total solves, biggest day ever, top streak, current streak distribution.
- Same precomputed cache, different subset of metrics.
- Useful for blog posts ("Tessera by the numbers, 100 days in"), Reddit/X social proof.

### 6.6 GDPR/CCPA audit

Since the Spanish locale gives us EU users, do a sweep:
- Cookie banner: do we have one? If not, do we need one given the analytics stack (PostHog, Vercel Analytics, Meta Pixel)?
- Data subject access flow: if someone emails asking what data we have, what's the answer?
- Privacy policy at `/privacy` (already in the master Flutter plan as a placeholder).

## Critical files

**New:**
- `middleware.ts` — host-based routing
- `app/stats/(authed)/layout.tsx` — auth + sidenav
- `app/stats/(authed)/page.tsx` — Overview (replaces current page)
- `app/stats/(authed)/daily/page.tsx`
- `app/stats/(authed)/puzzles/page.tsx`
- `app/stats/(authed)/players/page.tsx`
- `app/stats/(authed)/cohorts/page.tsx`
- `app/stats/(authed)/push/page.tsx`
- `app/stats/(authed)/health/page.tsx`
- `app/lib/metrics/index.ts`, `types.ts`, `runtime.ts`, `time-windows.ts`, `definitions/*.ts`
- `app/lib/metrics/metrics.test.ts`, `snapshot.test.ts`
- `app/api/cron/stats-precompute/route.ts`
- `app/components/stats/Sidenav.tsx`, `MetricHero.tsx`, `MetricBig.tsx`, etc.

**Modified:**
- `vercel.json` — add `stats-precompute` cron at `5 5 * * *`
- `app/api/cron/daily-reminder/route.ts` — also write its own outcomes blob to Redis for the Push metrics page
- `public/sw.js` — fire `push_received` and `push_clicked` events (via a beacon to a new `/api/events/push` endpoint that forwards to PostHog)
- `app/components/PushReminderToggle.tsx` — fire `push_subscribed`/`push_unsubscribed`
- `app/page.tsx`, `app/es/page.tsx` — remove the old `/stats` link if it was on the home page
- Cookie set in the existing stats sign-in route: `Domain=.tesserapuzzle.com`, `max-age=31536000`

**Deleted (eventually):**
- `app/stats/page.tsx` — replaced by the routes above

## Verification

Per phase:

- **Phase 1 (metrics dictionary)**: existing dashboard renders unchanged; tests pass.
- **Phase 2 (refactor)**: every "today" number across sections agrees. The 98/116 pair is gone.
- **Phase 3 (cron + cache)**: cron at 09:30 UTC fires; manifest in Redis shows all metrics green. Hammering the dashboard 100× in a minute shows ≤1 HogQL query per metric in PostHog logs.
- **Phase 4 (subdomain)**: `stats.tesserapuzzle.com` resolves, cookie persists, you didn't have to re-sign-in.
- **Phase 5 (multi-page)**: each page loads independently in <500ms. Sidenav navigation is instant.
- **Phase 6 (push metrics)**: `/stats/push` shows non-zero subscribers, sends, clicks. Funnel adds up.

## Risks & open questions

- **Cron timing**. Daily reminder fires at 09:00 UTC; precompute runs at 09:30 UTC so it captures the morning surge. Live "today" metrics reflect events arriving after 09:30 via the 60s `unstable_cache`.
- **PostHog query cost**. Precomputing every morning means one big batch query. Should be cheaper than 17×N dashboard refreshes. Worth measuring after we ship.
- **Subdomain SSL cert**. Vercel handles this automatically for added domains, but the first request after DNS propagation may briefly 525. Add the domain a few hours before flipping middleware on.
- **Existing `/stats` URL**. Anyone with the bookmark needs the redirect to keep working. Keep the apex → subdomain redirect in middleware permanently.

## Sequencing & honest estimates

Each step is a single commit. Total: **4–6 hours focused work** for phases 1–5.

| # | Step | Real estimate | What it does |
|---|---|---|---|
| 1 | Metrics dictionary + time-window helpers + tests | 60 min | The keystone fix. One file per metric, UTC discipline, snapshot tests. Existing page keeps working unchanged. |
| 2 | Migrate `/stats/page.tsx` queries to consume from dictionary | 45 min | Pure refactor. No new behaviour. The 98 vs 116 inconsistency disappears here because every "today" comes from one definition. |
| 3 | Cron precompute + Redis read layer + hybrid cache | 45 min | Add `/api/cron/stats-precompute`, schedule at `30 9 * * *` in `vercel.json`, wire `readMetric()` to choose Redis vs cached HogQL. |
| 4 | Subdomain + middleware + cookie domain bump | 20 min | Add `stats.tesserapuzzle.com` in Vercel, write middleware host check, change cookie to `Domain=.tesserapuzzle.com` and `max-age=31536000`. |
| 5 | Multi-page split + sidenav | 90 min | Move existing sections into `/stats/{daily,puzzles,players,cohorts,health}/page.tsx`. Sidenav is ~30 lines. |
| 6 | Push metrics page + new SW events | 60 min | Fire `push_subscribed`/`push_clicked`, build the funnel page. |

Total phases 1–6: ~5 hours. Add ~30 min testing/verification.

Extras (mobile responsive, anomaly alerts, CSV, comparison mode, public page, GDPR) are independent and individually 30–60 min each. Cherry-pick.

## Quick wins to do before we start

Just one:

- **Pre-add subdomain in Vercel** so DNS has propagated before we wire middleware. Project Settings → Domains → Add `stats.tesserapuzzle.com`. Vercel will give you a CNAME target; add it at your DNS host. Total: 2 minutes of clicks, then ~10–60 minutes of DNS propagation.

That's it. Everything else we'll do together.
