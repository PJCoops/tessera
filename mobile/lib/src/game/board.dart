// Board interaction state machine, ported from app/TesseraGame.tsx
// (the `validity` memo and `handleTap`). Pure Dart, no Flutter — unit
// tested directly (test/board_test.dart, spec §20.2 Phase 2).
//
// Positions are row-major: index = row * n + col. Tile letters are
// uppercase; gold rows arrive lowercase from /api/v1/puzzle.

import 'package:flutter/foundation.dart';

@immutable
class Tile {
  const Tile(this.id, this.letter);

  /// The tile's solved home index (0 .. n*n-1).
  final int id;
  final String letter;

  @override
  bool operator ==(Object other) =>
      other is Tile && other.id == id && other.letter == letter;

  @override
  int get hashCode => Object.hash(id, letter);
}

List<Tile> tilesFromRows(List<String> goldRows) {
  final letters = goldRows.join().toUpperCase().split('');
  return [for (var i = 0; i < letters.length; i++) Tile(i, letters[i])];
}

@immutable
class BoardState {
  BoardState({
    required this.positions,
    required this.goldRows,
    required this.minSwaps,
    this.selectedIndex,
    this.moves = 0,
    this.history = const [],
    this.solvedAtMove,
  });

  /// The board as it stands, row-major.
  final List<Tile> positions;

  /// Gold solution rows, lowercase, length n each.
  final List<String> goldRows;
  final int minSwaps;
  final int? selectedIndex;
  final int moves;

  /// Ordered [from, to] index pairs — the replay history sent to the server.
  final List<List<int>> history;

  /// The move count at which the board was first solved; null until then.
  /// Latches so the win transition fires exactly once.
  final int? solvedAtMove;

  int get n => goldRows.length;

  BoardState.start({
    required List<String> goldRows,
    required List<Tile> startTiles,
    required int minSwaps,
  }) : this(positions: startTiles, goldRows: goldRows, minSwaps: minSwaps);

  late final List<bool> rowValid = List<bool>.generate(n, (r) {
    final gold = goldRows[r].toUpperCase();
    for (var col = 0; col < n; col++) {
      if (positions[r * n + col].letter != gold[col]) return false;
    }
    return true;
  });

  late final List<bool> colValid = List<bool>.generate(n, (col) {
    for (var r = 0; r < n; r++) {
      if (positions[r * n + col].letter != goldRows[r].toUpperCase()[col]) {
        return false;
      }
    }
    return true;
  });

  /// Per-tile "this tile's letter belongs in this row" hint, multiset
  /// aware — ported from the `homeHintByIdx` block in app/TesseraGame.tsx.
  /// A tile in row r is hinted iff its letter is still needed by row r's
  /// gold word after crediting tiles already sitting on their home row
  /// first. That priority handles duplicate letters: a home tile claims
  /// its letter before any visual spillover does.
  late final List<bool> homeHint = _computeHomeHint();

  List<bool> _computeHomeHint() {
    final out = List<bool>.filled(positions.length, false);
    for (var r = 0; r < n; r++) {
      final remaining = <String, int>{};
      for (final ch in goldRows[r].toUpperCase().split('')) {
        remaining[ch] = (remaining[ch] ?? 0) + 1;
      }
      final order = [for (var c = 0; c < n; c++) r * n + c]..sort((a, b) {
        final aHome = positions[a].id ~/ n == r ? 0 : 1;
        final bHome = positions[b].id ~/ n == r ? 0 : 1;
        return aHome - bHome;
      });
      for (final idx in order) {
        final ch = positions[idx].letter;
        final left = remaining[ch] ?? 0;
        if (left > 0) {
          out[idx] = true;
          remaining[ch] = left - 1;
        }
      }
    }
    return out;
  }

  int get validRowCount => rowValid.where((v) => v).length;

  bool get isSolved => rowValid.every((v) => v);

  bool get isBonus => isSolved && colValid.every((v) => v);

  /// True on the render where the board just became solved.
  bool get justSolved => isSolved && solvedAtMove == moves;

  /// Tap a tile. Mirrors handleTap in the web game:
  ///   - once solved, taps are ignored
  ///   - nothing selected -> select it
  ///   - re-tap the selected tile -> deselect (no move)
  ///   - otherwise -> swap the two tiles, move count +1, deselect
  BoardState tap(int index) {
    if (isSolved) return this;
    if (selectedIndex == null) return _copyWith(selectedIndex: index);
    if (selectedIndex == index) return _copyWith(clearSelection: true);

    final from = selectedIndex!;
    final next = List<Tile>.of(positions);
    final tmp = next[from];
    next[from] = next[index];
    next[index] = tmp;
    final nextMoves = moves + 1;

    final result = BoardState(
      positions: next,
      goldRows: goldRows,
      minSwaps: minSwaps,
      selectedIndex: null,
      moves: nextMoves,
      history: [
        ...history,
        [from, index],
      ],
      solvedAtMove: solvedAtMove,
    );
    // Latch the solve moment so justSolved is true for exactly one state.
    if (result.solvedAtMove == null && result.isSolved) {
      return result._copyWith(solvedAtMove: nextMoves);
    }
    return result;
  }

  BoardState _copyWith({
    int? selectedIndex,
    bool clearSelection = false,
    int? solvedAtMove,
  }) {
    return BoardState(
      positions: positions,
      goldRows: goldRows,
      minSwaps: minSwaps,
      selectedIndex: clearSelection
          ? null
          : (selectedIndex ?? this.selectedIndex),
      moves: moves,
      history: history,
      solvedAtMove: solvedAtMove ?? this.solvedAtMove,
    );
  }
}
