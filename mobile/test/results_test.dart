import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tessera/src/game/results.dart';
import 'package:tessera/src/mode.dart';

Future<void> _settle() async {
  for (var i = 0; i < 5; i++) {
    await Future<void>.delayed(Duration.zero);
  }
}

StoredResult _r(int moves, {bool revealed = false, int minSwaps = 8}) =>
    StoredResult(
      moves: moves,
      bonus: false,
      completedAt: 1000 + moves,
      revealed: revealed,
      minSwaps: minSwaps,
    );

void main() {
  test('records results and derives streak from wins only', () async {
    SharedPreferences.setMockInitialValues({});
    final c = ProviderContainer();
    addTearDown(c.dispose);
    c.read(resultsProvider(ModeId.classic)); // trigger build
    await _settle();

    final notifier = c.read(resultsProvider(ModeId.classic).notifier);
    notifier.record(5, _r(10));
    notifier.record(6, _r(12));
    notifier.record(7, _r(30, revealed: true)); // reveal is not a win

    expect(c.read(resultsProvider(ModeId.classic)).length, 3);
    expect(c.read(wonNumbersProvider(ModeId.classic)), [5, 6]);
    final streak = c.read(streakProvider(ModeId.classic));
    expect(streak.current, 2);
    expect(streak.max, 2);
    expect(streak.lastWon, 6);
  });

  test('classic and hard results are isolated by key prefix', () async {
    SharedPreferences.setMockInitialValues({});
    final c = ProviderContainer();
    addTearDown(c.dispose);
    c.read(resultsProvider(ModeId.classic));
    c.read(resultsProvider(ModeId.hard));
    await _settle();

    c.read(resultsProvider(ModeId.classic).notifier).record(5, _r(10));
    expect(c.read(resultsProvider(ModeId.hard)), isEmpty);
    expect(c.read(wonNumbersProvider(ModeId.hard)), isEmpty);
  });

  test('recorded results survive a fresh container', () async {
    SharedPreferences.setMockInitialValues({});
    final c1 = ProviderContainer();
    c1.read(resultsProvider(ModeId.classic));
    await _settle();
    c1.read(resultsProvider(ModeId.classic).notifier).record(9, _r(14));
    await _settle();
    c1.dispose();

    final c2 = ProviderContainer();
    addTearDown(c2.dispose);
    c2.read(resultsProvider(ModeId.classic));
    await _settle();
    final stored = c2.read(resultsProvider(ModeId.classic))[9];
    expect(stored, isNotNull);
    expect(stored!.moves, 14);
    expect(stored.minSwaps, 8);
  });
}
