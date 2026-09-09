# Tessera mobile (Flutter)

Native iOS + Android client. Shares the Vercel/Supabase backend with the
Next.js web app (`../app`). See `../docs/flutter-app-spec.md` for the full
plan. Landed so far: Phase 1 (scaffold + flavors + shared-logic ports),
Phase 2 (playable board + first-run demo), Phase 3 (surrounding flows —
how-to sheet, hints toggle + dashed hint, reveal, history/stats,
today's words, settings, streak chip + countdown + legend, native share,
classic/hard, past-puzzle replay). Settings persist via
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
