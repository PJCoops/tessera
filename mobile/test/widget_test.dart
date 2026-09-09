import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tessera/src/game/board_controller.dart';
import 'package:tessera/src/game/board_view.dart';
import 'package:tessera/src/game/game_screen.dart';
import 'package:tessera/src/game/puzzle.dart';
import 'package:tessera/src/theme/theme.dart';

import 'support/test_dict.dart';

Widget _harness() => ProviderScope(
  overrides: [
    puzzleProvider.overrideWith((ref) => Puzzle.sample()),
    dictOverride(),
  ],
  child: MaterialApp(
    theme: buildTesseraTheme(brightness: Brightness.light),
    home: const GameScreen(),
  ),
);

void main() {
  setUp(
    () => SharedPreferences.setMockInitialValues({
      'tessera:first_run_demo_seen': true,
    }),
  );

  testWidgets('board renders 16 tiles and the kicker', (tester) async {
    await tester.pumpWidget(_harness());
    await tester.pumpAndSettle();
    expect(
      find.textContaining(RegExp(r'TESSERA · #7\b')),
      findsOneWidget,
    );
    expect(find.byType(BoardView), findsOneWidget);
    final tiles = find.bySemanticsLabel(RegExp(r'^Row \d, column \d,'));
    expect(tiles, findsNWidgets(16));
  });

  testWidgets('tap-select then tap-swap bumps the move count', (tester) async {
    await tester.pumpWidget(_harness());
    await tester.pumpAndSettle();
    final container = ProviderScope.containerOf(
      tester.element(find.byType(GameScreen)),
    );

    expect(container.read(boardProvider).moves, 0);
    container.read(boardProvider.notifier).tap(0);
    expect(container.read(boardProvider).selectedIndex, 0);
    container.read(boardProvider.notifier).tap(1);
    await tester.pump();
    expect(container.read(boardProvider).moves, 1);
    expect(container.read(boardProvider).selectedIndex, isNull);
  });

  testWidgets('shows a retry state when the puzzle fails to load', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          puzzleProvider.overrideWith(
            (ref) => Future<Puzzle>.error(Exception('offline')),
          ),
          dictOverride(),
        ],
        child: MaterialApp(
          theme: buildTesseraTheme(brightness: Brightness.light),
          home: const GameScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(
      find.text("Couldn't load today's puzzle. Check your connection."),
      findsOneWidget,
    );
    expect(find.text('Try again'), findsOneWidget);
  });
}
