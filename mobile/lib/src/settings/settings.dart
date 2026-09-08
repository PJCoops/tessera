import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// App settings. Phase 2 holds the two that affect the board's rendering;
/// persistence (shared_preferences) and the full settings screen — theme,
/// language, hints, mute, reminders, account, IAP — come in Phase 3 (§16.4).
@immutable
class Settings {
  const Settings({this.themeMode = ThemeMode.system, this.colourBlind = false});

  final ThemeMode themeMode;
  final bool colourBlind;

  Settings copyWith({ThemeMode? themeMode, bool? colourBlind}) => Settings(
    themeMode: themeMode ?? this.themeMode,
    colourBlind: colourBlind ?? this.colourBlind,
  );
}

final settingsProvider = NotifierProvider<SettingsController, Settings>(
  SettingsController.new,
);

class SettingsController extends Notifier<Settings> {
  @override
  Settings build() => const Settings();

  void toggleColourBlind() =>
      state = state.copyWith(colourBlind: !state.colourBlind);

  void setThemeMode(ThemeMode mode) => state = state.copyWith(themeMode: mode);
}
