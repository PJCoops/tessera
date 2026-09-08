@Tags(['golden'])
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tessera/src/game/board_controller.dart';
import 'package:tessera/src/game/board_view.dart';
import 'package:tessera/src/game/puzzle.dart';
import 'package:tessera/src/theme/theme.dart';

// The contact sheet (spec §18 / §17.2): the board in every
// {default, colour-blind} x {light, dark} combination. Regenerate with
//   flutter test --update-goldens test/golden
// Goldens are macOS-baseline; CI (Linux) skips the `golden` tag.

/// An in-progress board: rows 0 and 2 solved, tile 5 selected — exercises
/// the resting / row-valid / selected tokens together.
Puzzle _inProgress() {
  final p = Puzzle.sample();
  final home = [
    for (var i = 0; i < 16; i++) p.startTiles.firstWhere((t) => t.id == i),
  ];
  // Scramble rows 1 and 3 only (swap within each) so rows 0 and 2 stay valid.
  void swap(int a, int b) {
    final t = home[a];
    home[a] = home[b];
    home[b] = t;
  }

  swap(4, 5);
  swap(12, 13);
  return Puzzle(num: p.num, goldRows: p.goldRows, minSwaps: 4, startTiles: home);
}

Future<void> _pumpBoard(
  WidgetTester tester, {
  required Brightness brightness,
  required bool colourBlind,
}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [puzzleProvider.overrideWith((ref) => _inProgress())],
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: buildTesseraTheme(brightness: brightness, colourBlind: colourBlind),
        home: Scaffold(
          body: Center(
            child: SizedBox(width: 360, height: 360, child: BoardView()),
          ),
        ),
      ),
    ),
  );
  // Select a tile so the selection token shows.
  final container =
      ProviderScope.containerOf(tester.element(find.byType(BoardView)));
  container.read(boardProvider.notifier).tap(6);
  await tester.pumpAndSettle();
}

void main() {
  final combos = {
    'light_default': (Brightness.light, false),
    'light_cb': (Brightness.light, true),
    'dark_default': (Brightness.dark, false),
    'dark_cb': (Brightness.dark, true),
  };

  combos.forEach((name, combo) {
    testWidgets('board · $name', (tester) async {
      await _pumpBoard(tester, brightness: combo.$1, colourBlind: combo.$2);
      await expectLater(
        find.byType(BoardView),
        matchesGoldenFile('goldens/board_$name.png'),
      );
    });
  });
}
