import 'dart:ui';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tessera/src/i18n.dart';
import 'package:tessera/src/i18n/locale.dart';
import 'package:tessera/src/settings/settings.dart';

Future<void> _settle() async {
  for (var i = 0; i < 5; i++) {
    await Future<void>.delayed(Duration.zero);
  }
}

void main() {
  group('resolveInitialLocale', () {
    test('a valid stored value always wins', () {
      expect(
        resolveInitialLocale('es', const [Locale('en')]),
        'es',
      );
    });

    test('falls back to the first supported device language', () {
      expect(
        resolveInitialLocale(null, const [Locale('fr'), Locale('es')]),
        'es',
      );
    });

    test('defaults to en when nothing matches', () {
      expect(resolveInitialLocale(null, const [Locale('de')]), 'en');
      expect(resolveInitialLocale('pt', const []), 'en');
    });
  });

  group('t()', () {
    test('interpolates {placeholders} and is loud on a miss', () {
      final dict = {
        'game': {'tile': {'label': 'Row {row}, column {col}'}},
      };
      expect(
        t(dict, 'game.tile.label', {'row': 2, 'col': 3}),
        'Row 2, column 3',
      );
      expect(t(dict, 'game.tile.missing'), 'game.tile.missing');
    });
  });

  group('first-launch locale', () {
    final binding = TestWidgetsFlutterBinding.ensureInitialized();

    tearDown(() => binding.platformDispatcher.clearLocalesTestValue());

    test('picks the device language and pins it when nothing is stored', () async {
      SharedPreferences.setMockInitialValues({});
      binding.platformDispatcher.localesTestValue = const [Locale('es')];

      final c = ProviderContainer();
      addTearDown(c.dispose);
      c.read(settingsProvider);
      await _settle();

      expect(c.read(settingsProvider).locale, 'es');
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString('tessera:locale'), 'es');
    });

    test('a stored choice is not overridden by the device language', () async {
      SharedPreferences.setMockInitialValues({'tessera:locale': 'en'});
      binding.platformDispatcher.localesTestValue = const [Locale('es')];

      final c = ProviderContainer();
      addTearDown(c.dispose);
      c.read(settingsProvider);
      await _settle();

      expect(c.read(settingsProvider).locale, 'en');
    });
  });
}
