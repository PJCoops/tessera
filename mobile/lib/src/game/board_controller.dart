import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../flavors.dart';
import '../mode.dart';
import '../settings/settings.dart';
import 'board.dart';
import 'puzzle.dart';
import 'puzzle_repository.dart';

final puzzleRepositoryProvider = Provider(
  (ref) => PuzzleRepository(devFallback: F.appFlavor == Flavor.dev),
);

/// The mode the game screen is currently showing, from settings.
final activeModeProvider = Provider<Mode>(
  (ref) => modeById(ref.watch(settingsProvider.select((s) => s.modeId))),
);

/// Today's puzzle from GET /api/v1/puzzle for the active locale + mode
/// (cached per day). Re-fetches when the language or mode changes.
/// Override this in tests / for the first-run demo to inject a fixed
/// puzzle.
final puzzleProvider = FutureProvider<Puzzle>((ref) {
  final locale = ref.watch(settingsProvider.select((s) => s.locale));
  final mode = ref.watch(activeModeProvider);
  return ref
      .watch(puzzleRepositoryProvider)
      .daily(locale: locale, mode: mode.apiValue);
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

  /// Snap to the solved grid (the "Solution" button). No win transition.
  void reveal() => state = state.revealed();
}
