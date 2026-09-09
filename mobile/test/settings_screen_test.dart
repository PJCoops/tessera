import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tessera/src/chrome/settings_screen.dart';
import 'package:tessera/src/settings/settings.dart';
import 'package:tessera/src/theme/theme.dart';

import 'support/test_dict.dart';

Widget _harness([String locale = 'en']) => ProviderScope(
  overrides: [dictOverride(locale)],
  child: MaterialApp(
    theme: buildTesseraTheme(brightness: Brightness.light),
    darkTheme: buildTesseraTheme(brightness: Brightness.dark),
    home: const SettingsScreen(),
  ),
);

Future<void> _ready(WidgetTester tester) async {
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 50));
  await tester.pumpAndSettle();
}

Future<void> _scrollTo(WidgetTester tester, Finder f) => tester.scrollUntilVisible(
  f,
  300,
  scrollable: find.byType(Scrollable).first,
);

void main() {
  testWidgets('shows the §16.4 rows including later-phase placeholders', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(_harness());
    await _ready(tester);

    expect(find.text('Theme'), findsOneWidget);
    expect(find.text('Language'), findsOneWidget);
    expect(find.text('Colour-blind palette'), findsOneWidget);
    expect(find.text('Hide row hints'), findsOneWidget);
    expect(find.text('Mute'), findsOneWidget);

    await _scrollTo(tester, find.text('Daily reminders'));
    expect(find.text('Daily reminders'), findsOneWidget);
    await _scrollTo(tester, find.text('Delete account'));
    expect(find.text('Delete account'), findsOneWidget);
    await _scrollTo(tester, find.text('Open-source licenses'));
    expect(find.text('Open-source licenses'), findsOneWidget);
  });

  testWidgets('every row is translated under es', (tester) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(_harness('es'));
    await _ready(tester);

    // Rows that used to be hardcoded English.
    expect(find.text('Paleta para daltónicos'), findsOneWidget);
    expect(
      find.text('El sistema sigue tu dispositivo. Claro u oscuro se recuerda aquí.'),
      findsOneWidget,
    );
    await _scrollTo(tester, find.text('Eliminar cuenta'));
    expect(find.text('Eliminar cuenta'), findsOneWidget);
    expect(find.text('Pronto'), findsWidgets);
    await _scrollTo(tester, find.text('Licencias de código abierto'));
    expect(find.text('Licencias de código abierto'), findsOneWidget);
    await _scrollTo(tester, find.text('Contactar con soporte'));
    expect(find.text('Contactar con soporte'), findsOneWidget);

    // No English leaked through.
    expect(find.text('Colour-blind palette'), findsNothing);
    expect(find.text('Delete account'), findsNothing);
    expect(find.text('Soon'), findsNothing);
  });

  testWidgets('toggling Mute updates the settings provider', (tester) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(_harness());
    await _ready(tester);
    final container = ProviderScope.containerOf(
      tester.element(find.byType(SettingsScreen)),
    );
    expect(container.read(settingsProvider).muted, isTrue);

    // Switches, in order: colour-blind, hide-hints, mute.
    await tester.tap(find.byType(Switch).at(2));
    await tester.pump();
    expect(container.read(settingsProvider).muted, isFalse);
  });

  testWidgets('choosing a theme segment updates the setting', (tester) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(_harness());
    await _ready(tester);
    final container = ProviderScope.containerOf(
      tester.element(find.byType(SettingsScreen)),
    );

    await tester.tap(find.text('Dark'));
    await tester.pump();
    expect(container.read(settingsProvider).themeMode, ThemeMode.dark);
  });

  testWidgets('placeholder account rows are disabled', (tester) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(_harness());
    await _ready(tester);
    await _scrollTo(tester, find.text('Delete account'));
    final tile = tester.widget<ListTile>(
      find.widgetWithText(ListTile, 'Delete account'),
    );
    expect(tile.enabled, isFalse);
  });
}
