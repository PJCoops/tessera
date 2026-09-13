import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tessera/src/game/board_controller.dart';
import 'package:tessera/src/game/puzzle.dart';
import 'package:tessera/src/game/results.dart';
import 'package:tessera/src/mode.dart';

Puzzle _sample() => Puzzle.sample();

/// resultsProvider hydrates off SharedPreferences asynchronously; reading
/// it once and awaiting a tick lets that finish before BoardController's
/// own (one-shot, `ref.read`) check of it, matching how a real app's
/// board mounts well after its own async puzzle fetch resolves.
Future<void> _hydrateResults(ProviderContainer c) async {
  c.read(resultsProvider(ModeId.classic));
  await Future<void>.delayed(Duration.zero);
}

void main() {
  test('a fresh puzzle starts scrambled and interactive', () {
    SharedPreferences.setMockInitialValues({});
    final container = ProviderContainer(
      overrides: [puzzleProvider.overrideWith((ref) => _sample())],
    );
    addTearDown(container.dispose);

    final board = container.read(boardProvider);
    expect(board.isSolved, isFalse);
  });

  test('reopening an already-solved puzzle shows the solved grid, not tappable', () async {
    SharedPreferences.setMockInitialValues({
      // Recorded earlier today, per the resultsProvider persistence format.
      'tessera:result:${_sample().num}':
          '{"moves":7,"bonus":false,"completedAt":1}',
    });
    final container = ProviderContainer(
      overrides: [puzzleProvider.overrideWith((ref) => _sample())],
    );
    addTearDown(container.dispose);

    await _hydrateResults(container);
    final board = container.read(boardProvider);
    expect(board.isSolved, isTrue);
    expect(board.moves, 7);
    expect(board.justSolved, isFalse);

    // A stray tap must be a no-op (board.dart: tap() short-circuits once
    // solved) — nothing should change.
    container.read(boardProvider.notifier).tap(0);
    expect(identical(container.read(boardProvider), board), isTrue);
  });

  test('reopening a revealed (not won) puzzle is reflected correctly', () async {
    SharedPreferences.setMockInitialValues({
      'tessera:result:${_sample().num}':
          '{"moves":40,"bonus":false,"completedAt":1,"revealed":true}',
    });
    final container = ProviderContainer(
      overrides: [puzzleProvider.overrideWith((ref) => _sample())],
    );
    addTearDown(container.dispose);

    await _hydrateResults(container);
    final board = container.read(boardProvider);
    expect(board.isSolved, isTrue);
    expect(board.solvedAtMove, -1);
  });
}
