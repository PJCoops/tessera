import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../i18n/locale.dart';
import '../mode.dart';

/// App settings, persisted to shared_preferences (spec §16.4). Follows the
/// same pattern as [firstRunSeenProvider]: [build] returns defaults
/// synchronously and an async `_load` hydrates the stored values a frame
/// later; writes are fire-and-forget. Keys match the web's localStorage
/// names where one exists so a later sync slice lines up.
@immutable
class Settings {
  const Settings({
    this.themeMode = ThemeMode.system,
    this.locale = 'en',
    this.colourBlind = false,
    this.hideHints = false,
    this.muted = true,
    this.reminder = const TimeOfDay(hour: 9, minute: 0),
    this.modeId = ModeId.classic,
  });

  final ThemeMode themeMode;

  /// UI language: 'en' or 'es'. Puzzle words are unaffected.
  final String locale;
  final bool colourBlind;

  /// Hides the dashed home-row hint outline on tiles.
  final bool hideHints;

  /// Silences the win jingle. Defaults on, matching the web app.
  final bool muted;

  /// Local daily-reminder time. Scheduling lands in Phase 8; for now this
  /// is persisted only.
  final TimeOfDay reminder;

  /// The mode the game screen is currently showing.
  final ModeId modeId;

  Settings copyWith({
    ThemeMode? themeMode,
    String? locale,
    bool? colourBlind,
    bool? hideHints,
    bool? muted,
    TimeOfDay? reminder,
    ModeId? modeId,
  }) => Settings(
    themeMode: themeMode ?? this.themeMode,
    locale: locale ?? this.locale,
    colourBlind: colourBlind ?? this.colourBlind,
    hideHints: hideHints ?? this.hideHints,
    muted: muted ?? this.muted,
    reminder: reminder ?? this.reminder,
    modeId: modeId ?? this.modeId,
  );
}

final settingsProvider = NotifierProvider<SettingsController, Settings>(
  SettingsController.new,
);

const _kTheme = 'tessera:theme';
const _kLocale = 'tessera:locale';
const _kColourBlind = 'tessera:colour-blind';
const _kHideHints = 'tessera:hide-hints';
const _kMuted = 'tessera:muted';
const _kReminder = 'tessera:reminder';
const _kMode = 'tessera:mode';

class SettingsController extends Notifier<Settings> {
  @override
  Settings build() {
    _load();
    return const Settings();
  }

  Future<void> _load() async {
    final p = await SharedPreferences.getInstance();
    final storedLocale = p.getString(_kLocale);
    final locale = resolveInitialLocale(
      storedLocale,
      WidgetsBinding.instance.platformDispatcher.locales,
    );
    // Pin the first-launch pick so a later device-language change doesn't
    // silently move the UI out from under the player.
    if (storedLocale != 'en' && storedLocale != 'es') {
      p.setString(_kLocale, locale);
    }
    state = Settings(
      themeMode: _themeFromString(p.getString(_kTheme)),
      locale: locale,
      colourBlind: p.getBool(_kColourBlind) ?? false,
      hideHints: p.getBool(_kHideHints) ?? false,
      muted: p.getBool(_kMuted) ?? true,
      reminder: _timeFromString(p.getString(_kReminder)),
      modeId: p.getString(_kMode) == 'hard' ? ModeId.hard : ModeId.classic,
    );
  }

  Future<SharedPreferences> _prefs() => SharedPreferences.getInstance();

  void setThemeMode(ThemeMode mode) {
    state = state.copyWith(themeMode: mode);
    _prefs().then((p) => p.setString(_kTheme, mode.name));
  }

  void setLocale(String locale) {
    if (locale != 'en' && locale != 'es') return;
    state = state.copyWith(locale: locale);
    _prefs().then((p) => p.setString(_kLocale, locale));
  }

  void toggleColourBlind() => setColourBlind(!state.colourBlind);

  void setColourBlind(bool value) {
    state = state.copyWith(colourBlind: value);
    _prefs().then((p) => p.setBool(_kColourBlind, value));
  }

  void setHideHints(bool value) {
    state = state.copyWith(hideHints: value);
    _prefs().then((p) => p.setBool(_kHideHints, value));
  }

  void setMuted(bool value) {
    state = state.copyWith(muted: value);
    _prefs().then((p) => p.setBool(_kMuted, value));
  }

  void setReminder(TimeOfDay time) {
    state = state.copyWith(reminder: time);
    _prefs().then(
      (p) => p.setString(
        _kReminder,
        '${time.hour.toString().padLeft(2, '0')}:'
            '${time.minute.toString().padLeft(2, '0')}',
      ),
    );
  }

  void setMode(ModeId id) {
    state = state.copyWith(modeId: id);
    _prefs().then((p) => p.setString(_kMode, id.name));
  }
}

ThemeMode _themeFromString(String? v) => switch (v) {
  'light' => ThemeMode.light,
  'dark' => ThemeMode.dark,
  _ => ThemeMode.system,
};

TimeOfDay _timeFromString(String? v) {
  if (v == null) return const TimeOfDay(hour: 9, minute: 0);
  final parts = v.split(':');
  if (parts.length != 2) return const TimeOfDay(hour: 9, minute: 0);
  final h = int.tryParse(parts[0]);
  final m = int.tryParse(parts[1]);
  if (h == null || m == null || h < 0 || h > 23 || m < 0 || m > 59) {
    return const TimeOfDay(hour: 9, minute: 0);
  }
  return TimeOfDay(hour: h, minute: m);
}
