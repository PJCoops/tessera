# Tessera mobile — visual system (v0)

The one-pager called for in spec §18. Derived from the web app
(`app/globals.css`, `app/TesseraGame.tsx`, `app/lib/tier.ts`) and the
Phase 2 build. **The colour-blind palette and the default green/rust
retune (§17.2 / decision 13) still need design sign-off** — everything
here is structured so those are token edits, not rewrites.

## Type

| Role | Face | Notes |
| --- | --- | --- |
| Tile letters | **Inter** | Medium (500). Sans, matching the web app (`text-3xl font-medium`, system sans stack). Vendored `Inter-Medium.ttf`. |
| Kicker, status line, buttons | **Inter** | SemiBold (600) for the kicker; regular elsewhere. Vendored `Inter-SemiBold.ttf`. |
| Headlines (display) | **Fraunces** | Light (300). Vendored `Fraunces-Light/Bold.ttf`. |

Tile letter size = `tileSize * 0.42`. Kicker: 11px, letter-spacing 2,
uppercase, `muted`.

## Spacing

4 / 8 pt scale. Board tile gap = 8. Tile corner radius = 10. Screen
padding = 20.

## Colour tokens (`lib/src/theme/tokens.dart`)

Every game-state colour reads through `TesseraColors`. Base palette ports
`app/globals.css`; tile-state colours port `TesseraGame.tsx`.

| Token | Light | Dark | Meaning |
| --- | --- | --- | --- |
| `paper` | `#FAFAF7` | `#0E0E0E` | app background |
| `ink` / `inkSoft` / `muted` | `#0A0A0A` / `#1A1A1A` / `#6B6B63` | `#EDEDEA` / `#C8C8C2` / `#8A8A82` | text ramp |
| `tile` | `#F5F2E1` | `#2A2A27` | resting tile |
| `rule` | `#1A1A1A1A` | `#26FFFFFF` | hairline |
| `rowValid` | `#7A9070` | `#8AA47F` | tile in a completed row |
| `solved` | `#B85A1C` | `#C96B2E` | tile once the board is solved |
| `tileSelected` | `#0A0A0A` | `#EDEDEA` | 2.5px selection border |

### Colour-blind palette (§17.2) — PLACEHOLDER

`rowValid → #1F6FEB` (blue), `solved → #F0883E` (orange). Blue is
low-luminance, orange high, so the pair survives greyscale without a
secondary cue. **Not yet validated** against every surface or through Sim
Daltonism; treat as a starting point for the joint web+mobile retune.

## States (no non-colour cue on valid/solved — §17.2)

- **Resting**: `tile` fill, `rule` border, `ink` letter.
- **Selected**: 2.5px `tileSelected` border, scale 1.04. (Selection is not
  on the CVD-confusable axis, so a border here is fine.)
- **Row valid**: `rowValid` fill, `onRowValid` letter. No tick / icon / pattern.
- **Solved**: `solved` fill, `onSolved` letter, staggered bounce cascade
  (70ms per tile, reading order). Reduce-motion → instant recolour.

## Motion

- Swap: `AnimatedPositioned`, 200ms `easeOut` (transform only, §13.2).
  Reduce-motion: 90ms linear.
- Selection: `AnimatedScale` 1.04, 120ms.
- Win cascade: one-shot 1→1.1→1 per tile, staggered. Skipped under
  reduce-motion.

## Distinct from Wordle (§18, 4.3 defence)

Cream tiles on warm paper, rounded 10px tiles with a hairline border,
tap-to-select/tap-to-swap (not typing). Fraunces sets the kicker and
headlines. No 5×letter guess grid, no keyboard.

## Open

- First-run interactive demo screen (§16.1) — Phase 2, not yet built.
- Full palette contact-sheet QA through the three CVD types (§17.2).
- Dark-mode elevation / true-black OLED option (§18).
