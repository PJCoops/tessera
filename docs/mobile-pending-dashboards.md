# Mobile — remaining dashboard / credential work

All the app code below is already built and tested. These items are pure
dashboard/Xcode/credential config that only PJ can do — none depend on each
other, work through in any order.

- [ ] **Apple Sign In** — Apple Developer → Identifiers → edit both App IDs
  (`com.tesserapuzzle.app`, `com.tesserapuzzle.app.dev`) → enable "Sign In
  with Apple" capability. Then Xcode → Runner target → Signing &
  Capabilities → + Capability → Sign in with Apple (do NOT hand-edit
  `Runner.entitlements` first — breaks debug signing). Supabase → Auth →
  Providers → Apple → enable, Authorized Client IDs = both bundle ids. (See
  `docs/mobile-accounts-setup.md` §5 for full detail.)
- [ ] **Apple Associated Domains** (deep links) — same two App IDs, enable
  Associated Domains capability; Xcode → + Capability → Associated Domains
  → add `applinks:tesserapuzzle.com`.
- [ ] **`APPLE_APP_ID`** env var on the deployed (Vercel) backend —
  `<TeamID>.com.tesserapuzzle.app`. Needed for both Sign in with Apple and
  for `/.well-known/apple-app-site-association` to serve the real value
  instead of the `TEAMID.com.tesserapuzzle.app` placeholder.
- [ ] **Android signing SHA** — `cd mobile/android && ./gradlew
  signingReport`, copy the debug + release SHA-1 (Google Sign-In Android
  OAuth client) and SHA-256 (`ANDROID_CERT_SHA256` env var on the backend,
  comma-separated, colon-hex — needed for both Google Sign-In and for
  `/.well-known/assetlinks.json` App Links verification).
- [ ] **Google Android OAuth client** — Google Cloud Console → Credentials
  → new Android client using the package + SHA-1 above.
- [ ] **AdMob + RevenueCat accounts** — needed to actually build Phase 7
  (monetization) beyond the account-free plumbing already done (entitlement
  read + interstitial gating logic). Create an AdMob app + ad unit ids
  (interstitial + banner), a RevenueCat project with a `remove_ads`
  non-consumable product, and the matching App Store Connect / Play Console
  IAP products.
- [ ] **Firebase project + `flutterfire configure`** — needed for Phase 8
  remote push (FCM/APNs via `firebase_messaging`). The token-registration
  endpoint (`POST`/`DELETE /api/v1/device-tokens`) and mobile client calls
  are already built and tested; blocked on this because
  `firebase_messaging`/`firebase_core` need `firebase_options.dart`
  generated against a live project, which can't be faked or skipped.
- [ ] **Sentry project + DSN** — needed for Phase 9 crash reporting on
  mobile (`sentry_flutter`). Server-side PostHog activation events and the
  entitlement/ad-gating plumbing are done without needing any new account;
  this and the client `posthog_flutter` SDK (blocked on the Phase 7 consent
  flow, not an account) are what's left of Phase 9.
- [ ] **Verify the country leaderboard from a real deploy** — country comes
  from the `x-vercel-ip-country` header, which only Vercel's edge injects
  based on the requester's real IP; it's always absent against a local dev
  backend, so the board is always empty there by design (the SQL/filtering
  logic itself is correct — confirmed via
  `curl -H "x-vercel-ip-country: GB" localhost:3000/api/v1/leaderboard...`).
  Once a build points at a deployed (Vercel) backend, open the Country tab
  and confirm it shows a real, non-empty board.

Already done and verified live: email OTP sign-in, Google Sign-In (iOS),
cross-device sync, streak-decrease screen, delete/restore, leaderboard +
leagues read/join/report, league-invite share sheet. See
`docs/mobile-accounts-setup.md` for the account-flow setup detail.
