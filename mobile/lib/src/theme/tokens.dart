import 'package:flutter/material.dart';

/// Semantic colour layer (spec §18). Every game-state colour read goes
/// through a token here, so the colour-blind palette (§17.2) is a token
/// swap rather than scattered hex. Base palette is ported from the web
/// app's `app/globals.css`; the tile-state colours come from
/// `TesseraGame.tsx` / `tier.ts` (green `#7a9070`, rust `#b85a1c`).
@immutable
class TesseraColors extends ThemeExtension<TesseraColors> {
  const TesseraColors({
    required this.ink,
    required this.inkSoft,
    required this.paper,
    required this.cream,
    required this.muted,
    required this.rule,
    required this.tile,
    required this.tileSelected,
    required this.rowValid,
    required this.solved,
    required this.hint,
    required this.error,
    required this.onInverse,
    required this.onRowValid,
    required this.onSolved,
  });

  final Color ink; // primary text / on-paper
  final Color inkSoft; // secondary text
  final Color paper; // app background
  final Color cream; // resting tile / raised surface
  final Color muted; // tertiary text
  final Color rule; // hairline borders (already alpha-blended)
  final Color tile; // resting tile fill (== cream, named for intent)
  final Color tileSelected; // selection ring colour
  final Color rowValid; // a tile in a completed row
  final Color solved; // a tile once the whole board is solved
  final Color hint; // home-position dashed hint outline
  final Color error;
  final Color onInverse; // text on ink-filled surfaces
  final Color onRowValid; // text on a row-valid tile
  final Color onSolved; // text on a solved tile

  // ── Light ────────────────────────────────────────────────────────────
  static const _greenLight = Color(0xFF7A9070);
  static const _rustLight = Color(0xFFB85A1C);
  static const _onTile = Color(0xFFFAFAF7);

  static const light = TesseraColors(
    ink: Color(0xFF0A0A0A),
    inkSoft: Color(0xFF1A1A1A),
    paper: Color(0xFFFAFAF7),
    cream: Color(0xFFF5F2E1),
    muted: Color(0xFF6B6B63),
    rule: Color(0x1A1A1A1A),
    tile: Color(0xFFF5F2E1),
    tileSelected: Color(0xFF0A0A0A),
    rowValid: _greenLight,
    solved: _rustLight,
    hint: Color(0xFF0A0A0A),
    error: Color(0xFFB4442A),
    onInverse: Color(0xFFFAFAF7),
    onRowValid: _onTile,
    onSolved: _onTile,
  );

  // ── Dark ─────────────────────────────────────────────────────────────
  static const dark = TesseraColors(
    ink: Color(0xFFEDEDEA),
    inkSoft: Color(0xFFC8C8C2),
    paper: Color(0xFF0E0E0E),
    cream: Color(0xFF2A2A27),
    muted: Color(0xFF8A8A82),
    rule: Color(0x26FFFFFF),
    tile: Color(0xFF2A2A27),
    tileSelected: Color(0xFFEDEDEA),
    rowValid: Color(0xFF8AA47F), // lifted for dark-surface contrast
    solved: Color(0xFFC96B2E),
    hint: Color(0xFFEDEDEA),
    error: Color(0xFFE0765A),
    onInverse: Color(0xFF0E0E0E),
    onRowValid: Color(0xFF0E0E0E),
    onSolved: Color(0xFFFAFAF7),
  );

  // ── Colour-blind (§17.2) ─────────────────────────────────────────────
  // Blue + orange, luminance-separated so the pair survives greyscale and
  // needs no secondary (icon/tick/border) cue. PLACEHOLDER pending the
  // joint web+mobile palette sign-off (spec §18, decision 13); structured
  // as a token swap so tuning is one place.
  static const _cbBlue = Color(0xFF1F6FEB);
  static const _cbOrange = Color(0xFFF0883E);

  static final cbLight = light.copyWith(
    rowValid: _cbBlue,
    solved: _cbOrange,
    onRowValid: const Color(0xFFFAFAF7),
    onSolved: const Color(0xFF0A0A0A),
  );

  static final cbDark = dark.copyWith(
    rowValid: _cbBlue,
    solved: _cbOrange,
    onRowValid: const Color(0xFFFAFAF7),
    onSolved: const Color(0xFF0A0A0A),
  );

  static TesseraColors resolve({
    required bool dark,
    required bool colourBlind,
  }) {
    if (colourBlind) return dark ? cbDark : cbLight;
    return dark ? TesseraColors.dark : light;
  }

  @override
  TesseraColors copyWith({
    Color? ink,
    Color? inkSoft,
    Color? paper,
    Color? cream,
    Color? muted,
    Color? rule,
    Color? tile,
    Color? tileSelected,
    Color? rowValid,
    Color? solved,
    Color? hint,
    Color? error,
    Color? onInverse,
    Color? onRowValid,
    Color? onSolved,
  }) {
    return TesseraColors(
      ink: ink ?? this.ink,
      inkSoft: inkSoft ?? this.inkSoft,
      paper: paper ?? this.paper,
      cream: cream ?? this.cream,
      muted: muted ?? this.muted,
      rule: rule ?? this.rule,
      tile: tile ?? this.tile,
      tileSelected: tileSelected ?? this.tileSelected,
      rowValid: rowValid ?? this.rowValid,
      solved: solved ?? this.solved,
      hint: hint ?? this.hint,
      error: error ?? this.error,
      onInverse: onInverse ?? this.onInverse,
      onRowValid: onRowValid ?? this.onRowValid,
      onSolved: onSolved ?? this.onSolved,
    );
  }

  @override
  TesseraColors lerp(ThemeExtension<TesseraColors>? other, double t) {
    if (other is! TesseraColors) return this;
    return TesseraColors(
      ink: Color.lerp(ink, other.ink, t)!,
      inkSoft: Color.lerp(inkSoft, other.inkSoft, t)!,
      paper: Color.lerp(paper, other.paper, t)!,
      cream: Color.lerp(cream, other.cream, t)!,
      muted: Color.lerp(muted, other.muted, t)!,
      rule: Color.lerp(rule, other.rule, t)!,
      tile: Color.lerp(tile, other.tile, t)!,
      tileSelected: Color.lerp(tileSelected, other.tileSelected, t)!,
      rowValid: Color.lerp(rowValid, other.rowValid, t)!,
      solved: Color.lerp(solved, other.solved, t)!,
      hint: Color.lerp(hint, other.hint, t)!,
      error: Color.lerp(error, other.error, t)!,
      onInverse: Color.lerp(onInverse, other.onInverse, t)!,
      onRowValid: Color.lerp(onRowValid, other.onRowValid, t)!,
      onSolved: Color.lerp(onSolved, other.onSolved, t)!,
    );
  }
}

extension TesseraColorsX on BuildContext {
  TesseraColors get colors => Theme.of(this).extension<TesseraColors>()!;
}
