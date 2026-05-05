# Server-side puzzle generation — plan

Future work. Not started. Tracked here so we can come back to it without re-deriving the design.

## Why

The current architecture ships `generateDailyPuzzleFor`, both English and Spanish wordlists, and the seeded RNG to every client. Anyone with devtools can call into the bundle and read any future puzzle in under a minute. The `?day=` cap and HMAC slugs only stop casual URL tweaking — neither moves logic off the client.

Server-side generation is the only way to stop devtool extraction.

## What changes

1. **New endpoint:** `GET /api/puzzle?date=YYYY-MM-DD&locale=en|es`
   - Returns `{ goldRows: string[4], startTiles: Tile[16], num: number }`.
   - Refuses any date strictly greater than today (UTC) with 403.
   - Refuses dates before the epoch with 404.
   - Caches at the edge (`Cache-Control: public, s-maxage=86400, stale-while-revalidate=3600`) — same input always produces the same output.
   - Per-locale: en and es generate independently, same seed/algorithm, different wordlists.

2. **Wordlists leave the bundle.** `app/lib/words.json`, `solution-words.json`, `words-es.json`, `solution-words-es.json`, and `accented-map-es.json` move to a server-only path (e.g. `lib/server/wordlists/`) and are no longer imported by any client component. Bundle drops by ~100KB. `app/lib/puzzle.ts` splits into a server module that exports the engine + a client module that just defines the `Tile` type and helpers like `tilesFromRows` (which is purely structural and harmless to ship).

3. **Client refactor.** `TesseraGame.tsx` no longer calls `generateDailyPuzzleFor` on mount. It fetches `/api/puzzle?date=...&locale=...` and caches the response in `sessionStorage` keyed by `puzzle:<locale>:<date>`. Subsequent reloads on the same day skip the network. The existing localStorage keys (`tessera:result:N`, `tessera:progress:N`, `tessera:streak`) are unchanged.

4. **Loading state.** New "fetching today's puzzle…" placeholder for first paint. The existing pre-mount empty grid rectangle is the right shape for this — just keep it visible until the fetch resolves.

5. **Replay flow stays the same.** `?day=YYYY-MM-DD` still triggers replay isolation, but the puzzle data now comes from the server. Server's date check makes the client-side cap redundant — keep the client cap anyway for fast UX (avoid a wasted request).

6. **Share / OG card flow stays the same.** `/s/[slug]` and `/api/og` are server-rendered already and can call the same engine internally.

## Flutter implications

- The Dart port no longer needs to embed the algorithm or wordlists — saves a lot of work in Phase 1 of the Flutter plan.
- Mobile app calls the same `/api/puzzle` endpoint. Caches per day in `shared_preferences`.
- **Offline-first becomes "offline-after-first-fetch":** new day requires connectivity once. Acceptable for a daily puzzle, but worth flagging in the Flutter plan.
- Update `tasks/flutter-app-plan.md` Phase 1 to delete the algorithm-port work and add a small `puzzle_client.dart` that hits the endpoint.

## Risks and tradeoffs

- **First-load latency** up by one round trip (~50–200ms on Vercel edge). Mitigated by edge caching — every client after the first hit on a given date gets a CDN response.
- **Offline play** breaks for the very first visit on a new day. After that, cached locally.
- **Vercel function invocation cost.** Each unique date+locale generates one cached response per edge node. Negligible scale.
- **Dev workflow.** `?day=YYYY-MM-DD` overrides still work for testing past puzzles. Future-date testing requires temporarily disabling the server cap (env var `ALLOW_FUTURE_PUZZLES=1` or similar, off in prod).

## Phases

1. **Carve up `puzzle.ts`.** Pull the engine into `lib/server/puzzle.ts`; keep `Tile` and `tilesFromRows` in `app/lib/puzzle.ts`. No behaviour change yet.
2. **Add the API endpoint.** `app/api/puzzle/route.ts` calls the server engine, gates by date, sets cache headers. Add a vitest test that covers: past date returns the same gold grid as the current client output (parity), today returns 200, future returns 403, malformed date returns 400, both locales work.
3. **Switch the client.** Replace the `generateDailyPuzzleFor` call in `TesseraGame.tsx` with a fetch + sessionStorage cache. Loading state in place.
4. **Drop wordlists from the client bundle.** Verify with `npx next build` and bundle analyzer that `words*.json` and `solution-words*.json` no longer appear in any client chunk.
5. **Update `/api/og`, `/s/[slug]`, and the email-cron** to use the server engine directly (they're already server-side).
6. **Update Flutter plan** to remove the algorithm-port work.

Estimated effort: half a day for steps 1–4, another hour or two for 5–6.

## Open questions for when we pick this up

- Do we want a `force` flag for staging environments to allow generating future puzzles for QA? Probably yes, gated by env var.
- Edge caching — Vercel's edge cache or `unstable_cache` from `next/cache`? The endpoint is deterministic per `(date, locale)`, so either works. Edge cache is simpler.
- Do we move `app/lib/rng.ts` server-side too? It's tiny and harmless to ship; leave it client-side so analytics events that include `seedFromDate` keep working.
- For the Flutter app, do we add a single retry on network failure? Probably yes — daily puzzle on flaky 4G is the worst-case scenario worth being defensive about.
