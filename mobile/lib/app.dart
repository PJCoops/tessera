import 'package:flutter/material.dart';

import 'flavors.dart';
import 'src/game/game_screen.dart';
import 'src/theme/theme.dart';

/// Root widget. Phase 2: the game screen (board + interaction). Accounts,
/// leagues, settings and the live puzzle fetch come in later phases.
class TesseraApp extends StatelessWidget {
  const TesseraApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: F.title,
      debugShowCheckedModeBanner: false,
      theme: buildTesseraTheme(brightness: Brightness.light),
      darkTheme: buildTesseraTheme(brightness: Brightness.dark),
      home: const GameScreen(),
    );
  }
}
