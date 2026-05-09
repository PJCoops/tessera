# Tier rework + hint-tile tightening (4×4 + 5×5 Hard mode)

## Context

Two product intuitions to act on:

1. **Tiers feel arbitrary.** Today they're absolute move thresholds (≤10 / ≤20 / ≤35 / ≤60), but every puzzle has a different intrinsic difficulty (min-swaps to solve ranges roughly 5–11 on 4×4). A 5-min-swaps puzzle and an 11-min-swaps puzzle are graded on the same scale, which is why the same tier means very different things.
2. **Too many dotted tiles.** The hint rule dots any tile in a row whose letter is "useful" anywhere in that row's gold word. With duplicate letters and 4-letter rows, this paints over half the board on average — too generous. The problem will be more visible at 5×5 (25 tiles).

A "par"/golf and a "show-min-swaps" idea also came up. Both depend on having min-swaps as data; recommendation is to compute it but **not** surface it as a number. The ratio-based tier already encodes the same signal more gracefully, and Tessera is a discovery puzzle — telling players "this can be done in 7" reframes it as a minimisation puzzle, which is a different (and arguably worse) game.

**Cross-cutting goal:** a parallel session is adding a 5×5 Hard mode (wordlists `app/lib/{words,solution-words}-5.json` and `-es-5.json` already in tree; `puzzle.ts` already takes an `N` parameter; `TesseraGame.tsx` already reads `N` from `mode.N`). This plan needs to land **before or alongside** the 5×5 launch so Hard mode ships with the new tier system and tightened hints from day one — no second migration, no two coexisting tier schemes.

## What the data says (PostHog `puzzle_solved`, pulled 2026-05-08)

668 events across puzzles 5–12. Filtering to the live daily flow (`$pathname = '/'`) and the truly clean cohort (puzzles 10–12, post-wordlist-prune on 2026-05-05; earlier puzzles can't be reproduced from current code because the gold grid generator changed):

| puzzle | minSwaps | solves | min moves | median moves | max moves | median ratio |
|--------|---------:|-------:|----------:|-------------:|----------:|-------------:|
| 10     |        5 |    101 |         9 |           13 |        65 |        2.60× |
| 11     |        7 |     96 |         8 |           15 |        60 |        2.14× |
| 12     |        6 |     91 |         6 |            9 |        49 |        1.50× |

`moves / minSwaps` ratio distribution (n=288):

```
[1.00– 1.25)   8.7%  #####
[1.25– 1.50)  10.4%  ######
[1.50– 2.00)  21.2%  #############
[2.00– 2.50)  19.8%  ############
[2.50– 3.50)  16.3%  #########
[3.50– 5.00)  11.1%  ######
[5.00– 7.00)   8.7%  #####
[7.00–10.00)   3.1%  ##
[10.00+    )   0.7%
```

Median 2.14×, mean 2.73×, p75 3.20×, p90 5.00×. Min ratio 1.00 (someone solved puzzle 12 in exactly the optimum 6 moves) — sanity check that the exact solver is correct.

Solver detail: `minSwaps` is computed exactly by enumerating per-letter source-to-target permutations on 16 cells (constrained bipartite matching, brute-forced; combinatorics small enough — under ~20k assignments per puzzle), then taking `16 − max_cycle_count`. The earlier off-by-one on puzzle 9 turned out to be a wordlist-version mismatch, not a solver bug.

## Recommended bands

Tested four candidates against the clean cohort:

| label                         | bands                    | L     | G     | W     | P     | T    |
|-------------------------------|--------------------------|-------|-------|-------|-------|------|
| **recommended (loose)**       | **1.5 / 2.5 / 4.5 / 7.0** | **23.6%** | **37.8%** | **25.7%** | **9.7%** | **3.1%** |
| balanced                      | 1.4 / 2.25 / 4.0 / 6.5   | 13.5% | 38.5% | 32.6% | 10.4% | 4.9% |
| medium                        | 1.25 / 2.0 / 3.5 / 6.0   | 9.7%  | 38.2% | 30.9% | 15.3% | 5.9% |
| tight                         | 1.15 / 1.75 / 3.0 / 5.0  | 2.4%  | 27.4% | 42.7% | 17.7% | 9.7% |

**Going with 1.5 / 2.5 / 4.5 / 7.0** per the "make the bands a little looser" preference. Distribution: Legendary at quartile (24%), Genius modal (38%), Wordsmith healthy (26%), Persistent and Tenacious real but rare (10% / 3%).

These are calibrated on 288 solves across 3 puzzles. Defensible v1, not the final answer — re-pull and recheck after ~30 days of post-stable puzzles.

## Implementation

### 1. Add exact `minSwaps` solver to puzzle.ts (N-aware)

In [`app/lib/puzzle.ts`](app/lib/puzzle.ts):

- Add `minSwaps: number` to `DailyPuzzle` (line 72).
- Implement `computeMinSwaps(positions: Tile[], goldRows: string[]): number`:
  - Let `N = goldRows.length`, `cells = N * N`.
  - Group source-cell indices and target-cell indices by letter.
  - For each letter, enumerate permutations of source-cells onto target-cells.
  - Combine across letters; for each full assignment count cycles in the resulting permutation; track max.
  - Return `cells − max_cycles`.
  - **Combinatorics safety:** product of `(k_L!)` across letters can be large. Empirical cap from calibration:
    - 4×4: typically <20k combos, never seen above 100k.
    - 5×5: mean ~260k, max observed ~10M across 200 random samples.
  - Use a 50M cap (covers the 5×5 long tail with headroom). If exceeded, fall back to the heuristic solver below and tag the puzzle's `minSwaps` as approximate.
- **Heuristic fallback** (cheap, monotonic, slight overestimate):
  - Greedy: skip already-correct cells; for each remaining cell, prefer pairing with a destination that points back (forms a 2-cycle); count cycles, return `moved − cycles`. This is what the v0 prototype used; documented to be off by ≤2 for 4×4. For 5×5 a tighter heuristic may be worth the extra code, but only if the exact cap is hit in practice (it shouldn't be for normal grids).
- Populate `minSwaps` in `generateDailyPuzzleFor` (line 237) — runs once per puzzle per session, no perf concern.
- If the project ships server-side puzzle generation (see [tasks/server-side-puzzle-generation.md](tasks/server-side-puzzle-generation.md)), compute and persist `minSwaps` there instead of recomputing client-side.

Reference implementation: the exact solver from the calibration session is in this repo's session log (per-letter permutation enumeration); port to TS keeping the structure identical.

### 2. Switch tiers to ratio-based bands in tier.ts

In [`app/lib/tier.ts`](app/lib/tier.ts):

- Replace `TIERS` (line 11) with ratio thresholds:
  ```ts
  export const TIERS: readonly { key: TierKey; maxRatio: number }[] = [
    { key: "legendary",  maxRatio: 1.5 },
    { key: "genius",     maxRatio: 2.5 },
    { key: "wordsmith",  maxRatio: 4.5 },
    { key: "persistent", maxRatio: 7.0 },
    { key: "tenacious",  maxRatio: Infinity },
  ];
  ```
- Change `getTier(moves: number)` → `getTier(moves: number, minSwaps: number)`. Compute `ratio = moves / minSwaps`, return the highest tier whose `maxRatio ≥ ratio`.
- Floor: if `minSwaps === 0` (already-solved edge case), default to Legendary.
- **One band set across both modes.** Ratios normalise out grid size — Legendary on 5×5 should mean the same thing it means on 4×4 ("near-optimal play"), and the player skill curve at 5×5 is unknown until launch. After ~30 days of 5×5 data, recheck whether Hard players cluster at higher ratios and consider mode-specific bands only if the distribution is meaningfully different.

### 3. Plumb minSwaps through to call sites

`getTier` is called in four places — each needs `minSwaps`:

- [`app/TesseraGame.tsx`](app/TesseraGame.tsx) `SolvedStatus` (line 951): pass `puzzle.minSwaps` from caller.
- [`app/lib/share.ts`](app/lib/share.ts): include `minSwaps` in `buildSharePayload` inputs and use in tier lookup.
- [`app/HistoryModal.tsx`](app/HistoryModal.tsx): tier distribution chart (lines 140–150) needs `minSwaps` per result.
- Stats page (whichever component renders the tier badge there).

**Migration / legacy data:** historic results in localStorage have no `minSwaps`. Two options:
- **Backfill (preferred):** when reading a legacy result with no `minSwaps`, regenerate the puzzle from `num` via `generateDailyPuzzleFor` and recompute. Deterministic, accurate.
- **Fallback:** if regeneration ever throws or the seed isn't available, fall back to the old absolute thresholds for that single row.

### 4. Tighten the dotted-tile rule (home row + multiset)

In [`app/TesseraGame.tsx`](app/TesseraGame.tsx) lines 503–526, change the hint-assignment loop:

- Current: iterate all N cells in the row in priority order (home tiles first), dot any tile whose letter is in the row's multiset.
- New: only iterate cells whose tile is in its home row. Non-home tiles never get the dot.

Concretely, replace the `order` array with `[0..N-1].map(c => r*N + c).filter(idx => Math.floor(positions[idx].id / N) === r)` and drop the priority sort. The surrounding loop already uses `N` from `mode.N`, so this works for both 4×4 and 5×5 unchanged.

This drops the "spillover" hints where a non-home tile happens to have a useful letter for its current row. Re-run the simulation script with the new rule for both grid sizes to confirm the dot-count distribution before merging — the impact will be more visually noticeable at 5×5 because the absolute number of dots drops further.

### 5. Don't add a "par" or "min-swaps" UI label

Both ideas were considered and rejected — the ratio-based tier already encodes the same signal, and surfacing min-swaps directly reframes the game as minimisation rather than discovery. Worth a separate A/B if the assumption is wrong, but not a v1.

## Files to touch

- [app/lib/puzzle.ts](app/lib/puzzle.ts) — add N-aware `minSwaps` field + exact/heuristic solver, populate in `generateDailyPuzzleFor`.
- [app/lib/tier.ts](app/lib/tier.ts) — ratio bands, `getTier(moves, minSwaps)` signature.
- [app/TesseraGame.tsx](app/TesseraGame.tsx) — tighten `homeHintByIdx` rule (line 503); pass `puzzle.minSwaps` into `SolvedStatus` and share payload. Also include `mode` (or `N`) in the `puzzle_solved` analytics props so future calibration can split 4×4 vs 5×5.
- [app/lib/share.ts](app/lib/share.ts) — pass `minSwaps` through to tier lookup.
- [app/HistoryModal.tsx](app/HistoryModal.tsx) — tier distribution chart needs `minSwaps`; backfill 4×4 legacy results by regeneration. 5×5 has no legacy data — clean slate.
- [app/lib/analytics.ts](app/lib/analytics.ts) — extend `puzzle_solved` props to include `mode` / `N` and `minSwaps` (the latter helps recompute ratios server-side without rerunning the solver).
- Locale dictionaries — no copy changes if tier names stay; revisit if a tooltip explaining "Legendary = near-optimal" is wanted.

## Verification

1. Unit-test the min-swaps solver against ~10 hand-built scrambles whose optimal solution is known. Cover both grid sizes and the edge cases: already-solved grid (`minSwaps = 0`), single-swap solve (`minSwaps = 1`), and a high-duplicate-letter 5×5 to exercise the brute-force enumeration.
2. Re-run the simulation script with the tightened hint rule for both 4×4 and 5×5; confirm the mean dotted-tile count drops meaningfully. Targets: 4×4 around 4–5 / 16 (down from ~8.6); 5×5 expect proportionally similar (down from ~13.5 to ~7–8).
3. Run dev server, play 5 puzzles spanning the difficulty range in **each** mode; confirm tier labels feel earned and the dot count looks visibly less generous. Test mode-switching mid-session for any state bugs.
4. After ~30 days post-launch (separately for each mode), re-pull `puzzle_solved` from PostHog filtered by `mode`/`N` and recompute the ratio distribution under the new bands. 4×4 target: Legendary ~20–25%, Genius ~35–40%, Wordsmith ~25–30%, Persistent ~8–12%, Tenacious ~3–5%. 5×5 target unknown — collect the distribution first, then decide if mode-specific bands are warranted.
5. Verify `HistoryModal` renders pre-migration 4×4 solves without errors (legacy localStorage rows with no `minSwaps`); verify 5×5 results render correctly from day one (no legacy concerns).
6. Confirm the brute-force solver never trips the 50M cap on real production puzzles for either mode in the first few weeks; if it does, log telemetry so we know to invest in a smarter algorithm.

## Calibration data (for reference)

- PostHog query (run from `.env.local` `POSTHOG_PERSONAL_API_KEY` / `POSTHOG_PROJECT_ID`, host `https://eu.posthog.com`):
  ```sql
  SELECT JSONExtractInt(properties, 'num') AS num,
         JSONExtractInt(properties, 'moves') AS moves,
         JSONExtractInt(properties, 'N') AS N  -- once analytics is extended
  FROM events
  WHERE event = 'puzzle_solved'
    AND timestamp > now() - INTERVAL 60 DAY
    AND JSONExtractString(properties, '$pathname') = '/'
  ORDER BY N, num, moves
  ```
- Exact 4×4 `minSwaps` per puzzle (current wordlist):
  ```
  num  5: 7   num 10: 5
  num  6: 8   num 11: 7
  num  7: 9   num 12: 6
  num  8: 7   num 13: 9
  num  9: 8
  ```
- For puzzles 5–9, the gold grids in production differed from current regeneration because the wordlist + legality fix were committed mid-cohort. 4×4 recalibration uses puzzles 10+ only.
- 5×5 combinatorics check (200 random samples): mean ~262k assignments, max ~9.7M — exact solver is feasible with a 50M cap.
