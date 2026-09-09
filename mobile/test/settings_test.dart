import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tessera/src/mode.dart';
import 'package:tessera/src/settings/settings.dart';

/// Trigger [SettingsController.build] and let its async `_load` settle.
Future<Settings> _hydrated(ProviderContainer c) async {
  c.read(settingsProvider); // trigger build()
  await _settle();
  return c.read(settingsProvider);
}

Future<void> _settle() async {
  for (var i = 0; i < 5; i++) {
    await Future<void>.delayed(Duration.zero);
  }
}

void main() {
  test('defaults before anything is persisted', () async {
    SharedPreferences.setMockInitialValues({});
    final c = ProviderContainer();
    addTearDown(c.dispose);

    final s = await _hydrated(c);
    expect(s.themeMode, ThemeMode.system);
    expect(s.locale, 'en');
    expect(s.colourBlind, isFalse);
    expect(s.hideHints, isFalse);
    expect(s.muted, isTrue);
    expect(s.reminder, const TimeOfDay(hour: 9, minute: 0));
    expect(s.modeId, ModeId.classic);
  });

  test('hydrates persisted values on build', () async {
    SharedPreferences.setMockInitialValues({
      'tessera:theme': 'dark',
      'tessera:locale': 'es',
      'tessera:colour-blind': true,
      'tessera:hide-hints': true,
      'tessera:muted': false,
      'tessera:reminder': '07:30',
      'tessera:mode': 'hard',
    });
    final c = ProviderContainer();
    addTearDown(c.dispose);

    final s = await _hydrated(c);
    expect(s.themeMode, ThemeMode.dark);
    expect(s.locale, 'es');
    expect(s.colourBlind, isTrue);
    expect(s.hideHints, isTrue);
    expect(s.muted, isFalse);
    expect(s.reminder, const TimeOfDay(hour: 7, minute: 30));
    expect(s.modeId, ModeId.hard);
  });

  test('setters update state and persist across a rebuild', () async {
    SharedPreferences.setMockInitialValues({});
    final c1 = ProviderContainer();
    await _hydrated(c1);
    c1.read(settingsProvider.notifier)
      ..setThemeMode(ThemeMode.light)
      ..setLocale('es')
      ..setColourBlind(true)
      ..setHideHints(true)
      ..setMuted(false)
      ..setReminder(const TimeOfDay(hour: 21, minute: 5))
      ..setMode(ModeId.hard);
    expect(c1.read(settingsProvider).themeMode, ThemeMode.light);
    await _settle(); // flush fire-and-forget writes
    c1.dispose();

    // A fresh container reads the same backing store.
    final c2 = ProviderContainer();
    addTearDown(c2.dispose);
    final s = await _hydrated(c2);
    expect(s.themeMode, ThemeMode.light);
    expect(s.locale, 'es');
    expect(s.colourBlind, isTrue);
    expect(s.hideHints, isTrue);
    expect(s.muted, isFalse);
    expect(s.reminder, const TimeOfDay(hour: 21, minute: 5));
    expect(s.modeId, ModeId.hard);
  });

  test('invalid locale is ignored', () async {
    SharedPreferences.setMockInitialValues({});
    final c = ProviderContainer();
    addTearDown(c.dispose);
    await _hydrated(c);
    c.read(settingsProvider.notifier).setLocale('fr');
    expect(c.read(settingsProvider).locale, 'en');
  });
}
