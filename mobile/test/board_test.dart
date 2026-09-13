import 'package:flutter_test/flutter_test.dart';
import 'package:tessera/src/game/board.dart';

// Gold grid whose rows/cols we don't actually validate as words here —
// the state machine only compares letters to the given goldRows.
const _gold = ['abcd', 'efgh', 'ijkl', 'mnop'];

BoardState _solvedStart() => BoardState.start(
  goldRows: _gold,
  startTiles: tilesFromRows(_gold),
  minSwaps: 1,
);

/// A start position one swap from solved: tiles at index 0 and 5 exchanged.
BoardState _oneSwapFromSolved() {
  final tiles = tilesFromRows(_gold);
  final swapped = List.of(tiles);
  final t = swapped[0];
  swapped[0] = swapped[5];
  swapped[5] = t;
  return BoardState.start(goldRows: _gold, startTiles: swapped, minSwaps: 1);
}

void main() {
  test('tapping a tile selects it', () {
    final s = _oneSwapFromSolved().tap(3);
    expect(s.selectedIndex, 3);
    expect(s.moves, 0);
  });

  test('re-tapping the selected tile deselects it (no move)', () {
    final s = _oneSwapFromSolved().tap(3).tap(3);
    expect(s.selectedIndex, isNull);
    expect(s.moves, 0);
    expect(s.history, isEmpty);
  });

  test('tapping a second tile swaps and increments the move count', () {
    final s = _oneSwapFromSolved().tap(0).tap(5);
    expect(s.selectedIndex, isNull);
    expect(s.moves, 1);
    expect(s.history, [
      [0, 5],
    ]);
  });

  test('all rows valid -> solved, and justSolved latches exactly once', () {
    final s0 = _oneSwapFromSolved();
    expect(s0.isSolved, isFalse);

    final s1 = s0.tap(0).tap(5); // completes the board
    expect(s1.isSolved, isTrue);
    expect(s1.justSolved, isTrue, reason: 'win transition fires on this state');
    expect(s1.solvedAtMove, 1);

    // Any further tap is ignored and justSolved no longer holds.
    final s2 = s1.tap(2);
    expect(s2.moves, 1, reason: 'taps ignored once solved');
    expect(s2.selectedIndex, isNull);
    expect(
      identical(s1.tap(7), s1),
      isTrue,
      reason: 'no-op returns same state',
    );
  });

  test(
    'isBonus tracks isSolved (a solved board == the gold grid, cols included)',
    () {
      // Matches the web `validity` memo: rowValid/colValid both compare the
      // board to the gold grid, so isSolved implies isBonus. The generator
      // guarantees the gold grid has valid columns.
      final s = _solvedStart();
      expect(s.isSolved, isTrue);
      expect(s.isBonus, isTrue);
    },
  );

  test('rowValid reflects partial progress', () {
    // Swap two tiles within row 1 only (indices 4 and 5) -> rows 0,2,3 valid.
    final tiles = tilesFromRows(_gold);
    final t = tiles[4];
    tiles[4] = tiles[5];
    tiles[5] = t;
    final s = BoardState.start(goldRows: _gold, startTiles: tiles, minSwaps: 1);
    expect(s.rowValid, [true, false, true, true]);
    expect(s.validRowCount, 3);
  });

  group('BoardState.finished', () {
    test('shows the solved grid, not scrambled, and is not tappable', () {
      final s = BoardState.finished(
        goldRows: _gold,
        minSwaps: 1,
        moves: 6,
        revealed: false,
      );
      expect(s.isSolved, isTrue);
      expect(s.moves, 6);
      // A stray tap must be a no-op — this board is a static display, not
      // interactive.
      expect(identical(s.tap(0), s), isTrue);
    });

    test('never reports justSolved, for a real win or a reveal', () {
      final won = BoardState.finished(
        goldRows: _gold,
        minSwaps: 1,
        moves: 6,
        revealed: false,
      );
      final gaveUp = BoardState.finished(
        goldRows: _gold,
        minSwaps: 1,
        moves: 3,
        revealed: true,
      );
      expect(won.justSolved, isFalse);
      expect(gaveUp.justSolved, isFalse);
    });

    test('a genuine win keeps solvedAtMove distinct from the reveal sentinel', () {
      // game_screen.dart tells "revealed" apart from "solved" partly by
      // checking `solvedAtMove == -1` (the same sentinel BoardState.revealed
      // uses) — a real win reopened later must not collide with that.
      final won = BoardState.finished(
        goldRows: _gold,
        minSwaps: 1,
        moves: 6,
        revealed: false,
      );
      final revealed = BoardState.finished(
        goldRows: _gold,
        minSwaps: 1,
        moves: 3,
        revealed: true,
      );
      expect(won.solvedAtMove, isNot(-1));
      expect(revealed.solvedAtMove, -1);
    });
  });
}
