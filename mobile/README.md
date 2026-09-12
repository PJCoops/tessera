# Tessera mobile (Flutter)

Native iOS + Android client. Shares the Vercel/Supabase backend with the
Next.js web app (`../app`). See `../docs/flutter-app-spec.md` for the full
plan. Landed so far: Phase 1 (scaffold + flavors + shared-logic ports),
Phase 2 (playable board + first-run demo), Phase 3 (surrounding flows —
how-to sheet, hints toggle + dashed hint, reveal, history/stats,
today's words, settings, streak chip + countdown + legend, native share,
classic/hard, past-puzzle replay), Phase 4 (accounts — email OTP + Apple +
Google sign-in, cross-device sync, streak-decrease screen, in-app account
deletion), Phase 5 (global/country leaderboard, leagues — join by manual
code, standings + days-won tally, report-score), localization (en/es) and
daily local-notification reminders. Settings persist via
`shared_preferences`; everything wires through Riverpod providers.

## Toolchain

- Flutter **3.41.2** (pinned; keep local and CI in lockstep — spec §12.4).
- iPhone-only for v1 (`TARGETED_DEVICE_FAMILY = 1`).
- Android `minSdk 23`.

## Flavors

| Flavor | Bundle id / applicationId | Name |
| --- | --- | --- |
| `dev`  | `com.tesserapuzzle.app.dev` | Tessera Dev |
| `prod` | `com.tesserapuzzle.app`     | Tessera |

```sh
flutter run --flavor dev  -t lib/main_dev.dart
flutter run --flavor prod -t lib/main_prod.dart
```

### Pointing dev at a local backend

`dev` defaults to `https://dev.tesserapuzzle.com`. Until that (or the
`/api/v1/puzzle` route) is deployed, the app falls back to a bundled
sample puzzle. To run against the Next.js app locally, start it
(`npm run dev` in the repo root) and pass its origin:

```sh
flutter run --flavor dev -t lib/main_dev.dart \
  --dart-define=API_BASE_URL=http://localhost:3000
```

The iOS simulator reaches the host on `localhost`; the `Info.plist`
carries an `NSAllowsLocalNetworking` exception for the cleartext origin.

## Accounts (Phase 4)

Sign-in and sync are wired but need config to work end to end. **Full
step-by-step runbook: [`../docs/mobile-accounts-setup.md`](../docs/mobile-accounts-setup.md).**
The summary below is the short version.

**Build-time (`--dart-define`):**

`mobile/dart_defines.dev.json` (gitignored) holds the values — long
keys break if pasted on the command line, so use a file:

```json
{
  "API_BASE_URL": "http://localhost:3000",
  "SUPABASE_URL": "https://<ref>.supabase.co",
  "SUPABASE_ANON_KEY": "<anon / publishable key>",
  "GOOGLE_SERVER_CLIENT_ID": "<web OAuth client id, Google only>"
}
```

```sh
flutter run --flavor dev -t lib/main_dev.dart \
  --dart-define-from-file=dart_defines.dev.json
```

Without `SUPABASE_URL` / `SUPABASE_ANON_KEY` the app runs signed-out only
and the sign-in sheet shows "not set up yet". The Next.js app it talks to
needs `DATABASE_URL` + the Supabase vars in `.env.local` for the authed
`/api/v1/*` routes to answer.

**Still needed for Apple / Google (dashboards):**

- **Supabase:** enable the Apple and Google auth providers; confirm OTP
  send rate-limit, ≤10-min code expiry, and a verify-attempt cap (§6.1).
- **Apple:** an App ID with the *Sign in with Apple* capability + your Team
  ID. Enable it in Xcode (Runner target → Signing & Capabilities → +
  Capability → Sign in with Apple) — that wires `Runner.entitlements`
  (already in the repo) into the build. Android additionally needs an
  Apple *Services ID* + the commented callback `<activity>` in
  `AndroidManifest.xml`.
- **Google:** OAuth clients (iOS + web) in Google Cloud. Put the iOS
  reversed client id in `GOOGLE_REVERSED_CLIENT_ID` (flavor xcconfigs;
  `Info.plist` already references it) and the web client id in the
  `GOOGLE_SERVER_CLIENT_ID` dart-define. Android needs the release
  signing SHA-1 registered.

## Deep links (Phase 5)

`deep_links/deep_links.dart` handles a tapped league-invite link
(`https://tesserapuzzle.com/?join=<code>` — what the web app generates —
or `/join/<code>`, both declared in `app/.well-known/`) end to end: sign
in if needed, confirm, join, open standings. Nothing else in the app
handles a deep link yet — a shared-result link (`/s/*`) matches the
platform filters below but there's no "recreate this result" screen on
mobile, so it just opens the app to today's puzzle.

Still needed for the OS to actually hand the app a tapped link (until
then the code path above is unreachable, same as Apple/Google sign-in
being wired but non-functional pre-config):

- **iOS:** Associated Domains capability on both App IDs (Apple Developer
  → Identifiers → edit each → capabilities), then in Xcode: Runner target
  → Signing & Capabilities → + Capability → Associated Domains → add
  `applinks:tesserapuzzle.com` (same "don't hand-edit the entitlements
  file first" rule as Sign in with Apple — see `Runner.entitlements`).
  Also needs `APPLE_APP_ID` set on the deployed backend so
  `/.well-known/apple-app-site-association` serves the real Team ID
  instead of the `TEAMID.com.tesserapuzzle.app` placeholder.
- **Android:** the intent filter is already in `AndroidManifest.xml`
  (`android:autoVerify="true"` on `https://tesserapuzzle.com`), but it
  can't self-verify until `ANDROID_CERT_SHA256` (the same signing SHA
  needed for Google Sign-In) is set on the deployed backend so
  `/.well-known/assetlinks.json` lists real fingerprints. Unverified, a
  tapped link shows Android's app-picker sheet instead of opening Tessera
  directly.

## Shared assets

Locale JSON, fonts, `win.mp3`, `EPOCH`, the v1 schema, and the parity
fixture are vendored from the web app. Re-sync after changing any of those
sources:

```sh
dart run tool/sync_shared_assets.dart          # copy
dart run tool/sync_shared_assets.dart --check   # CI: fail if stale
```

## Test

```sh
flutter analyze
flutter test          # includes test/parity_test.dart (fixture-locked)
```

`test/fixtures/parity.json` is generated web-side (`npm run gen:parity` in
the repo root) and copied here by the sync script. The Dart ports in
`lib/src/` must reproduce every value in it.
