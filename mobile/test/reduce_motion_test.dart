import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tessera/src/game/board_controller.dart';
import 'package:tessera/src/game/board_view.dart';
import 'package:tessera/src/game/game_screen.dart';
import 'package:tessera/src/game/puzzle.dart';
import 'package:tessera/src/theme/theme.dart';

// A puzzle one swap from solved so a test can trigger the win path.
Puzzle _almostSolved() {
  final p = Puzzle.sample();
  final solved = [
    for (var i = 0; i < 16; i++) p.startTiles.firstWhere((t) => t.id == i),
  ];
  final a = solved[0];
  solved[0] = solved[1];
  solved[1] = a;
  return Puzzle(
    num: p.num,
    goldRows: p.goldRows,
    minSwaps: 1,
    startTiles: solved,
  );
}

Widget _harness({required bool reduceMotion}) => ProviderScope(
  overrides: [puzzleProvider.overrideWith((ref) => _almostSolved())],
  child: MaterialApp(
    theme: buildTesseraTheme(brightness: Brightness.light),
    home: MediaQuery(
      data: MediaQueryData(disableAnimations: reduceMotion),
      child: const GameScreen(),
    ),
  ),
);

void main() {
  setUp(
    () => SharedPreferences.setMockInitialValues({
      'tessera:first_run_demo_seen': true,
    }),
  );

  testWidgets('reduce-motion: solving settles immediately (no cascade)', (
    tester,
  ) async {
    await tester.pumpWidget(_harness(reduceMotion: true));
    await tester.pump();
    final container = ProviderScope.containerOf(
      tester.element(find.byType(GameScreen)),
    );
    // Solve: the two out-of-place tiles are at slots 0 and 1.
    container.read(boardProvider.notifier).tap(0);
    container.read(boardProvider.notifier).tap(1);
    expect(container.read(boardProvider).isSolved, isTrue);

    // With animations disabled there is no staggered cascade to wait on.
    // (Bounded pump, not pumpAndSettle: the finished screen mounts a
    //  1s countdown timer that would keep pumpAndSettle from settling.)
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.byType(BoardView), findsOneWidget);
    await tester.pumpWidget(const SizedBox()); // cancel the countdown timer
  });

  testWidgets('normal motion: cascade runs after a solve', (tester) async {
    await tester.pumpWidget(_harness(reduceMotion: false));
    await tester.pump();
    final container = ProviderScope.containerOf(
      tester.element(find.byType(GameScreen)),
    );
    container.read(boardProvider.notifier).tap(0);
    container.read(boardProvider.notifier).tap(1);
    await tester.pump();
    expect(container.read(boardProvider).justSolved, isTrue);
    // Let the staggered cascade play out without throwing. Bounded pumps
    // rather than pumpAndSettle — the finished screen's 1s countdown
    // timer never lets the tree go idle.
    for (var i = 0; i < 8; i++) {
      await tester.pump(const Duration(milliseconds: 300));
    }
    await tester.pumpWidget(const SizedBox()); // cancel the countdown timer
  });
}
