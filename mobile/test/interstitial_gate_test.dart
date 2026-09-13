import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tessera/src/ads/interstitial_gate.dart';
import 'package:tessera/src/game/results.dart';
import 'package:tessera/src/mode.dart';

void main() {
  group('isPastNewPlayerGrace', () {
    test('brand-new player (no streak, no plays) stays in grace', () {
      expect(isPastNewPlayerGrace(streak: 0, lifetimePlays: 0), isFalse);
    });

    test('streak alone clears grace', () {
      expect(isPastNewPlayerGrace(streak: 3, lifetimePlays: 0), isTrue);
    });

    test('lifetime plays alone clears grace', () {
      expect(isPastNewPlayerGrace(streak: 0, lifetimePlays: 3), isTrue);
    });

    test('a custom config changes the thresholds', () {
      const config = InterstitialGateConfig(
        graceStreak: 5,
        graceLifetimePlays: 10,
      );
      expect(
        isPastNewPlayerGrace(streak: 3, lifetimePlays: 3, config: config),
        isFalse,
      );
      expect(
        isPastNewPlayerGrace(streak: 5, lifetimePlays: 0, config: config),
        isTrue,
      );
    });
  });

  group('isUnderDailyFrequencyCap', () {
    test('never shown before -> under the cap', () {
      expect(
        isUnderDailyFrequencyCap(lastShownUtcDate: null, today: '2026-09-13'),
        isTrue,
      );
    });

    test('already shown today -> over the cap', () {
      expect(
        isUnderDailyFrequencyCap(
          lastShownUtcDate: '2026-09-13',
          today: '2026-09-13',
        ),
        isFalse,
      );
    });

    test('shown yesterday -> under the cap again', () {
      expect(
        isUnderDailyFrequencyCap(
          lastShownUtcDate: '2026-09-12',
          today: '2026-09-13',
        ),
        isTrue,
      );
    });
  });

  group('InterstitialGate', () {
    test('shouldShow is false during grace regardless of the daily cap', () async {
      SharedPreferences.setMockInitialValues({});
      final gate = InterstitialGate();
      expect(
        await gate.shouldShow(streak: 0, lifetimePlays: 0),
        isFalse,
      );
    });

    test('shouldShow is true past grace, then false again after recordShown', () async {
      SharedPreferences.setMockInitialValues({});
      final gate = InterstitialGate();
      expect(await gate.shouldShow(streak: 3, lifetimePlays: 0), isTrue);

      await gate.recordShown();
      expect(await gate.shouldShow(streak: 3, lifetimePlays: 0), isFalse);
    });
  });

  test('lifetimePlaysProvider sums results across both modes', () {
    SharedPreferences.setMockInitialValues({});
    final container = ProviderContainer();
    addTearDown(container.dispose);

    container
        .read(resultsProvider(ModeId.classic).notifier)
        .record(1, const StoredResult(moves: 4, bonus: false, completedAt: 0));
    container
        .read(resultsProvider(ModeId.hard).notifier)
        .record(1, const StoredResult(moves: 6, bonus: false, completedAt: 0));
    container
        .read(resultsProvider(ModeId.hard).notifier)
        .record(2, const StoredResult(moves: 5, bonus: false, completedAt: 0));

    expect(container.read(lifetimePlaysProvider), 3);
  });
}
