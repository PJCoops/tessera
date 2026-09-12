# Tessera Mobile (Flutter) — Product & Technical Spec

One consolidated spec for building native iOS + Android apps for Tessera in
Flutter, sharing the existing backend with the Next.js web app. Supersedes
`tasks/flutter-app-plan.md`. §23 records the two review rounds (all findings
folded into the body); §24 records the resolved decisions and the short list of
external facts PJ still needs to confirm.

---

## 1. Summary

- **One Flutter codebase** ships iOS + Android. The Next.js web app stays as-is
  (keeps its SEO, OG images, sitemap, social cron). "Minimal to maintain" =
  **two frontends, one backend**, with a deliberately small, versioned shared
  surface.
- **Same daily puzzle everywhere.** Generated server-side, fetched by both
  clients; neither computes it. Rollover is 00:00 UTC.
- **Stats follow the account.** Mobile reuses the Supabase accounts stack that
  launched on web on 2026-06-13. Adds Sign in with Apple + Google.
- **Monetized from launch:** free with light ads (AdMob), one-time
  non-consumable "remove ads" IAP at a single $2.99-equivalent tier via
  RevenueCat. Entitlement mirrored to the account so it follows the player
  across platforms (the *purchase* does not — only accounts cross stores).
- **Effort:** ~34–44 working days to first submission, one developer, plus an
  iOS rejection round and a possible multi-week Google Play closed-testing gate
  (§21). Higher than the first draft because the backend workstream (§22 Phase B)
  and the accessibility/consent work are now scoped explicitly.

### Key decisions (decision log)

| # | Decision | Rationale |
| --- | --- | --- |
| 1 | Rollover timezone = **UTC** | Already canonical in `app/lib/rng.ts`. Mobile takes `num` from `/api/v1/puzzle`, never computes it. |
| 2 | **Server-side puzzle generation ships first** (Phase 0) | Removes the Dart port of the generator + 5 wordlists + RNG and a permanent parity liability; closes the devtools extraction hole on web. |
| 3 | Web frontend **not** replaced | Flutter web is weak at SEO / first load; the site's OG/sitemap/social-cron infrastructure is mature. |
| 4 | **Versioned API** (`/api/v1/...`) with a frozen typed schema | The "two cheap frontends" bet only holds if the contract can't silently shift under a shipped binary. |
| 5 | Billing = **RevenueCat**; the webhook is a *trigger to re-verify*, never a trusted write | Server-side receipt validation, restore, account-keyed entitlement. Free under $2.5k/mo tracked revenue. |
| 6 | `profiles.ads_removed` honoured on **every** platform | No-op on web until web has ads, but wired from day one. |
| 7 | Apple "Hide My Email" relay addresses = **their own identity** | No forced verification at sign-in. Optional post-v1 "link accounts" flow. |
| 8 | Crash reporting = **Sentry** | One dashboard for mobile now, web later. |
| 9 | State management = **Riverpod** | Fits the async-provider shape; testable without `BuildContext`. |
| 10 | Colour-vision support = **alternate palette theme, no non-colour cues** | §17.2. Firm requirement: no icons / ticks / borders / patterns on the valid/solved states. |
| 11 | Pricing = **single $2.99 US tier**, store-managed localized equivalents | One SKU; no consumable packs in v1. |
| 12 | PWA→app migration = **web-side smart banner only** | No in-app nudge. |
| 13 | Default green/rust palette **retuned jointly with web** (§18) | The a11y-driven hue shift is a brand change and must not diverge between platforms. |
| 14 | **Ads ship in v1** (PJ decision) | Accepted with it: 6 SDKs, the ATT/UMP/privacy-manifest surface, and rejection risks 6–9. A **90-day revenue-floor review** (§8.4) keeps the call honest. |
| 15 | Primary success metric = **D7 retention of new mobile installs**; secondary = **total (web+mobile) DAU lift** | Revenue is explicitly not the bar (ads earn cents). Targets in §2. |
| 16 | **PostHog stays in v1** | Cross-platform funnels are the point of "stats follow you"; marginal SDK cost is acceptable next to AdMob + Firebase. |
| 17 | **iPad opted out for v1** (iPhone-only); Android large-screen = centered max-width board | A half-baked tablet layout is a separate review surface and a 4.3 risk for a solo dev. |
| 18 | **Share card always renders the colour-blind-safe blue+orange** | A shared artifact must be legible to every viewer, not rendered per-sharer. |
| 19 | es **"today's words" = word list only, no definitions, in v1** | `dictionaryapi.dev` is English-only; a Spanish source is post-v1. |

### Top risks

1. **"Another word game" (Apple 4.3 / Play repetitive content)** — the single
   most likely rejection, judged on the *app* as much as the listing. First run
   must *show* the swap mechanic (§16.1) and look visibly unlike Wordle (§18).
2. **Timezone drift** — the most likely "different puzzle" bug. Server owns the
   date; clients never compute it (§5).
3. **Google Play closed-testing gate** — a *personal* Play developer account
   must run ~20 testers for 14 days before production access. Check the account
   type now (§21).
4. **Privacy-label / data-safety accuracy** — a mismatch pulls a live app.
   Generate from the real SDK data map; re-audit on every dependency bump (§14).
5. **Consent gating** — ATT + UMP block ads *and* analytics; the app must boot
   and play fully with everything denied, and you get **no client analytics for
   the pre-first-result window** (§11, §24).
6. **Six native SDKs of maintenance tax** — ads are in v1 by decision, so this
   cost is accepted. The 90-day revenue-floor review (§8.4) is the guard rail.

---

## 2. Goals

- Native iOS and Android apps for Tessera, built once in Flutter.
- Same daily puzzle on web, iOS, and Android, every day, in every locale.
- Sign in on any platform → streak, history, leaderboards, and leagues are the
  same.
- Monetized from launch: ads on the free tier, one-time "remove ads" IAP.
- Keep maintenance low: one Flutter codebase for both stores, one backend
  shared with web.

### Success metric

- **Primary:** D7 retention of new mobile installs **≥ 25%** within 90 days of
  launch — i.e. the app builds a daily habit, not just a one-time try.
- **Secondary:** total (web + mobile) DAU **+15%** vs. the 4-week pre-launch
  baseline — mobile grows the audience rather than only shifting web players to
  a costlier-to-serve client.
- **Not a launch bar:** ad revenue and remove-ads conversion. Tracked for the
  §8.4 review, not used to judge the launch.
- Numbers are PJ's to adjust; the *shape* (habit + net growth, not revenue) is
  the decision.

## 3. Non-goals (v1)

- Replacing the Next.js web app. Flutter targets **iOS + Android only**
  (`flutter create --platforms=ios,android`).
- Offline play for a brand-new day with a cold cache (§7 — mitigated by
  pre-caching, not eliminated).
- Subscriptions, archive / back-catalogue, cosmetic themes as IAP. The
  entitlement plumbing (§8) is built so they can be added without rework.
- `?demo` mode and the synthetic-cursor screen-recording behavior (web-only).
- Home-screen widgets, Apple Watch, iPad-specific layouts.

## 4. Architecture

### 4.1 Two frontends, one backend

```
                 ┌─────────────────────────────┐
   Next.js web ──┤                             │
                 │   Vercel API routes         │──► Supabase Postgres
Flutter iOS  ────┤   /api/v1/{puzzle,results,  │    (project `tessera`,
Flutter Android ─┤    leaderboard,leagues,     │     Frankfurt eu-central-1,
                 │    account,app-config}      │     Transaction pooler)
                 └──────────────┬──────────────┘
                                │
                         Supabase Auth
                    (OTP + Apple + Google)
```

- The **Vercel API routes are the shared backend.** Flutter is a second client
  of the same endpoints. No parallel backend.
- Supabase Postgres is the single source of truth (`schema.sql`).
- Flutter uses the Supabase Dart SDK for sign-in, holds the JWT in secure
  storage, and sends it to the API routes exactly as web does. RLS stays on with
  zero policies — no client writes.

### 4.2 Versioned API contract

- Introduce **`/api/v1/...`** routes. Mobile calls **only** `v1`. The existing
  unversioned routes keep working; web migrates onto `v1` opportunistically
  (it's the same handlers behind a path prefix).
- The `v1` request/response shapes are a **frozen typed schema** — authored once
  (JSON Schema or a `zod` schema), checked in, and used to **generate the Dart
  models**. Contract tests (§20) assert each route against the schema, not
  against the other client.
- **Deprecation policy:** a `v1` field is additive-only; a breaking change means
  `v2` plus a support window ≥ 2 store-release cycles, with `minSupportedVersion`
  (§21) retiring old clients before `v1` is removed.

### 4.3 Shared game logic — server is canonical

Do **not** port the puzzle generator and wordlists to Dart. Do
`tasks/server-side-puzzle-generation.md` first (as `/api/v1/puzzle`):

- `GET /api/v1/puzzle?date=YYYY-MM-DD&locale=en|es` → `{ goldRows, startTiles,
  num }`, edge-cached 24h, refuses future dates.
- Web switches to fetching it; wordlists leave the client bundle.
- Flutter calls the same endpoint, caches per day locally, and **pre-fetches the
  next day** (§7). No generation algorithm, no wordlists, no RNG in Dart.

Flutter implements natively, each with a committed parity fixture asserted from
both `vitest` and `flutter test`:

- Board rendering, tap-to-select / tap-to-swap, swap animation, win states.
- Move counting and the local result object.
- **Share-string formatting** (emoji grid + URL) — port `app/lib/share.ts`. Note
  the grid already uses 🟩 + 🟧; the colour-blind palette swaps 🟩→🟦 in the
  text grid too (§17.2).
- **Streak-display math** — port `app/lib/streak-compute.ts` *and*
  `app/lib/streak.ts` puzzle-number arithmetic off `EPOCH` (`2026-04-27`). The
  client recomputes streak from locally-known results for offline display; the
  server value is canonical on sync (§6.2). This is a third piece of shared
  logic — fixture-lock it like the other two.

### 4.4 Repo layout

Single repo, Flutter app in `mobile/`. Shared assets — locale JSON
(`app/locales/*.json`), fonts (`app/_fonts/`), `public/win.mp3`, `EPOCH`, the
`v1` schema — are **copied into `mobile/` by a build step**, with a CI check
that fails if the copy differs from source. (Flutter asset paths can't reliably
reach outside the Flutter project root; a checked copy beats a symlink that
breaks CI.) Contract tests live web-side and gate merges that would break the
mobile client.

## 5. The "same daily puzzle" guarantee

| Risk | Mitigation |
| --- | --- |
| Client derives the puzzle number from the device clock in another timezone | Server returns `num` in the `/api/v1/puzzle` response; client never derives it. Rollover is **00:00 UTC**. Mobile uses UTC accessors only for offline display math. |
| Wordlist edited after a puzzle airs changes what is valid | Already handled: `puzzles` table pins `gold_rows` / `start_letters` on first server validation. |
| Two clients disagree on start-tile order | `/api/v1/puzzle` returns `startTiles` row-major; both render the array verbatim. Parity fixture covers puzzles #1, #7, #30, #100, #365 in en + es. |
| Flutter and web drift on the share slug or streak math | Shared parity fixtures asserted from both test suites in CI. |

**Accepted consequence:** for a US-West player the puzzle rolls over in the late
afternoon local time. Already true on web; kept consistent, not "fixed" only on
mobile.

## 6. Accounts & cross-platform stats sync

Accounts already shipped on web (Supabase email OTP; `profiles`,
`puzzle_results`, `leagues`, `league_members`; launched 2026-06-13). Mobile
reuses it.

### 6.1 Auth methods

- **Email OTP code** — same flow as web, via Supabase Dart SDK. **Confirm
  Supabase is configured for** OTP-send rate limiting, 6-digit code expiry ≤ 10
  min, and verify-attempt lockout (a 6-digit code is a 10⁶ space — needs an
  attempt cap).
- **Sign in with Apple** — required on iOS by Guideline 4.8 *because we also
  offer Google*. Equal prominence, listed no lower than Google.
- **Sign in with Google** — `google_sign_in` + Supabase OAuth.

All three land on the same `auth.users` row keyed by verified email where
possible.

**Second-method prompt.** After the first successful sign-in, prompt once
(dismissible) to add a second method (Apple / Google). OTP is single-factor —
this is the only guard against a permanent lockout when an inbox is lost
(§16.5). Don't nag; ask once, remember the dismissal.

**Apple "Hide My Email" relay addresses** are accepted as their own identity —
Apple forwards mail reliably, so sync works for that identity. No forced
verification at sign-in. A post-v1 "link accounts" flow covers merging a
web-OTP and Apple identity; not on the launch critical path.

### 6.2 Sync model

- On sign-in: push all local results, pull the server's canonical history,
  recompute streak from the merged set.
- Local-first while playing: today's result is written to device storage
  immediately, then POSTed to `/api/v1/results` with a retry queue.
- **Conflict resolution:** the server row wins on
  `(user_id, mode, puzzle_number)`. Local unverified rows for the same puzzle
  are discarded after a successful pull. Streak is always recomputed, never
  merged numerically.
- **Streak-decrease guard (never silent).** If, after sign-in merge, the
  verified streak is **lower** than the streak the player saw locally, show a
  dedicated screen: what synced, the verified streak, and their preserved
  historical max (`imported_max_streak_*`). Never let the number drop without
  that explanation.
- Signed-out play works (per-device storage). Signing in later imports it.

### 6.3 Account deletion

Guideline 5.1.1(v) requires in-app deletion. `DELETE /api/v1/account`:

- **Initiated and completed entirely in-app** — no web redirect, no "click the
  email link to finish."
- Requires a **fresh re-auth** immediately before (re-enter OTP, or a
  `auth_time` within ~5 min) so a stolen long-lived token can't delete an
  account.
- **Soft-delete with a 24–48h grace window:** account is disabled immediately,
  a confirmation email says when it becomes permanent and how to cancel, then a
  scheduled job hard-deletes (cascade via existing `on delete cascade` FKs).
- Rate-limited per user and per IP.
- Web gets the same control for parity; Play Console also needs a **public
  deletion URL**.

## 7. Offline behavior

- **Two days cached.** When online, the client fetches today's puzzle and
  **pre-fetches tomorrow's** once it exists (00:00 UTC). A commuter who goes
  underground before their local morning still has the puzzle.
- A pre-fetched puzzle is **provisional** — on the day it becomes current, if
  the `/api/v1/puzzle` ETag has changed the client silently re-fetches before
  showing the board (guards against a rare regen between pre-fetch and play).
- **After the day's puzzle is cached:** fully offline. Play, result capture,
  streak update all work; the result POST queues and flushes on reconnect.
- **Cold cache on a new day with no connectivity** (rare, now that two days are
  cached): a blocking "connect to load today's puzzle" state with a retry
  button, plus one automatic retry.
- Yesterday's completed board stays viewable offline.
- AdMob does not fill offline — the result-screen interstitial path must no-op
  gracefully, never spin.

## 8. Monetization

**Model:** free with ads; one-time non-consumable IAP to remove ads.

### 8.1 Ads

- **SDK:** Google AdMob via `google_mobile_ads`. Mediation deferred.
- **Placements (deliberately light — a 60-second daily game):**
  - One **interstitial** after the result screen. It shows **only after the win
    animation has fully settled plus a short beat** — never overlapping the
    solved-cascade frames. Preloaded during play so there's no spinner.
  - **New-player grace:** no interstitial until the player's streak ≥ 3 (or
    first N lifetime plays), behind a PostHog flag so the threshold is tunable.
  - Frequency cap: at most once per calendar day.
  - One **anchored banner** on the History / Stats screen only.
  - Optional later: **opt-in rewarded** ad for an extra hint or a past puzzle.
- **Unfilled slots collapse** to zero height — no empty grey boxes (matters for
  offline and for consent-declining users who get no fill).
- **Ad containers are styled to sit in the design** — defined padding, divider,
  and "Ad" label treatment, not raw SDK chrome. Native ad format is a later
  option if the banner feels foreign.
- No ads mid-puzzle. No ads before the first solve.

### 8.2 Remove-ads IAP

- **Billing:** RevenueCat (`purchases_flutter`).
- Product: `remove_ads`, non-consumable, **single $2.99 US tier**; stores
  auto-map localized equivalents. One SKU.
- `Purchases.logIn(supabaseUserId)` so the purchase attaches to the account.
- **Entitlement flow (server-authoritative):** the RevenueCat webhook →
  Vercel route is a **signal only**. On receipt, the route calls RevenueCat's
  REST API (`GET /subscribers/{app_user_id}`) to confirm the entitlement, then
  writes `profiles.ads_removed`. Every write is logged with the source event id.
  The shared secret is rotated and verified, but is not the sole gate.
- **Resolution order in the client:** `adsRemoved = revenueCatEntitlement (this
  store) || profile.ads_removed (any platform, signed in)`.
- **iOS constraint (Guideline 3.1.1 / 3.1.3):** on iOS the *only* route to
  `ads_removed` is the Apple IAP. No promo codes that bypass it, no mention of
  web pricing anywhere in the app.
- **Web honours `profiles.ads_removed`** from day one (no-op until web has ads).
- **Restore:** "Restore purchases" checks **both** the store *and* the account
  entitlement, and reports precisely what it found — e.g. "No App Store purchase
  found. If you bought Remove Ads before, sign in to restore it." Handle the
  **pending purchase** state ("Ask to Buy" / family approval).
- **Cross-store reality:** an iOS purchase can't be restored on Android by
  Apple/Google — it follows the *account*. Say this in the paywall copy.

### 8.3 Consent & tracking

- **Sequencing (never before first play):** app opens → playable → first
  puzzle solved → on the **result screen**, UMP (EEA/UK/CH) with a one-line
  primer → then ATT with its own primer. Never two system prompts before the
  player has done anything.
- **Google UMP** produces the TCF/GPP string and the US-states privacy string.
- **iOS ATT** — until granted, request **non-personalized ads only**.
- PostHog and Sentry are gated on the same consent signal, not just AdMob.
- The app boots and plays fully with **everything denied**.
- Notifications priming is deferred further still — to session 2, not the first
  result screen (§16.1).
- Extend `docs/privacy-and-consent-spec.md`; update `/privacy` + `/terms`.

### 8.4 Revenue-floor review (90 days post-launch)

Ads are in v1 by decision, but the cost (6 SDKs, the consent surface, rejection
risks 6–9, per-release QA) is real. At 90 days, review:

- Net ad revenue per month, and remove-ads IAP conversion rate.
- Whether either the interstitial or the banner correlates with a measurable
  drop in D7 retention (the primary metric, §2) — check behind the existing
  PostHog flag by comparing grace-cohort vs. ad-cohort.

**Decision rule:** if net monthly ad + IAP revenue is below a floor PJ sets
(suggest ~£100/mo) **and** retention shows any ad-attributable drag, pull the
interstitial first, then the banner, and keep only the remove-ads IAP as a
goodwill option. The SDKs stay wired so ads can return later.

## 9. Feature parity matrix (v1)

| Feature | Web today | Mobile v1 |
| --- | --- | --- |
| Daily puzzle, classic + hard | ✅ | ✅ |
| Locales en / es | ✅ | ✅ |
| Streak, history, tier breakdown | ✅ | ✅ |
| Accounts (OTP) | ✅ | ✅ + Apple + Google |
| Cross-device sync | ✅ | ✅ (with streak-decrease guard, §6.2) |
| Daily leaderboards (global + country) | ✅ | ✅ (read) + **"verified" affordance + report-score action** |
| Mini-leagues + invite links | ✅ | ✅ (join via deep link, confirmation screen) |
| Share card | ✅ | ✅ native share sheet (always blue+orange, §17.2) |
| Hints | ✅ | ✅ |
| "Today's words" | ✅ definitions (en source) | **en:** words + definitions (`dictionaryapi.dev`, cached 30d, non-blocking on failure). **es:** word list only, no definitions in v1, with a subtle "definitions coming soon" note. Spanish source is post-v1. |
| Reminders | email + web push | local notification + email |
| Push notifications | web push (VAPID) | FCM + APNs |
| What's-new toast | ✅ | ✅ (driven by a PostHog flag / `app-config`) |
| Ads / remove-ads | ❌ | ✅ |
| `?demo` mode | ✅ | ❌ |

## 10. Push & reminders

- **Local notification** (`flutter_local_notifications`) daily at a user-chosen
  time, default 09:00 local. Handles the iOS prompt and Android 13+
  `POST_NOTIFICATIONS`.
- **Remote push** (`firebase_messaging` — FCM for Android, APNs key for iOS):
  streak-at-risk nudge, new-day reminder, league results. New `device_tokens`
  table (`user_id`, `platform`, `token`, `tz_offset`, timestamps). Server
  scheduling is per-timezone. Tokens deregistered on sign-out and account
  deletion.
- **Payloads are untrusted.** A notification tap routes only to a fixed
  allowlist of in-app destinations; no deep-linking to arbitrary URLs from a
  push payload.
- Keep the existing email signup hitting `/api/subscribe` as a third channel.
- Push is fully optional; no feature requires it; no promotional push without
  opt-in.

## 11. Analytics & crash reporting

- **PostHog Flutter SDK** (`posthog_flutter`), same project as web. Analytics id
  is a **random per-user id stored in `profiles`**, aliased to the Supabase auth
  id server-side only — the client's `distinct_id` is never the raw auth id.
  Mirror web event names (`app/lib/analytics.ts`) with an added `platform`
  property.
- **Sentry** (`sentry_flutter`) for crashes.
- **PostHog is in v1** — cross-platform funnels are the whole point of "stats
  follow you", and the marginal SDK cost sits next to AdMob + Firebase which are
  already there.
- **No analytics or crash network call before consent resolves** — so the
  onboarding funnel up to the first result is a **measurement blind spot** for
  consent-declining users. Covered by a fixed set of **first-party server-side
  events**, logged from the API routes under legitimate interest (documented in
  the privacy policy), carrying no PII beyond what's already stored:
  - `puzzle_fetched` — `{ num, locale, platform, anon_device_hash }`
  - `result_recorded` — `{ num, mode, moves, verified, platform }`
  - `account_created` — `{ platform, auth_method }`
  - `sync_completed` — `{ platform, imported_count }`

  Enough to see install → first-puzzle → first-result → account activation in
  aggregate without a consent gate. Anything richer is client-side PostHog,
  post-consent.

## 12. Security

### 12.1 Token & credential handling

- Supabase JWT + refresh token in **`flutter_secure_storage`**
  (`encryptedSharedPreferences: true` on Android; minSdk 23). Cleared on
  sign-out and account deletion. Treat the refresh token as revocable
  server-side.
- Public-by-design keys are fine in the binary: Supabase anon key, AdMob app id,
  RevenueCat **public** SDK key. Never shipped: `DATABASE_URL`, service-role
  key, cron secrets, RevenueCat secret key.
- Share slugs are **not** signed (plain `6-12`, `h6-12-b`) — no secret needed in
  the client for sharing. Confirmed against `app/lib/share.ts`.
- The prod API base URL is **baked into release builds** — no runtime override
  outside debug.
- Release builds: `flutter build --obfuscate --split-debug-info=…`.
- No cert pinning for v1 (breaks on rotation; threat model doesn't justify it).
  No `FLAG_SECURE` (nothing sensitive on screen).

### 12.2 Server-trust boundary

- The client is never trusted; all writes go through the API routes; RLS on,
  zero policies.
- **IAP:** `profiles.ads_removed` flips only after the webhook triggers a
  **RevenueCat API re-verify** (§8.2). The webhook payload alone never writes.
- **Deep links are untrusted input.** `/?join=<code>` and `/s/<slug>` are
  validated server-side. A league invite opens a **confirmation screen** (league
  name + inviter), never a silent auto-join.
- **Invite codes** are ≥128-bit random, single-league, optionally expiring.
  `/api/v1/leagues/join` is rate-limited and returns the same error for
  wrong-code vs. no-such-league (no enumeration).
- **Account deletion** requires fresh re-auth + grace window (§6.3).
- **Push tokens** registered against the authenticated user id; deregistered on
  sign-out / deletion.

### 12.3 Anti-cheat / leaderboard integrity

- `validateReplay` replays the submitted swap history against the pinned puzzle;
  only `verified` rows rank; `time_ms` is clamped. `moves` stays server-derived
  from the replay, never client-claimed.
- Mobile sends the full ordered swap list as `history` in `POST /api/v1/results`.
- **Add a per-user rate limit** on `POST /api/v1/results` (~10/min, keyed on
  `userId`) alongside the IP limit — carrier-grade NAT makes the IP limit
  useless for mobile. Confirm the POST path has any limiter (the GET does).
- **Leaderboard rows show a "verified" affordance**; a **report-score** action
  lets league members flag an implausible result.
- **Residual risk, accepted (same as web):** a client can compute a minimal
  valid solution offline and submit a plausible `time_ms`. Optional later: flag
  implausible `time_ms` for a given `min_swaps`; Play Integrity / DeviceCheck
  attestation on the results POST if board-gaming becomes real.

### 12.4 Supply chain

- Pin Flutter to a specific stable version and every plugin to an exact version;
  `flutter pub outdated` + Dependabot; a "builds clean on a fresh machine" CI
  job.
- **Quarterly upgrade cadence** for Flutter + the six native SDKs, run as
  planned maintenance with the "builds clean" job as the gate. Don't chase `.0`
  releases; each Flutter bump is a mini-project with this many native plugins.
- The ad SDK is the largest third-party surface — track advisories, update
  promptly.
- Bundle and surface third-party licenses (`LicenseRegistry` / a settings page).

## 13. Performance

### 13.1 Startup

- **Budget:** first interactive frame ≤ 1.5s cold on a mid-range (2021) Android
  **with all third-party SDKs deferred**. Re-measure and set a firm number
  after Phase 7 with real SDK costs (Firebase init alone is often 300–600ms).
- Show the board skeleton immediately; fetch the puzzle async.
- **Defer** AdMob, PostHog, Sentry, RevenueCat, and Firebase init until after
  the first frame *and* (for the consent-gated ones) after consent resolves.
  Lazy-init Firebase only when a push feature is first used, if feasible.
- `flutter_native_splash` + the iOS launch storyboard matched to the first real
  frame — no white flash.

### 13.2 Runtime / animation

- Swap + solved-cascade hold 60fps (120 on ProMotion). Animate transforms, not
  layout; `RepaintBoundary` per tile; don't rebuild the whole grid per frame.
- **The interstitial is fully decoupled from the win animation** — settle, beat,
  then show the preloaded ad; the two never share frames (§8.1).
- Reserve the stats-screen banner height so its load doesn't shift layout.
- **Streak recompute runs in a background isolate** (or incrementally with a
  dirty flag) — never an O(n) pass over the full result set on the main isolate.
- Profile with DevTools on a low-end Android. Watch first ad load, sign-in
  round-trip, long history list (virtualize it).
- Dispose animation controllers, `audioplayers` instances, ad objects.

### 13.3 Network / battery / size

- `/api/v1/puzzle`: one request per day (plus one pre-fetch), edge-cached;
  `ETag` / `If-None-Match`; 5s timeout + one retry with jittered backoff; a
  single in-flight request (dedupe).
- No polling anywhere. Result POSTs batch through the sync queue with a capped
  flush rate; exponential backoff with jitter on offline↔online flaps.
- Country comes from the server-side IP header — **no location permission**.
- Ship only the Fraunces/Inter weights actually used; consider a system-font
  fallback for body text, Fraunces for headings; measure the glyph subset.
- Ship an **AAB** to Play; enable iOS app thinning. Budget **< 30 MB** download;
  **verify the iOS IPA specifically** — Flutter iOS release size plus AdMob +
  Firebase can approach the limit even before thinning.
- **Capacity check before launch:** a second client roughly doubles auth +
  results traffic and adds a local-morning `POST /api/v1/results` spike across
  timezones. Load-check the Supabase Transaction-pooler connection cap and the
  Upstash rate-limit request quota against projected mobile DAU. Confirm every
  new route uses the **pooler** URL, not Direct (the recorded Vercel↔Supabase
  gotcha). The `/api/v1/puzzle` edge cache absorbs reads; writes are the watch
  item.

## 14. Legal & compliance

### 14.1 Pre-submission checklist

- iOS Privacy Nutrition Label + Google Data Safety form — generated from the
  actual SDK data map (AdMob advertising id, purchase history, coarse
  analytics, crash data). **Re-audit on every dependency bump.**
- Apple **Privacy Manifest** (`PrivacyInfo.xcprivacy`) for the app plus
  required-reason-API declarations; verify the pinned SDK versions ship their
  own manifests; declare ATT tracking domains.
- Sign in with Apple present (because Google is offered).
- In-app account deletion (§6.3) + a public deletion URL for Play.
- ATT `NSUserTrackingUsageDescription`; ad SDK domains in `SKAdNetworkItems`;
  declare `com.google.android.gms.permission.AD_ID`; answer the Play ads
  questionnaire "yes".
- Age rating 12+ / Teen (ads). Do **not** enrol in Kids / Families programs.
- **EU DSA trader identification** in both consoles — **prerequisite: the
  developer must actually be a registered trader** (sole trader / business).
  PJ to confirm registration status (§24 confirm-list). **If not registered
  in time, launch non-EU first** (US / UK / CA / AU / NZ + others) and add EU
  distribution once trader details are verified — this does not block the rest
  of the launch.
- **App Store Small Business Program** — enrol (15% vs 30%) while under $1M/yr.
- Export compliance: HTTPS only → `ITSAppUsesNonExemptEncryption = false`.
- `/privacy`, `/terms`, `/.well-known/apple-app-site-association`,
  `/.well-known/assetlinks.json` on `tesserapuzzle.com`.
- **Localized legal + store content** — privacy policy, terms, store listing,
  screenshots, and push-notification copy all need an **es** version. PJ
  commissions a professional translation of the store listing + the legal diff
  + the ~20 push strings (budget ~£200–300, ~0.5 day to brief and review);
  app UI es already exists. Tracked as a Phase 6 line item.

### 14.2 GDPR / UK GDPR

- **Lawful basis:** ads = consent (UMP), analytics = consent, account data =
  contract, country/leaderboard = legitimate interest, essential server-side
  activation events = legitimate interest (documented).
- **Consent before non-essential SDKs.**
- **Data-subject rights:** deletion covers erasure (§6.3). Add a
  **data-export** path (reuse web's if it exists, else email-triggered).
  Document retention.
- **Processors** — a DPA on file with each, named in the policy with data
  categories, sub-processors, and transfer basis: Supabase (Frankfurt, EU),
  Vercel, Google/AdMob + Firebase (US → SCCs), RevenueCat (US → SCCs), PostHog,
  Sentry, Apple.

### 14.3 Children / age

- **Not child-directed** — state it in the policy and both target-audience
  declarations. AdMob `tagForChildDirectedTreatment = unspecified`,
  `tagForUnderAgeOfConsent = unspecified`; UMP handles under-16 in the EU.

### 14.4 US state privacy

- AdMob personalized ads count as "sharing." Surface a **"Do not sell or share
  my personal information"** control (the UMP US-states string, or a settings
  toggle forcing non-personalized ads) and describe it in the policy and
  settings (§16.4).

### 14.5 Accessibility law

- **European Accessibility Act** (in force June 2025). **Working assumption: PJ
  operates as a micro-enterprise** (< 10 staff, ≤ €2M turnover) and is therefore
  **exempt from the EAA's service obligations**. PJ to confirm this holds
  (§24 confirm-list); revisit if turnover crosses €2M or PJ hires. Regardless of
  the exemption, **WCAG 2.1 AA is the working target** — it is also the
  practical App Review and reputational bar. A one-line internal note records
  the position.

### 14.6 Other

- **`dictionaryapi.dev`** — the Free Dictionary API is free for commercial and
  non-commercial use with no enforced rate limit, but has no SLA and has had
  outages. **Acceptable for v1** (already used on web): cache 30 days, treat as
  best-effort and non-blocking (the game never needs it). Re-check the ToS text
  at build time. **English-only** — the es flow is word-list-only in v1
  (decision 19, §9); a Spanish source (e.g. a RAE-derived or Wiktionary extract)
  is post-v1.
- **Trademark** — clearance check on "Tessera" in the App Store / Play games
  category before submission.
- **UGC moderation** — public display-name handles are user content. Add an
  in-app **report / block** path for handles on leaderboards + a takedown
  process before submission (App Review 1.2).
- **Word content** — the profanity/slur blocklist runs at wordlist build time
  and survives the move server-side in Phase 0. Confirm the server engine loads
  the filtered lists.

## 15. Store review — rejection risks & how we avoid them

Ordered by likelihood.

| # | Guideline | Risk | Mitigation |
| --- | --- | --- | --- |
| 1 | **Apple 4.3 / Play repetitive content** | "Another word game" — judged on the app, not just the listing. | First run *shows* the swap mechanic with one interactive move (§16.1); board styling visibly unlike Wordle's tile grid (§18); distinct mechanic, identity, copy; **never say "Wordle" in metadata**; preview video on both stores; screenshot 1 a labelled before/after of one swap. |
| 2 | **Apple 4.8 / Sign in with Apple** | Missing or subordinate to Google. | Present, equal prominence, no lower than Google. |
| 3 | **Apple 5.1.1(v) / account deletion** | "Email us", deactivate-only, or finished via an email link. | In-app start to finish, fresh re-auth, cascade hard-delete after a disclosed grace window, confirmation email (§6.3). |
| 4 | **Apple 3.1.1 / 3.1.3 / Play Payments** | "Remove ads" bypasses IAP, or the app cites external/cheaper payment. | Store IAP only; on iOS the sole route to `ads_removed` is Apple IAP (§8.2); working Restore; no external links or price talk. |
| 5 | **Apple 5.1.2 / ATT** | A feature gated on the ATT prompt. | Full functionality with ATT denied → non-personalized ads only. |
| 6 | **Apple consent confusion** | ATT + UMP fired back-to-back on launch. | Sequenced on the first result screen, each primed, never before first play (§8.3). |
| 7 | **Apple 1.4.4 / 3.2.2 & Play ad policy** | Interstitial without an immediate close, ads mimicking system UI, forced ads, non-opt-in rewarded. | One interstitial after the settled win animation, daily cap, new-player grace; verify AdMob's close button on real creatives; rewarded is opt-in. |
| 8 | **Apple 3.2.2 / Play review policy** | Review-gating prompt. | `SKStoreReviewController` / Play In-App Review API only, **once per app version ever**, after a positive moment. |
| 9 | **Data-safety / privacy-label mismatch** | Post-launch removal. | Generated from the real SDK data map; re-audit on every dependency bump; fill Play's target-audience survey from the same source doc. |
| 10 | **Apple 2.1 / App Completeness** | Reviewer can't reach leagues (needs an invite). | Review notes: play is immediate, sign-in optional; a test league invite code; a test OTP path. |
| 11 | **Apple 4.5.4 / Play notifications** | Push required or promotional without consent. | Optional; contextual ask in session 2; no promo push without opt-in. |
| 12 | **Play data-deletion & AD_ID** | Missing deletion URL / `AD_ID` declaration. | Both provided. |
| 13 | **Play closed-testing gate (personal accounts)** | ~12–20 testers / 14 days before production. | Confirm account type; start closed testing the day the app is installable; line up testers. |
| 14 | **Metadata / screenshots** | Non-representative or marketing-frame-only. | Real UI, localized en + es, representative of the shipped build. |
| 15 | **Export compliance** | Missed prompt. | `ITSAppUsesNonExemptEncryption = false`. |

**Timeline padding:** at least one iOS rejection round (~3–5 days). Item 13 can
add **2+ weeks** of calendar time if the Play account is personal.

## 16. UX

### 16.1 First run

- **Immediately playable** — no sign-in wall, no permission wall.
- **The first screen teaches the mechanic by doing:** a one-move interactive
  demo (drag/tap two tiles to complete a row) rather than a text tutorial. Full
  how-to is dismissible and always re-openable from settings.
- **Permission order:** play → first solve → on the result screen, UMP then ATT
  (each primed). **Notifications ask is deferred to session 2**, contextually
  ("keep your streak alive"). Nothing interrupts the first puzzle.

### 16.2 Core flows

- **Offline states**, clearly distinct: "today's puzzle needs a connection"
  (blocking, retry — now rare with 2-day cache) vs "playing offline, your result
  will sync" (subtle banner).
- **Sync feedback:** syncing / last-synced; an explicit "importing your
  history…" state on first sign-in on a new device; the **streak-decrease
  explanation screen** (§6.2) when relevant.
- **Every error gets a designed state:** puzzle fetch failed, result POST
  queued, sign-in failed, purchase failed, purchase pending, restore found
  nothing, "today's words" unavailable (non-blocking — the game never needs it).
- **Deep links:** a share link recreates that result view; a league invite shows
  a confirmation screen, then joins.
- **Forced-update:** `/api/v1/app-config` returns `minSupportedVersion`. Prefer
  letting the current version keep *playing* in a degraded mode; hard-block only
  on genuinely breaking API changes, and then with a clear store button plus a
  fallback message for offline / region-delayed listings.
- **Streak nudges** informative, not manipulative; match web's grace/catch-up
  rule.

### 16.3 Platform conventions

- iOS: back-swipe, safe areas, Dynamic Island / notch, ProMotion, Dynamic Type.
- Android: system back **and predictive back** (14+), edge-to-edge, adaptive +
  themed icons, Android 13+ `POST_NOTIFICATIONS`.
- **iPad: opted out for v1** — the app is iPhone-only
  (`TARGETED_DEVICE_FAMILY = 1`, iPad marked unsupported in App Store Connect).
  A real iPad layout is a later release, not a "not broken" hedge.
- Android large screens / tablets: no full opt-out on Play, so ship a **centered
  max-width board** that looks deliberate rather than stretched; exclude tablet
  form factors from the featured device catalogue.

### 16.4 Settings

Theme · language · **colour-blind palette** · hide hints · mute · reminder time
· sign in/out · **delete account** · **restore purchases** · **remove ads** ·
**"do not sell or share my personal information"** · privacy policy · terms ·
open-source licenses · contact / support · app version + build.

### 16.5 Support & account recovery (solo operator)

- **Contact route:** a `support@tesserapuzzle.com` link in settings and in the
  store listings. Store-review replies handled from the same inbox.
- **Entitlement lag ("I paid and still see ads"):** a **"Restore / re-sync
  purchases"** action in settings that forces the client to re-pull
  `profiles.ads_removed` and re-query RevenueCat, with a plain-language result
  message. Most cases self-resolve here without a support ticket.
- **Lost-email OTP recovery:** OTP is single-factor — a user who loses inbox
  access is locked out. Mitigation is *preventive*: after the first sign-in,
  prompt (once, dismissible) to **add Apple or Google as a second method**.
  There is no self-serve recovery for an OTP-only account with a dead inbox;
  the documented policy is identity-proofing by hand via support, or starting
  fresh (local play is unaffected).
- **GDPR requests:** a one-page runbook — how to run a data export for a given
  email, how to trigger the deletion job, target turnaround (30 days).
- **Refunds** are handled by the stores; support's job is only to explain that
  and to re-sync entitlement if needed.

## 17. Accessibility (target: WCAG 2.1 AA — see §14.5)

### 17.1 Screen readers & input

- **VoiceOver / TalkBack:** every tile has a semantic label — position, letter,
  state ("row 2, column 3, N, selected" / "row complete"). The status line is a
  `liveRegion`; announce move-count changes, row-solved, puzzle-complete. The
  tap-select → tap-swap model is non-drag — keep it (no drag-only interaction).
- **Focus & alternative input:** logical focus order for Switch Control / Full
  Keyboard Access; arrow keys move selection, space/enter select and swap.
- **Touch targets:** ≥44pt (iOS) / 48dp (Android) — watch the hint / reveal /
  settings icons.
- **Haptics** accompany visual feedback, never replace it; respect the system
  haptic setting and the in-app mute.
- **Win sound** always has a visual equivalent.

### 17.2 Colour vision — alternate palette, no non-colour cues

Row-valid (green) and solved (rust) sit on the red-green confusion axis
(~8% of men). **The solution is a second palette — not icons, ticks, borders,
or patterns on the tiles.**

- A settings toggle, **"Colour-blind palette"**, swaps the two state colours for
  a CVD-safe pair: **blue (or teal) + orange** — distinguishable under
  deuteranopia, protanopia, *and* tritanopia.
- The pair is **luminance-separated**, not just different hues, so it survives
  greyscale, full monochromacy, and a dimmed OLED screen. That luminance gap is
  what lets it stand alone without a secondary cue.
- Designed as a **first-class theme**, not a two-hex swap — checked against every
  surface so it looks intentional.
- Keep AA contrast against the tile background and on-tile text, light and dark.
- **Applies everywhere the states render:**
  - Board tiles.
  - The **text emoji grid** in the share string: 🟩→🟦, keep 🟧 (the bonus
    corners read correctly against blue).
  - **The OG / share-card image — always renders blue+orange** (decision 18),
    independent of any sharer's setting. A shared artifact must be legible to
    every viewer; per-sharer rendering would show recipients an unexplained blue
    grid or would leave the CVD sharer's own result unreadable to them.
  - History / stats, leagues.
- Persist the setting; mirror it to `profiles` so it follows the account (web
  honours it later). No OS "I have CVD" signal exists, so it's a manual toggle —
  surfaced in the first-run accessibility hint, not buried.
- **Also retune the *default* palette** toward a more tolerant green/rust — see
  §18: this is a joint web + mobile brand change, made once in shared tokens.
- Verify every state × {default, colour-blind} × {light, dark} × {normal,
  greyscale} on a single **contact-sheet screen** (§18) before launch, through
  Sim Daltonism / Stark for all three CVD types.
- **Accepted residual:** a strict WCAG 1.4.1 reading prefers colour never be the
  sole channel. A rigorously chosen, luminance-separated, CVD-tested alternate
  palette (as Wordle's high-contrast mode does) is a defensible AA position for
  a game of this kind, taken deliberately.

### 17.3 Motion, text, layout

- **Reduce motion:** honour `MediaQuery.disableAnimations` — swaps move but
  quick and linear, no spring overshoot, no staggered cascade, gentle win.
- **Text scaling:** honour `MediaQuery.textScaler` to ≥200% — no clipping; test
  at max. es strings run ~15–20% longer than en — no fixed-width buttons.
- **Contrast:** 4.5:1 text, 3:1 UI components and state borders, both themes.
- **RTL-safe layout now** (`start`/`end`, not `left`/`right`).

## 18. Design & brand

- **Mobile visual system one-pager, authored before Phase 2:** the type ramp
  (Fraunces display / Inter text at *mobile* sizes, not web sizes), a 4/8pt
  spacing scale, tile-sizing rules across breakpoints (small phone → tablet),
  and the 6–8 core components. One page, signed off before build.
- **Visual language ported from web:** colour tokens from `app/globals.css` into
  a Flutter `ThemeData` plus a **semantic colour layer** (surface, tile,
  tile-selected, row-valid, solved, hint, error, on-*). All state colour reads
  go through the semantic tokens, so the §17.2 toggle is a one-line palette
  swap. Honour the project rule — **no pink / `--color-accent` for UI**.
- **Default palette retune (joint decision, §17.2):** pick the tuned green/rust
  (green leaning teal, rust leaning orange) once, define the allowed brand
  range, and apply to web `globals.css` and the Flutter theme **in the same
  PR-pair** with design sign-off. The two platforms must not diverge.
- **Distinct from Wordle on sight:** board container, tile shape/spacing, and
  motion signature deliberately unlike a 5×letter guess grid — this is a
  4.3-rejection defense as much as a brand choice.
- **Ads are a brand surface:** constrain the ad container (padding, divider,
  "Ad" label) so it sits within the design.
- **Icon set briefed per platform:** iOS rounded-rect safe area, Android
  adaptive foreground/background layers, Android 13+ themed monochrome. A
  1024×1024 master exists (`app/icon.png`, colormap — flatten to RGB);
  `apple-icon.png` is only 180×180, regenerate. Do not derive every size from
  one raster.
- **Dark mode** is a real palette (elevated surfaces, true-black OLED option),
  not an inversion.
- **Contact-sheet QA screen:** renders every state in every colour context
  (§17.2) for visual review.
- **Every empty / loading / error state is designed** — no bare spinners.
- **Store assets:** screenshot sets for required iPhone sizes + iPad + Android
  phone/tablet, localized en + es; a 15–30s preview video.

## 19. Tech stack

| Concern | Choice |
| --- | --- |
| Framework | Flutter, pinned to a specific **stable** version (not "latest"); Dart 3 |
| Environments | `dev` and `prod` flavors/schemes from Phase 1. Dev uses **test AdMob unit ids** always, a test RevenueCat project, a separate Firebase app, and the preview/test Supabase + API. |
| State | `flutter_riverpod` — a few async providers (puzzle, session, results/streak, entitlement, remote config); testable without `BuildContext` |
| Local storage | `shared_preferences` for flags/results; `flutter_secure_storage` for tokens; `sqflite` only if history grows large |
| HTTP | `dio` (retry + auth-header interceptor, jittered backoff, request dedupe) |
| Auth | `supabase_flutter` |
| Ads | `google_mobile_ads` |
| IAP | `purchases_flutter` (RevenueCat) |
| Consent | `user_messaging_platform`, `app_tracking_transparency` |
| Push | `firebase_messaging`, `flutter_local_notifications` |
| Analytics | `posthog_flutter` (in v1) + first-party server-side events (§11) |
| Crash | `sentry_flutter` |
| Share | `share_plus` |
| Deep links | `app_links` |
| Sound | `audioplayers` |
| Connectivity | `connectivity_plus` |
| In-app review | `in_app_review` |
| CI/CD | GitHub Actions + Fastlane (or Codemagic); Firebase Test Lab for smoke + screenshot generation |

Explicit version floors to set in Phase 1: iOS deployment target, Android
`minSdk` (≥ 23 for secure storage) and `targetSdk` (Play's current requirement).

## 20. Testing

The spec is built to be **developed in a test loop**: each phase ships with an
ordered list of acceptance tests written *before* the implementation, so a
session is "make the next red test green." Fixtures and web-side assertions that
don't need Flutter are written up front (Phase 0) as the executable contract for
the Dart ports.

**Already in the repo** (written ahead of the build):

- `app/lib/mobile-parity.ts` — `buildParityFixture()`, derives a deterministic
  snapshot from the live puzzle / share / streak / puzzle-number logic.
- `app/lib/mobile-parity.fixture.json` — the committed contract; the mobile
  build step copies it to `mobile/test/fixtures/parity.json`.
- `app/lib/mobile-parity.test.ts` — locks the web side against the fixture
  (`npm test`); regenerate deliberately with `npm run gen:parity`.
- `app/api/v1/puzzle/route.test.ts` — the Phase 0 HTTP acceptance tests,
  `describe.skipIf` on the route's absence, activating automatically when
  `app/api/v1/puzzle/route.ts` lands.
- `buildGrid` is now exported from `app/lib/share.ts` so the emoji grid
  (default + colour-blind) is fixture-locked.

Known gap: `npm test` (vitest) currently also globs the in-progress
`e2e/*.spec.ts` Playwright files and reports them as failures — unrelated to
this work; a `vitest.config.ts` `exclude: ["e2e/**"]` fixes it.

### 20.1 Test types

- **Parity fixtures** — one JSON file, generated from the real TS functions,
  covering puzzles #1, #7, #30, #100, #365 × {en, es} × {classic, hard}:
  - `goldRows` + `startTiles` (row-major) per puzzle,
  - `buildShareSlug` output and its round-trip parse,
  - the emoji share grid, **default and colour-blind variants**,
  - `puzzleNumber` / `dateFromPuzzleNumber` off `EPOCH`,
  - `computeStreak` for a set of win-list inputs (empty, single, gap, current,
    broken, with an imported max).

  Asserted from `vitest` (locks the web side against regressions) **and** from
  `flutter test` (proves the Dart port). Lives at
  `mobile/test/fixtures/parity.json`, sourced from the same generator so it
  cannot drift; CI fails on whichever side diverges.
- **Schema contract tests** — web-side; every `/api/v1/*` route response
  asserted against the frozen `v1` JSON Schema. Breaking the schema fails the
  web build before it can ship a client-breaking change.
- **Widget tests** (`flutter_test`) — the board interaction state machine and
  each screen's states.
- **Golden tests** — the board rendered in every {default, colour-blind} ×
  {light, dark} combination (the contact sheet, §18), checked in as golden
  images.
- **`integration_test`** — the full core flow on a device/emulator.
- **IAP** — StoreKit configuration file + sandbox Apple ID (iOS); Play
  licensed-test accounts + internal track (Android); a script that replays
  RevenueCat webhook events against the local Vercel route so the
  entitlement-re-verify path (§8.2) is testable without a real purchase.
- **Manual QA matrix** (per release; smoke portion automated via Firebase Test
  Lab): smallest supported iPhone, a large Android; dark mode; both offline
  states; ATT denied; UMP "manage options → deny"; colour-blind palette on;
  text scale 200%; reduce motion; VoiceOver + TalkBack pass on the board;
  streak-decrease screen; forced-update screen; pending-purchase and
  restore-nothing states.

### 20.2 Acceptance tests per phase (written before the code)

| Phase | Acceptance tests (each starts red) |
| --- | --- |
| **0** `/api/v1/puzzle` | ✅ **tests written** (`app/api/v1/puzzle/route.test.ts`, skip-pending): past date → 200 with a well-formed body; payload byte-identical to `generateDailyPuzzleFor` for that seed across en/es × classic/hard (canonical); future → 403; pre-epoch → 404; malformed → 400; `es` ≠ `en`; locale/mode defaults; `Cache-Control` `s-maxage` + stable `ETag`. Parity fixture + web-side lock also landed (`app/lib/mobile-parity.*`). |
| **1** bootstrap + ports | `parity.json` assertions pass in Dart for slug, grid (both palettes), puzzle-number, streak; `flutter analyze` clean; dev/prod flavors resolve. |
| **2** game screen | tap tile → selected; tap 2nd → swap + move count +1; illegal swap → no-op; all four rows valid → win state fires once; reduce-motion path skips the spring/cascade; colour-blind toggle re-renders tiles from the alt token set; golden images match for the 4 palette×theme combos. |
| **3** surrounding flows | history list renders N results virtualized; tier breakdown matches `dominant-tier` output; "today's words" failure → non-blocking empty state; es → word-list-only variant; settings persist across restart. |
| **4** accounts + sync | merge of {local-only, server-only, conflicting} rows → expected merged set + recomputed streak; server row wins on conflict; **merged streak < local → streak-decrease screen shown**; `imported_max_streak_*` preserved; sign-out clears secure storage; delete-account requires fresh re-auth and enters the grace state. |
| **5** leaderboards + leagues | board rows show verified state; report-score action posts; invite deep link → confirmation screen, not auto-join; wrong code and no-such-league return the same error. |
| **6** localization | every `t()` key resolves in en + es; no clipped strings at text-scale 200% in es (widget test with a forced scale); RTL smoke (mirrored layout renders). |
| **7** monetization | with ads disabled by flag → no ad calls; streak < 3 → no interstitial; interstitial only fires after the win animation completes (no overlap, asserted via a fake clock/animation-status listener); UMP-deny then ATT-deny → app fully playable, ad slots collapse to 0 height; RevenueCat webhook replay → `profiles.ads_removed` set only after the API re-verify stub confirms; on iOS no non-IAP path flips the flag. |
| **8** push | local notification schedules at the chosen time; Android 13 permission flow; a notification payload outside the destination allowlist is ignored; token deregistered on sign-out. |
| **9** analytics | no PostHog/Sentry network call before consent resolves (asserted with a network spy); the 4 server-side events fire from the API routes with the expected shape. |
| **A** accessibility | every tile exposes a semantic label with position + letter + state; status line announces on row-solve and win; focus order is logical; contrast tokens pass AA in all 4 palette×theme combos (unit test over the token values). |
| **12** pre-submission | `integration_test` core flow green on an iOS sim + an Android emulator; IAP sandbox purchase + restore round-trips; forced-update screen blocks below `minSupportedVersion`. |

Phases 10 and 11 (deep-link `.well-known`, store assets) are verified by hand /
store tooling, not unit tests.

## 21. CI/CD & release

- GitHub Actions: `flutter analyze` + `flutter test` + the "builds clean" job on
  every PR touching `mobile/`, plus the schema contract tests.
- Tag-triggered build → Fastlane → TestFlight (iOS) + Play Internal testing
  (Android).
- Staged Play rollout (10% → 50% → 100%). Phased iOS release.
- `minSupportedVersion` in `/api/v1/app-config` retires old clients before a
  `v1` field is ever removed (§4.2).
- PostHog feature flags for dark-launching ad placements, the new-player ad
  grace threshold, and the what's-new toast.

## 22. Plan & effort

Phase 0 and Phase B are backend work on the Vercel/Supabase side and gate the
mobile phases that depend on them.

| Phase | Work | Est. |
| --- | --- | --- |
| 0 | ✅ **done** — `/api/v1/puzzle` + wordlists off the client bundle; `v1` path prefix + frozen zod schema | 1 d |
| B | ✅ **done** (branch `phase-b-backend`) — `DELETE /api/v1/account` (fresh-reauth via `amr` claim + 48h grace + Loops email + per-user/IP limit) & `POST` restore; per-user rate limit + `GET`/`POST /api/v1/results`; `GET /api/v1/app-config`; `POST /api/v1/billing/revenuecat` (webhook → RC REST re-verify → `profiles.ads_removed`, logged to `entitlement_events`); `.well-known/{apple-app-site-association,assetlinks.json}` handlers; `schema.sql` +`ads_removed`/`colour_blind`/`analytics_id`/`deleted_at`, +`device_tokens`, +`entitlement_events`; `purge-deleted-accounts` cron; invite-code hardening (unbiased gen, charset check) + `POST /api/v1/leagues/join`; `GET /api/v1/account/export`. External config still needed: `APPLE_APP_ID`, `ANDROID_CERT_SHA256`, `REVENUECAT_*`, and the Loops `account_deletion_scheduled` event (see `.env.example`). | 4–5 d |
| 1 | `flutter create mobile/`, `dev`/`prod` flavors, CI, port share + puzzle-number + streak math with parity fixtures | 2–3 d |
| 2 | Game screen: grid, swap animation, win states, sound, haptics; **first-run interactive demo**; mobile visual-system one-pager | 4–6 d |
| 3 | Surrounding flows: how-to, history/stats, settings, today's words (with es fallback state) | 2–3 d |
| 4 | ✅ **done** — email OTP + Apple + Google (native id-token flow) sign-in sheet; secure-storage session; sync engine (push local → pull canonical, server wins on conflict, streak recomputed from the merged set, `imported_max` folded in) with an offline submit queue; **streak-decrease screen**; second-method prompt; in-app account deletion (fresh OTP re-auth → 48h grace → restore). Backend gained a `Bearer` auth path + `POST /api/v1/results/import`. **Email OTP + Google verified end-to-end** against the local backend + real Supabase (sign in → pull → push → streak-decrease → delete/restore). Apple pending your Developer Program config (runbook step 5) — deferred, not blocking. | 3–4 d |
| 5 | ✅ **done** — global/country daily leaderboard, leagues (list/create/join by manual code — deep-link join deferred), standings + all-time days-won tally, "verified" affordance (static, every row the server returns is already verified), report-score. New `v1` read routes (`leaderboard`, `leagues`, `leagues/[id]`) + `POST /api/v1/leaderboard/report` + `score_reports` table. Also fixed `/api/v1/leagues/join` never authenticating a mobile bearer token. | 2–3 d |
| 6 | Localization (port `en.json` / `es.json`, `t()` helper); es store/legal/push copy commissioned | 1–2 d |
| 7 | Monetization: AdMob + UMP + ATT sequencing, RevenueCat, entitlement re-verify webhook wiring, unfilled-slot collapse, new-player grace | 3–4 d |
| 8 | Push: FCM + APNs + local notifications, per-tz scheduling, payload allowlist | 2 d |
| 9 | Analytics (if in v1) + Sentry + server-side activation events | 1–2 d |
| A | Accessibility pass: semantic labels, alternate + retuned default palette, contact-sheet QA, text-scale + reduce-motion, focus order | 2–3 d |
| 10 | Deep links + web `.well-known` + `/privacy` `/terms` updates | 1 d |
| 11 | Store prep: per-platform icon set, screenshots (en + es), listings, ratings, data-safety, privacy manifests | 2–3 d |
| 12 | Beta (TestFlight + Play internal), IAP sandbox pass, fixes, submission | 3–4 d |

**~34–44 working days** to first submission, one developer. Add an iOS rejection
round (~3–5 d). **If the Google Play account is personal**, the closed-testing
gate adds **2+ weeks** of calendar time — confirm the account type before
setting a launch date.

---

## 23. Review history

### 23.1 Round 1 (7 perspectives)

Security, performance, App Store reviewer, brand/designer, usability, dev, and
6 user personas. Produced 10 blocker/major and ~18 minor findings. **All folded
into the body sections above** — API versioning (§4.2), backend workstream
(§22 Phase B), entitlement re-verify (§8.2), hardened account deletion (§6.3),
consent sequencing (§8.3, §16.1), streak-decrease guard (§6.2), 2-day
pre-cache (§7), joint palette retune (§18), first-run mechanic demo (§16.1),
interstitial/animation decoupling (§8.1/§13.2), plus the minors across §8–§19.

### 23.2 Round 2 (fresh eyes — after folding Round 1)

New perspectives, checking the folded-in changes for coherence and hunting for
what Round 1 missed.

#### Coherence check on the Round 1 fixes

- **Consent deferral vs. analytics** — folding "no analytics before consent" +
  "consent after first solve" together means **zero client analytics for the
  entire first session up to the first result**. That's the funnel step you most
  need to optimise. Addressed by the server-side activation events in §11, but
  the exact event set is unspecified → §24.
- **API `v1` vs. the live web app** — §4.2 now says web migrates to `v1`
  "opportunistically." That's real, unbudgeted web work, and until it's done the
  schema is only enforced on the path mobile uses. Acceptable, but name it: the
  contract tests must run against `v1` specifically, and web's move is a
  separate small project.
- **2-day pre-cache vs. "puzzle pinned on first validation"** — pre-fetching
  tomorrow's puzzle means the client holds puzzle data before anyone has
  validated a solve for it. Fine (the server still pins on first *validation*),
  but the client must treat a pre-fetched puzzle as provisional and re-fetch if
  the date's `/api/v1/puzzle` ETag changed.
- **Streak recompute in Dart (§4.3) vs. "only two pieces of shared logic"** —
  resolved: it's now explicitly three, all fixture-locked. Consistent.

#### New findings

| # | Persp. | Sev | Finding | Recommendation |
| --- | --- | --- | --- | --- |
| R2-1 | Data / growth | major | No success metric. "Monetized, stats sync, one codebase" are outputs, not a goal. Without a target (net-new installs? revenue? web-player retention lift?) you can't judge whether the 34–44 days + ongoing SDK tax is worth it, or what to cut. | Pick one primary metric and a 90-day target before Phase 1. It changes priorities: if the goal is *migrating* web players, ASO and ads matter less and the streak-migration moment matters most. |
| R2-2 | Finance / cost-benefit | major | AdMob on a niche daily puzzle game with a small base earns cents/day; a one-time $2.99 IAP at a low install count is a rounding error. Against that: 6 SDKs, ATT/UMP/DSA/privacy-manifest compliance, per-release QA matrix, and rejection risk #4/#6 that ads *cause*. | Seriously weigh **shipping v1 with no ads and no IAP** — just the game + accounts + sync. Removes AdMob, RevenueCat, UMP, ATT, most of §14.3/§14.4, rejection risks 4–7, and ~5–7 dev-days. Add monetization in v1.1 once there's an audience to monetize. If ads stay, set a revenue floor below which they're removed. |
| R2-3 | Localization / content | major | es is a first-class locale but "today's words" depends on `dictionaryapi.dev` (English-only). Silent gap. Also: store listing, legal pages, and push copy in es are unowned. | Decide the es dictionary story (a Spanish source like RAE-derived data, or an honest "definitions available in English only" state). Commission es copy for store + legal + push as a Phase 6 line item. |
| R2-4 | QA / release eng | major | Every release is gated on a ~15-item manual matrix run twice (iOS + Android). Solo dev → this either slips or gets skipped. IAP and webhook testing have no described harness. | Automate the smoke half via Firebase Test Lab; keep manual only for the a11y + consent passes. Add a StoreKit config file, sandbox accounts, and a webhook-replay script to Phase B/12. Budget the matrix time explicitly per release. |
| R2-5 | Support / ops | major | One person will field: refund requests, "I paid and still see ads" (entitlement lag), OTP users who lost email access (no recovery path — OTP is the only factor), GDPR export/delete requests, and store reviews. None is designed. | A `support@` route (§14.1 already implies contact). Design: an entitlement "force re-sync" button in settings; an account-recovery policy for lost-email OTP users (probably "add Apple/Google as a second method proactively"); a canned GDPR-request runbook. |
| R2-6 | Infra / capacity | minor | A second client roughly doubles auth + results traffic. Supabase's Transaction pooler and the Upstash free tier both have ceilings; the memory already records a Vercel↔Supabase pooler gotcha. Results POSTs also spike at local-morning across timezones. | Load-check the pooler connection cap and Upstash request quota against projected mobile DAU before launch. The `/api/v1/puzzle` edge cache absorbs reads; results writes are the watch item. Confirm the pooler URL (not Direct) is used by every new route. |
| R2-7 | Legal (2nd pass) | minor | §14.5 now flags the likely EAA micro-enterprise exemption — good. But **DSA trader status is a prerequisite, not a checkbox**: both stores require EU-distributing developers to *be* a registered trader with verifiable details. If PJ isn't registered as a sole trader/business, EU distribution stalls. | Confirm trader registration early; it can take weeks and blocks the EU launch entirely, independent of the app. |
| R2-8 | Accessibility (2nd pass) | minor | The share-card palette question (§17.2) is genuinely unresolved and it's the one a11y surface *other people* see. If the card renders in the sharer's palette, a recipient sees an unexplained blue grid; if it always renders default, the CVD sharer's own shared result is unreadable to them. | Adopt the "card always blue+orange" option in §17.2 as the decision unless there's a reason not to — universal legibility beats per-user rendering for a shared artifact. Then it's closed, not open. |
| R2-9 | Dev (2nd pass) | minor | Flutter stable ships breaking changes ~quarterly; "pinned to a specific stable" (§19) is right but there's no upgrade cadence. Six native SDKs make each Flutter bump a mini-project. | Schedule Flutter/SDK upgrades once a quarter as planned maintenance, with the "builds clean" CI job as the gate. Don't chase `.0` releases. |
| R2-10 | Product / scope | minor | "iPad / large screens: not broken" is a hedge. iPad apps are auto-published to the iPad App Store unless opted out; a "not broken" layout still gets rated and reviewed there, and a bad one invites a 4.3 note. | Either opt iPad out for v1 (iPhone-only), or give the board a real centered max-width layout and screenshot it. Don't ship an unowned iPad experience. |

#### Round 2 spec changes — all folded in (see §24 for the decisions)

| Finding | Resolution | Section |
| --- | --- | --- |
| R2-1 success metric | D7 retention ≥ 25% primary; DAU +15% secondary | §2, decision 15 |
| R2-2 ads in v1? | **v1** (PJ) + 90-day revenue-floor review | §8.4, decision 14 |
| R2-3 es content | word-list-only "today's words"; es copy commissioned | §9, §14.1, §14.6 |
| R2-4 QA automation | Test Lab smoke + StoreKit/webhook harness | §20, §22 |
| R2-5 support/recovery | new §16.5; second-method prompt in §6.1 | §16.5, §6.1 |
| R2-6 infra capacity | pre-launch pooler + Upstash load-check | §13.3 |
| R2-7 DSA trader | confirm status; non-EU launch fallback | §14.1, §24 |
| R2-8 share-card palette | always blue+orange | §17.2, decision 18 |
| R2-9 upgrade cadence | quarterly Flutter/SDK maintenance | §12.4 |
| R2-10 iPad | opted out for v1, iPhone-only | §16.3, decision 17 |
| coherence: pre-fetch provisional | re-fetch on ETag change | §4.3, §7 |
| coherence: server events | explicit 4-event set | §11 |

### 23.3 Status

All Round 1 and Round 2 findings are folded into §§2–22. All 12 §24 questions
are resolved; the only outstanding items are the six external facts in the §24
confirm-list, which PJ settles directly.

## 24. Resolved (was: open questions)

All 12 resolved. Decisions are folded into the body; this is the record.

| # | Question | Resolution | Where |
| --- | --- | --- | --- |
| 1 | Success metric | **Primary: D7 retention of new mobile installs ≥ 25% at 90 days. Secondary: total (web+mobile) DAU +15% vs pre-launch.** Revenue is not a launch bar. Numbers are PJ's to adjust; the shape is fixed. | §2, decision 15 |
| 2 | Ads in v1 or v1.1? | **v1** (PJ decision). Accepted with it: the 6-SDK tax and rejection risks 6–9. Guard rail: a **90-day revenue-floor review** — if net ad+IAP revenue < ~£100/mo *and* ads show retention drag, pull the interstitial, then the banner, keep the SDKs wired. | §8.4, decision 14 |
| 3 | es "today's words" | **v1: word list only, no definitions**, with a subtle "definitions coming soon" note. `dictionaryapi.dev` is English-only; a Spanish source (RAE-derived / Wiktionary extract) is post-v1. | §9, §14.6, decision 19 |
| 4 | es copy ownership | **PJ commissions a professional translation** of the store listing + legal diff + ~20 push strings (~£200–300, ~0.5 day to brief/review). App UI es already exists. Phase 6 line item. | §14.1, §22 |
| 5 | DSA trader status | **PJ to confirm sole-trader / business registration.** If not registered in time, **launch non-EU first** (US/UK/CA/AU/NZ…) and add EU once verified — does not block the rest of the launch. | §14.1, confirm-list |
| 6 | EAA micro-enterprise exemption | **Working assumption: PJ is a micro-enterprise (< 10 staff, ≤ €2M) → exempt from EAA service obligations.** WCAG 2.1 AA stays the working target regardless. Confirm the position; revisit on growth. | §14.5, confirm-list |
| 7 | PostHog on mobile in v1? | **Yes, in v1.** Cross-platform funnels are the point of "stats follow you"; marginal cost next to AdMob + Firebase. | §11, §19, decision 16 |
| 8 | Server-side activation events | Fixed first-party set logged from the API routes under legitimate interest, no PII beyond stored data: `puzzle_fetched`, `result_recorded`, `account_created`, `sync_completed`. Covers the pre-consent funnel in aggregate. | §11 |
| 9 | Share-card palette | **The OG / share-card image always renders blue+orange**, independent of any sharer's setting — a shared artifact must be legible to everyone. | §17.2, decision 18 |
| 10 | iPad | **Opted out for v1 — iPhone-only.** Real iPad layout is a later release. Android large-screen: centered max-width board, not stretched. | §16.3, decision 17 |
| 11 | `dictionaryapi.dev` ToS | **Acceptable for v1** (free for commercial use, no enforced rate limit; already used on web). Cache 30d, best-effort, non-blocking. Re-check the ToS text at build time. | §14.6 |
| 12 | Google Play account type | **PJ to confirm.** If personal → the ~20-tester / 14-day closed-testing gate applies before production; start closed testing the day there's an installable build. Org account (D-U-N-S, ~weeks) only if launch timing demands it. | §21, confirm-list |

### Confirm before launch (external facts only PJ can settle)

1. **DSA trader registration** — registered sole trader / business? (blocks EU
   distribution only; non-EU launch proceeds regardless)
2. **EAA micro-enterprise position** — < 10 staff and ≤ €2M turnover?
3. **Google Play developer account type** — personal (14-day gate) or
   organisation?
4. **`dictionaryapi.dev` current ToS** — re-read at build time.
5. **Apple Developer + Google Play enrolment** — $99/yr and $25 one-time paid.
6. **1024×1024 icon master** — `app/icon.png` is 1024 but colormap; flatten to
   RGB. `apple-icon.png` is 180×180, regenerate.
