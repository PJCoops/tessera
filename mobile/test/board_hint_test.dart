import 'package:flutter_test/flutter_test.dart';
import 'package:tessera/src/game/board.dart';

BoardState _start(List<String> gold, List<Tile> tiles) =>
    BoardState.start(goldRows: gold, startTiles: tiles, minSwaps: 1);

/// tilesFromRows in slot order, then swap slots [a] and [b].
List<Tile> _swapped(List<String> gold, int a, int b) {
  final t = tilesFromRows(gold);
  final tmp = t[a];
  t[a] = t[b];
  t[b] = tmp;
  return t;
}

void main() {
  test('a solved board hints every tile', () {
    final s = _start(['ab', 'cd'], tilesFromRows(['ab', 'cd']));
    expect(s.homeHint, [true, true, true, true]);
  });

  test('tiles swapped within their own row stay hinted', () {
    // B and A trade columns but both remain on row 0.
    final s = _start(['ab', 'cd'], _swapped(['ab', 'cd'], 0, 1));
    expect(s.homeHint, [true, true, true, true]);
  });

  test('a cross-row swap un-hints the two out-of-row tiles', () {
    // Slot 1 now holds C (belongs to row 1); slot 2 holds B (row 0).
    final s = _start(['ab', 'cd'], _swapped(['ab', 'cd'], 1, 2));
    expect(s.homeHint, [true, false, false, true]);
  });

  test('duplicate letters credit the home tile before spillover', () {
    // gold rows both start with A. Swap slot 1 (B) with slot 2 (A@row1)
    // so row 0 visually holds two A's — only the home A should hint.
    final s = _start(['ab', 'ac'], _swapped(['ab', 'ac'], 1, 2));
    expect(s.homeHint, [true, false, false, true]);
  });
}
