import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../flavors.dart';
import 'board.dart';
import 'puzzle.dart';
import 'puzzle_repository.dart';

final puzzleRepositoryProvider = Provider(
  (ref) => PuzzleRepository(devFallback: F.appFlavor == Flavor.dev),
);

/// Today's puzzle from GET /api/v1/puzzle (cached per day). Override this
/// in tests / for the first-run demo to inject a fixed puzzle.
final puzzleProvider = FutureProvider<Puzzle>((ref) {
  return ref.watch(puzzleRepositoryProvider).daily();
});

/// Live board state, built from the resolved puzzle. Only read once
/// [puzzleProvider] has data (the game screen gates on its AsyncValue).
final boardProvider = NotifierProvider<BoardController, BoardState>(
  BoardController.new,
);

class BoardController extends Notifier<BoardState> {
  @override
  BoardState build() => ref.watch(puzzleProvider).requireValue.toBoardState();

  void tap(int index) => state = state.tap(index);

  void reset() => state = ref.read(puzzleProvider).requireValue.toBoardState();
}
