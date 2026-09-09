import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tessera/src/chrome/definitions_repository.dart';
import 'package:tessera/src/chrome/words_screen.dart';
import 'package:tessera/src/game/board_controller.dart';
import 'package:tessera/src/game/puzzle.dart';
import 'package:tessera/src/theme/theme.dart';

import 'support/test_dict.dart';

Widget _harness(List<Override> extra) => ProviderScope(
  overrides: [
    dictOverride(),
    puzzleProvider.overrideWith((ref) => Puzzle.sample()),
    ...extra,
  ],
  child: MaterialApp(
    theme: buildTesseraTheme(brightness: Brightness.light),
    home: const WordsScreen(),
  ),
);

Future<void> _ready(WidgetTester tester) async {
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 50));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('en: renders a definition per word plus attribution', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(
      _harness([
        for (final w in const ['turf', 'anal', 'sire', 'stew'])
          definitionProvider(w).overrideWith(
            (ref) async => Definition(definition: 'Def of $w', partOfSpeech: 'noun'),
          ),
      ]),
    );
    await _ready(tester);

    expect(find.text('TURF'), findsOneWidget);
    expect(find.text('Def of turf'), findsOneWidget);
    expect(find.text('Def of stew'), findsOneWidget);
    expect(
      find.text('Definitions from dictionaryapi.dev (en_GB).'),
      findsOneWidget,
    );
  });

  testWidgets('en: a failed lookup shows the placeholder, screen still renders', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(
      _harness([
        definitionProvider('turf').overrideWith(
          (ref) async => throw Exception('offline'),
        ),
        for (final w in const ['anal', 'sire', 'stew'])
          definitionProvider(w).overrideWith((ref) async => const Definition()),
      ]),
    );
    await _ready(tester);

    expect(find.text('Definition unavailable.'), findsWidgets);
    expect(find.text('TURF'), findsOneWidget);
  });

  testWidgets('es: word list only, with a coming-soon note and no lookups', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({'tessera:locale': 'es'});
    await tester.pumpWidget(_harness(const []));
    await _ready(tester);

    expect(find.text('TURF'), findsOneWidget);
    expect(find.text('STEW'), findsOneWidget);
    expect(find.text('Definitions coming soon.'), findsOneWidget);
    // The English attribution line is absent on the es variant.
    expect(
      find.text('Definitions from dictionaryapi.dev (en_GB).'),
      findsNothing,
    );
  });
}
