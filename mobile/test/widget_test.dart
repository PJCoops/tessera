import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tessera/src/game/board_controller.dart';
import 'package:tessera/src/game/board_view.dart';
import 'package:tessera/src/game/game_screen.dart';
import 'package:tessera/src/theme/theme.dart';

Widget _harness() => ProviderScope(
      child: MaterialApp(
        theme: buildTesseraTheme(brightness: Brightness.light),
        home: const GameScreen(),
      ),
    );

void main() {
  testWidgets('board renders 16 tiles and the kicker', (tester) async {
    await tester.pumpWidget(_harness());
    expect(find.text('TESSERA · #7'), findsOneWidget);
    expect(find.byType(BoardView), findsOneWidget);
    // 16 tile letters (some repeat, so match the semantics buttons instead).
    final tiles = find.bySemanticsLabel(RegExp(r'^Row \d, column \d,'));
    expect(tiles, findsNWidgets(16));
  });

  testWidgets('tap-select then tap-swap bumps the move count', (tester) async {
    await tester.pumpWidget(_harness());
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
}
