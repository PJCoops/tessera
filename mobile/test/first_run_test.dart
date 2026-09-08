import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tessera/src/game/board_controller.dart';
import 'package:tessera/src/game/board_view.dart';
import 'package:tessera/src/game/game_screen.dart';
import 'package:tessera/src/game/puzzle.dart';
import 'package:tessera/src/theme/theme.dart';

Widget _app() => ProviderScope(
  overrides: [puzzleProvider.overrideWith((ref) => Puzzle.sample())],
  child: MaterialApp(
    theme: buildTesseraTheme(brightness: Brightness.light),
    home: const GameScreen(),
  ),
);

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('first launch shows the one-move demo, not the board', (
    tester,
  ) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    expect(find.text('Tap two tiles to swap them'), findsOneWidget);
    expect(find.byType(BoardView), findsNothing);
  });

  testWidgets('completing the demo swap advances to the real board', (
    tester,
  ) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    // Grid is I O / T N -> swap the O and T to make I T / O N.
    await tester.tap(find.text('O'));
    await tester.pump();
    await tester.tap(find.text('T'));
    await tester.pump();
    expect(find.text('That’s the whole game.'), findsOneWidget);

    // Auto-dismiss, then the real board is shown and the flag persists.
    await tester.pumpAndSettle(const Duration(seconds: 2));
    expect(find.byType(BoardView), findsOneWidget);

    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getBool('tessera:first_run_demo_seen'), isTrue);
  });

  testWidgets('demo is skipped once the flag is set', (tester) async {
    SharedPreferences.setMockInitialValues({
      'tessera:first_run_demo_seen': true,
    });
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();
    expect(find.byType(BoardView), findsOneWidget);
    expect(find.text('Tap two tiles to swap them'), findsNothing);
  });
}
