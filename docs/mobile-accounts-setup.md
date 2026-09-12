# Mobile accounts — setup runbook

The Flutter accounts code (spec Phase 4) is built and unit-tested. It won't
work end to end until the items below are done. They're all
dashboard / Xcode / credential work only you can do.

Do them roughly in order. **Email OTP works after step 1–2.** Google needs
1–2 + 4. Apple needs 1–2 + 5.

Legend: 🔑 = produces a value you paste somewhere later.

---

## 1. Supabase project — auth config

Project: the existing EU Tessera project (same one the web app uses).

1. **Auth → Providers → Email**
   - Enable **Email OTP** (the 6-digit code flow). "Confirm email" can stay
     on — the app verifies `type: email` then falls back to `type: signup`.
   - **Email OTP expiration**: leave at the 3600 s default (a short value
     like 60 s expires the code before you can read the email and type it).
   - **Email OTP length**: 6.
2. **Auth → Email Templates → Magic Link**
   - The body must contain `{{ .Token }}` so the email carries the code,
     not just a link. (Same requirement as web — `docs/accounts-spec.md`.)
3. **Auth → Rate limits**
   - Confirm a sane per-hour cap on "Token verifications" and "OTP / magic
     link sends" so a 10⁶ code space can't be brute-forced (spec §6.1).
4. 🔑 **Project URL** and 🔑 **anon / publishable key** — Settings → API.
   You'll pass these as `--dart-define`s.
5. 🔑 **Connection string** (transaction pooler, port 6543) — Settings →
   Database. Needed for `.env.local` so the local API can answer authed
   routes.

---

## 2. Local `.env.local` (repo root)

So `npm run dev` can serve `/api/v1/results`, `/api/v1/account`, etc.
Create `/.env.local` (gitignored):

```
NEXT_PUBLIC_SUPABASE_URL=<project url from 1.4>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from 1.4>
DATABASE_URL=<pooler connection string from 1.5>
NEXT_PUBLIC_ACCOUNTS_ENABLED=1
# optional, for the delete-account confirmation email:
LOOPS_API_KEY=<existing key>
```

Restart `npm run dev` after creating it. Sanity check:

```sh
curl -s http://localhost:3000/api/v1/app-config
# -> {"minSupportedVersion":"1.0.0","whatsNew":null,"flags":{}}
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/v1/results
# -> 401  (not 503 — 503 means DATABASE_URL still missing)
```

### 2b. Apply the Phase B schema to the DB

There's only one database (the EU Supabase project), so the Phase B
columns/tables (`profiles.deleted_at`, `device_tokens`,
`entitlement_events`, …) must exist before any authed `/api/v1/*` route
works — otherwise `GET /api/v1/results` 500s with
`column "deleted_at" does not exist`. Run the Phase B block from
`schema.sql` (everything under "Phase B: mobile backend workstream") once
against the live DB. It's all `add column / create table if not exists`,
so re-running is safe and the live web app is unaffected. `psql` or a
one-off `postgres`-client script both work.

---

## 3. First end-to-end run (email OTP only)

Put the values in `mobile/dart_defines.dev.json` (gitignored — long keys
break when pasted on a command line):

```json
{
  "API_BASE_URL": "http://localhost:3000",
  "SUPABASE_URL": "https://<ref>.supabase.co",
  "SUPABASE_ANON_KEY": "<anon key>"
}
```

```sh
cd mobile
flutter run --flavor dev -t lib/main_dev.dart \
  --dart-define-from-file=dart_defines.dev.json
```

Then:

1. Play/solve today's puzzle **while signed out**.
2. Top-right ⚙ → **Sign in** → enter a real email you can read → **Send
   code** → type the 6-digit code from the email → the sheet closes.
3. In the `npm run dev` console you should see, in order:
   `GET /api/v1/results 200`, `POST /api/v1/results/import 200`.
4. **Second-device pull:** stop the app, delete it from the simulator (or
   `xcrun simctl uninstall booted com.tesserapuzzle.app.dev`), re-run,
   sign in with the same email. History + streak should come back from the
   server (`GET /api/v1/results` on launch).

If the code email never arrives: check Supabase → Auth → Logs; confirm
the Magic Link template has `{{ .Token }}` (step 1.2).

---

## 4. Google Sign-In

### 4a. Google Cloud Console → APIs & Services → Credentials

Create **OAuth 2.0 Client IDs** (same Google Cloud project as any existing
Tessera OAuth, or a new one):

| Type | Details | Used for |
| --- | --- | --- |
| **Web application** | no redirect needed | 🔑 `GOOGLE_SERVER_CLIENT_ID` (dart-define) **and** Supabase's Google provider "Client ID" |
| **iOS** | bundle IDs `com.tesserapuzzle.app` and `com.tesserapuzzle.app.dev` | 🔑 gives you an iOS client ID → its **reversed** form `com.googleusercontent.apps.NNNN-XXXX` is `GOOGLE_REVERSED_CLIENT_ID` |
| **Android** | package `com.tesserapuzzle.app` (+ `.dev`) + the release & debug signing **SHA-1** (step 6) | registration only — not referenced in code |

Also grab the Web client's **client secret** for Supabase.

### 4b. Supabase → Auth → Providers → Google

- Enable it.
- **Client ID (for OAuth)** = the Web client ID; **Secret** = its secret.
  (Supabase's UI merges "Client ID" and "Authorized Client IDs" into one
  **Client IDs** box — put the Web + both iOS client IDs there,
  comma-separated, no spaces. This is what lets native
  `signInWithIdToken` through.)
- **Skip nonce checks: ON.** The `google_sign_in` Flutter package has no
  way to pass a custom nonce to iOS's native `GIDSignIn`, but the SDK
  embeds its own nonce in the ID token anyway — Supabase then rejects it
  with "Passed nonce and nonce in id_token should either both exist or
  not" unless this is on. Supabase's own field description calls out
  exactly this iOS case.

### 4c. iOS project

Put the reversed iOS client ID in each flavor xcconfig
(`mobile/ios/Flutter/devDebug.xcconfig`, `prodDebug.xcconfig`, …Profile,
…Release — 6 files):

```
GOOGLE_REVERSED_CLIENT_ID=com.googleusercontent.apps.NNNN-XXXX
```

`Info.plist` already references `$(GOOGLE_REVERSED_CLIENT_ID)`.

### 4d. Run with Google enabled

Add `--dart-define=GOOGLE_SERVER_CLIENT_ID=<web client id>` to the run
command from step 3. The **Continue with Google** button in the sign-in
sheet should now complete.

---

## 5. Sign in with Apple

### 5a. Apple Developer → Identifiers

1. **App IDs**: edit `com.tesserapuzzle.app` and `com.tesserapuzzle.app.dev`
   → enable the **Sign In with Apple** capability.
2. 🔑 Note your **Team ID** (10 chars). For the backend deep-link file,
   `APPLE_APP_ID = <TeamID>.com.tesserapuzzle.app`.
3. **Services ID** (only needed for Android's web-redirect flow): create
   one (e.g. `com.tesserapuzzle.signin`), enable Sign In with Apple,
   configure the return URL to
   `https://<project>.supabase.co/auth/v1/callback`.
4. **Keys**: create a key with Sign In with Apple enabled, download the
   `.p8`, note the **Key ID**.

### 5b. Supabase → Auth → Providers → Apple

- Enable it.
- **Authorized Client IDs** = `com.tesserapuzzle.app,com.tesserapuzzle.app.dev`
  (native iOS only needs this).
- For Android also fill **Services ID**, **Team ID**, **Key ID**, and the
  `.p8` contents.

### 5c. Xcode — enable the capability (wires the entitlement safely)

```sh
open mobile/ios/Runner.xcworkspace
```

Runner target → **Signing & Capabilities** → pick your Team →
**+ Capability → Sign in with Apple**. Xcode adds
`CODE_SIGN_ENTITLEMENTS = Runner/Runner.entitlements` to the project
(the file already exists in the repo). Do **not** add the entitlement by
hand before this — it breaks debug code-signing.

### 5d. Android (optional, later)

Uncomment the `SignInWithAppleCallback` `<activity>` in
`mobile/android/app/src/main/AndroidManifest.xml` and set the scheme/host
to match the Services ID return URL.

---

## 6. Android signing SHA-1 (for step 4a Android client)

```sh
cd mobile/android && ./gradlew signingReport
# copy the SHA1 lines for the `debug` and `release` variants
```

---

## 7. Verify the remaining flows

With everything from 1–5 in place:

- **Streak-decrease screen.** Hard to trigger naturally. In the Supabase
  SQL editor, mark today as revealed for your user:
  ```sql
  update puzzle_results set revealed = true
  where user_id = '<your uuid>' and mode = 'classic'
    and puzzle_number = <today's number>;
  ```
  Then on a device where today is a *win*, sign out and back in — the
  "Your streak synced" screen should appear once.
- **Delete account.** Settings → Delete account → Delete → enter the
  emailed code. You should land on "Deletion scheduled" with a date.
  Check `select deleted_at from profiles where id = '<uuid>'` is set. Tap
  **Restore account** → `deleted_at` clears. (The `purge-deleted-accounts`
  cron only runs on the deployed backend.)
- **Second-method prompt.** Fresh install → sign in with email → a
  one-time "Add a backup sign-in" dialog appears after the first sign-in.

---

## 8. Deployed backend (when you're ready to ship, not before)

Set in the Vercel project env (not committed):
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`DATABASE_URL`, `NEXT_PUBLIC_ACCOUNTS_ENABLED=1`, `MIN_SUPPORTED_VERSION`,
`APPLE_APP_ID`, `ANDROID_CERT_SHA256`, `LOOPS_API_KEY`, `CRON_SECRET`,
and the RevenueCat keys (Phase 7). Apply the Phase B schema block in
`schema.sql` to the live DB by hand (no migration tooling). Merge
`phase-b-backend` (already merged into `flutter-phase-4`) to `main`.

---

## Checklist

- [x] Supabase Email OTP on, expiry 3600 s, `{{ .Token }}` in template
- [x] `.env.local` with URL / anon key / `DATABASE_URL`; `curl` checks pass
- [x] Phase B schema block applied to the DB (step 2b)
- [x] Email OTP sign-in + sync verified on one device (step 3) — sign in
      → pull history → solve → `POST /api/v1/results`
- [x] Second-device pull verified (fresh install → sign in → history back)
- [x] Google: Cloud OAuth clients created, Supabase provider on (skip
      nonce checks on), reversed id in xcconfigs, `GOOGLE_SERVER_CLIENT_ID`
      dart-define, button works — verified end to end
- [ ] Apple: App ID capability on, Supabase provider on, Xcode capability
      added, button works
- [x] Streak-decrease screen seen once (step 7)
- [x] Delete → grace → restore verified (step 7)
- [ ] `APPLE_APP_ID`, `ANDROID_CERT_SHA256` recorded for the backend
