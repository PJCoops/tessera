import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'board.dart';
import 'puzzle.dart';

/// The puzzle currently on the board. Phase 2: the dev sample. A later
/// slice replaces this with an async provider over GET /api/v1/puzzle.
final puzzleProvider = Provider<Puzzle>((ref) => Puzzle.sample());

/// Live board state. `tap` drives the whole interaction (select / swap /
/// deselect); `reset` returns to the puzzle's start position.
final boardProvider = NotifierProvider<BoardController, BoardState>(
  BoardController.new,
);

class BoardController extends Notifier<BoardState> {
  @override
  BoardState build() => ref.watch(puzzleProvider).toBoardState();

  void tap(int index) => state = state.tap(index);

  void reset() => state = ref.read(puzzleProvider).toBoardState();
}
