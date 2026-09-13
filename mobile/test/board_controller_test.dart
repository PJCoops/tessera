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

  test('elapsedMs is null until the first tap, then measures from it', () async {
    SharedPreferences.setMockInitialValues({});
    final container = ProviderContainer(
      overrides: [puzzleProvider.overrideWith((ref) => _sample())],
    );
    addTearDown(container.dispose);

    final notifier = container.read(boardProvider.notifier);
    expect(notifier.elapsedMs(), isNull, reason: 'no tap yet');

    notifier.tap(0);
    await Future<void>.delayed(const Duration(milliseconds: 5));
    final elapsed = notifier.elapsedMs();
    expect(elapsed, isNotNull);
    expect(elapsed! >= 0, isTrue);

    // A later tap doesn't reset the clock — it's the *first* tap only.
    final startedAtFirst = elapsed;
    await Future<void>.delayed(const Duration(milliseconds: 5));
    notifier.tap(1);
    expect(notifier.elapsedMs()! >= startedAtFirst, isTrue);
  });

  test('reset() clears elapsedMs so a fresh puzzle starts the clock over', () {
    SharedPreferences.setMockInitialValues({});
    final container = ProviderContainer(
      overrides: [puzzleProvider.overrideWith((ref) => _sample())],
    );
    addTearDown(container.dispose);

    final notifier = container.read(boardProvider.notifier);
    notifier.tap(0);
    expect(notifier.elapsedMs(), isNotNull);

    notifier.reset();
    expect(notifier.elapsedMs(), isNull);
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
