import 'package:flutter/material.dart';

import 'tokens.dart';

/// Builds the app ThemeData for a brightness + colour-blind combination.
/// Fraunces is the display face, Inter the text face (spec §18); both are
/// vendored from the web app.
ThemeData buildTesseraTheme({
  required Brightness brightness,
  bool colourBlind = false,
}) {
  final dark = brightness == Brightness.dark;
  final c = TesseraColors.resolve(dark: dark, colourBlind: colourBlind);

  final base = ThemeData(
    brightness: brightness,
    useMaterial3: true,
    scaffoldBackgroundColor: c.paper,
    fontFamily: 'Inter',
    colorScheme: ColorScheme.fromSeed(
      seedColor: c.rowValid,
      brightness: brightness,
      surface: c.paper,
      error: c.error,
    ),
  );

  return base.copyWith(
    extensions: [c],
    textTheme: base.textTheme.apply(
      bodyColor: c.ink,
      displayColor: c.ink,
    ),
  );
}
