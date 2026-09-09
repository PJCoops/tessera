import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'flavors.dart';
import 'src/game/game_screen.dart';
import 'src/i18n/locale.dart';
import 'src/settings/settings.dart';
import 'src/theme/theme.dart';

/// Root widget. Phase 2: the game screen (board + interaction). Accounts,
/// leagues, settings and the live puzzle fetch come in later phases.
class TesseraApp extends ConsumerWidget {
  const TesseraApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settings = ref.watch(settingsProvider);
    return MaterialApp(
      title: F.title,
      debugShowCheckedModeBanner: false,
      locale: Locale(settings.locale),
      supportedLocales: kSupportedLocales.map(Locale.new),
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      themeMode: settings.themeMode,
      theme: buildTesseraTheme(
        brightness: Brightness.light,
        colourBlind: settings.colourBlind,
      ),
      darkTheme: buildTesseraTheme(
        brightness: Brightness.dark,
        colourBlind: settings.colourBlind,
      ),
      home: const GameScreen(),
    );
  }
}
