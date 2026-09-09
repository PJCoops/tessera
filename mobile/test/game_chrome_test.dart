import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tessera/src/chrome/legend.dart';
import 'package:tessera/src/game/board_controller.dart';
import 'package:tessera/src/game/game_screen.dart';
import 'package:tessera/src/game/puzzle.dart';
import 'package:tessera/src/theme/theme.dart';

import 'support/test_dict.dart';

Puzzle _oneFromSolved() {
  final p = Puzzle.sample();
  final home = [
    for (var i = 0; i < 16; i++) p.startTiles.firstWhere((t) => t.id == i),
  ];
  final t = home[0];
  home[0] = home[1];
  home[1] = t;
  return Puzzle(num: p.num, goldRows: p.goldRows, minSwaps: 1, startTiles: home);
}

Widget _harness() => ProviderScope(
  overrides: [
    puzzleProvider.overrideWith((ref) => _oneFromSolved()),
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

  testWidgets('top bar exposes how-to, history and settings', (tester) async {
    await tester.pumpWidget(_harness());
    await tester.pumpAndSettle();
    expect(find.byIcon(Icons.help_outline), findsOneWidget);
    expect(find.byIcon(Icons.bar_chart), findsOneWidget);
    expect(find.byIcon(Icons.tune), findsOneWidget);
  });

  testWidgets('unsolved board shows the hints + solution controls and legend', (
    tester,
  ) async {
    await tester.pumpWidget(_harness());
    await tester.pumpAndSettle();
    expect(find.text('Hide hints'), findsOneWidget);
    expect(find.text('Solution'), findsOneWidget);
    // New player (0 solves) still gets the legend key.
    expect(find.byType(Legend), findsNWidgets(3));
  });

  testWidgets('solving swaps in the share + definitions actions', (
    tester,
  ) async {
    await tester.pumpWidget(_harness());
    await tester.pumpAndSettle();
    final container = ProviderScope.containerOf(
      tester.element(find.byType(GameScreen)),
    );
    container.read(boardProvider.notifier).tap(0);
    container.read(boardProvider.notifier).tap(1);
    expect(container.read(boardProvider).isSolved, isTrue);
    // Bounded pumps: the finished screen mounts a 1s countdown timer, so
    // pumpAndSettle would never return. Long enough to drain the solved
    // cascade's staggered Future.delayed timers.
    for (var i = 0; i < 8; i++) {
      await tester.pump(const Duration(milliseconds: 300));
    }

    expect(find.text('Challenge a friend →'), findsOneWidget);
    expect(find.text('Definitions'), findsOneWidget);
    expect(find.text('Solution'), findsNothing);
    expect(find.textContaining('Next puzzle in'), findsOneWidget);

    // Unmount so the countdown's periodic timer is cancelled before the
    // framework's pending-timer check.
    await tester.pumpWidget(const SizedBox());
  });
}
