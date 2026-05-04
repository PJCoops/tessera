# Tessera Mobile (Flutter) — Plan

Living plan for porting Tessera to iOS and Android using Flutter. Web app stays in `app/`; mobile lives in `mobile/` in this repo so wordlists and locale dictionaries stay in lockstep.

## Decisions (locked)

- **Repo layout:** single repo, `mobile/` directory.
- **Streak / state:** per-device for v1 via `shared_preferences`. Cross-device sync deferred to a follow-up phase that touches web and mobile together (same backend).
- **Reminders:** both — local notifications (`flutter_local_notifications`) plus the existing email signup hitting `/api/subscribe`.
- **Privacy / terms / store legal pages:** placeholder pages on `tesserapuzzle.com` (`/privacy`, `/terms`) added to the Next app.
- **v1 scope:** ship without `?demo` mode and the synthetic-cursor screen-recording behavior.

## Architecture

- Puzzle generated **on-device** in Dart from the UTC-date seed. Day N produces the same gold grid on web and mobile (verified by snapshot tests).
- State per-device via `shared_preferences`, mirroring the six localStorage keys today:
  - `tessera:streak`
  - `tessera:result:<num>`
  - `tessera:progress:<num>`
  - `tessera:hide-hints`
  - `tessera:muted`
  - `tessera:theme`
  - (plus `tessera:email-subscribed`, `tessera:email-dismissed`, `tessera:seen-howto`)
- Existing Vercel backend reused as-is — no new endpoints.
- Native share via `share_plus`. Sound via `audioplayers`. Deep links via `app_links`.

## Phases

### Phase 1 — Bootstrap & port logic (1–2 days)

- `flutter create mobile/` with iOS + Android targets only.
- Port to Dart:
  - `app/lib/rng.ts` → `mobile/lib/rng.dart`
  - `app/lib/puzzle.ts` → `mobile/lib/puzzle.dart`
  - `app/lib/share.ts` → `mobile/lib/share.dart`
  - `app/lib/streak.ts` → `mobile/lib/streak.dart`
  - `app/lib/tier.ts` → `mobile/lib/tier.dart`
  - `app/lib/i18n.ts` → `mobile/lib/i18n.dart`
- Bundle as Flutter assets (read directly from `app/`, do not copy):
  - `app/lib/words.json`, `solution-words.json`, `words-es.json`, `solution-words-es.json`, `accented-map-es.json`
  - `app/locales/en.json`, `app/locales/es.json`
  - `public/win.mp3`
  - Custom fonts from `app/_fonts/`
- Snapshot tests: assert mobile-generated gold grids for puzzles #1, #7, #30, #100 match web output exactly.

### Phase 2 — Game screen (3–5 days)

- 4×4 grid using `Stack` + `AnimatedPositioned` for swap animation. Spring physics tuned to feel like the framer-motion config in `TesseraGame.tsx`.
- Tap-to-select / tap-to-swap flow.
- Visual states: selection ring, hint dotted outline, row-valid green, solved gold cascade with stagger.
- Win sound via `audioplayers` (respects mute setting).
- Status line with rolling text transitions; moves counter; reveal-with-confirm flow.
- Theme: light / dark / system using `ThemeData` and `MediaQuery.platformBrightness`.

### Phase 3 — Surrounding flows (2–3 days)

- HowToPlay sheet with four tabs: How / Today's Words / Settings / Credits.
- Today's Words: `http` fetch from dictionaryapi.dev with 30-day `shared_preferences` cache (mirrors web behavior).
- HistoryModal with stats + tier breakdown.
- Share via `share_plus` — emoji grid + URL identical to web output.
- Settings: theme, language, hide hints, mute, daily reminder time, in-app email signup.

### Phase 4 — Localization (1 day)

- Load `en.json` / `es.json` at startup; implement `t(key, vars)` mirroring `app/lib/i18n.ts`.
- Persist locale; default to system locale on first launch.

### Phase 5 — Reminders (1 day)

- `flutter_local_notifications` scheduled daily at user-chosen time (default 09:00 local).
- iOS permission prompt + Android 13+ POST_NOTIFICATIONS flow.
- In-app email signup widget POSTing `{ email, source, locale }` to existing `/api/subscribe`.

### Phase 6 — Deep links + web placeholders (1 day)

- `app_links` for `tesserapuzzle.com/s/<slug>` and `/es/s/<slug>` → opens a result view recreating the share card.
- Add to web app:
  - `/.well-known/apple-app-site-association` (route handler)
  - `/.well-known/assetlinks.json` (route handler)
  - `app/privacy/page.tsx`
  - `app/terms/page.tsx`

### Phase 7 — Store prep (1–2 days)

- App icon from existing `app/icon.png` / `apple-icon.png` (need 1024×1024 master — confirm we have one or generate).
- Screenshots for App Store + Play Store, both locales.
- Listing copy in en + es.
- TestFlight + Play Internal testing builds.
- Submit to App Store + Play Store.

**Total: ~10–15 working days before submission.**

## Deferred (not v1)

- Cross-device streak sync via Sign in with Apple / Google. Touches web and mobile simultaneously; needs auth UI, backend changes, and conflict resolution.
- `?demo` mode and synthetic cursor (web-only screen-recording aid).
- In-app custom OG cards (web `/api/og` route is reused via deep links).

## Open items needed before phase 7

- Apple Developer Program enrollment ($99/yr).
- Google Play Console account ($25 one-time).
- 1024×1024 icon master (confirm `apple-icon.png` resolution or generate).
- Final copy for `/privacy` and `/terms`, or approval to draft generic versions referencing dictionaryapi.dev, Loops, Vercel Analytics, and PostHog.
