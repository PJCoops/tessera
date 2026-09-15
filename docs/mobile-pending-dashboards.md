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
- [x] **Android signing SHA** — done 2026-09-15. Debug SHA-1
  `5F:B0:F2:52:A0:BC:77:1C:77:75:2E:9A:B5:E1:A3:69:05:B9:AB:FD`, release SHA-1
  `0A:D1:41:1E:CF:D1:CC:77:40:63:07:AD:B0:20:90:8D:DF:09:94:79` (a real
  release upload keystore was generated and wired into
  `android/app/build.gradle.kts` — see `android/key.properties`, gitignored,
  backed up to Bitwarden). `ANDROID_CERT_SHA256` set on the Vercel backend
  (production/preview/development) with both SHA-256 fingerprints,
  comma-separated.
- [x] **Google Android OAuth client** — done 2026-09-15. Two clients: one for
  `com.tesserapuzzle.app.dev` (debug SHA-1), one for `com.tesserapuzzle.app`
  (release SHA-1).
- [x] **AdMob account + real ad integration** — done 2026-09-15. AdMob app
  "Tessera Puzzle" created (iOS + Android), interstitial + banner ad units
  for both platforms, and the full client build (`google_mobile_ads`,
  `app_tracking_transparency`, the UMP/ATT consent flow, both placements) —
  see `docs/flutter-app-spec.md` Phase 7. Not blocked on anything further.
- [ ] **RevenueCat account** — still needed for the remove-ads IAP half of
  Phase 7. Create a RevenueCat project with a `remove_ads` non-consumable
  product and the matching App Store Connect / Play Console IAP products,
  then `purchases_flutter` + the paywall UI can be built.
- [ ] **Firebase project + `flutterfire configure`** — needed for Phase 8
  remote push (FCM/APNs via `firebase_messaging`). The token-registration
  endpoint (`POST`/`DELETE /api/v1/device-tokens`) and mobile client calls
  are already built and tested; blocked on this because
  `firebase_messaging`/`firebase_core` need `firebase_options.dart`
  generated against a live project, which can't be faked or skipped.
- [ ] **Sentry project + DSN** — needed for Phase 9 crash reporting on
  mobile (`sentry_flutter`). Server-side PostHog activation events and the
  entitlement/ad-gating plumbing are done without needing any new account.
  The client `posthog_flutter` SDK was previously blocked on the Phase 7
  consent flow not existing — that flow is now built (`mobile/lib/src/ads/
  consent_flow.dart`), so PostHog on mobile just needs its own build pass,
  not an account; Sentry is the only account-blocked item left of Phase 9.
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
