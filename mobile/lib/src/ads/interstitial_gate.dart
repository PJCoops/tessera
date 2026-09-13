// Interstitial gating rules (spec §8.1): a brand-new player sees no
// interstitial at all until they clear a small grace threshold, and even
// past grace it shows at most once per calendar day. Pure logic here, no
// ad SDK — the actual `google_mobile_ads` call site just asks
// [InterstitialGate.shouldShow] before requesting/showing a preloaded ad,
// then calls [InterstitialGate.recordShown].
//
// The grace thresholds are meant to be tunable via a PostHog flag once
// that's wired; [InterstitialGateConfig] is the seam for that — for now
// it's a fixed default.

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../clock.dart';
import '../game/results.dart';
import '../mode.dart';

class InterstitialGateConfig {
  const InterstitialGateConfig({
    this.graceStreak = 3,
    this.graceLifetimePlays = 3,
  });

  /// No interstitial until the player's current streak reaches this...
  final int graceStreak;

  /// ...or they've played this many puzzles lifetime, whichever comes first.
  final int graceLifetimePlays;
}

/// True once a player is past the new-player grace period (spec §8.1) —
/// i.e. an interstitial is allowed to show at all, subject to the daily
/// frequency cap on top.
bool isPastNewPlayerGrace({
  required int streak,
  required int lifetimePlays,
  InterstitialGateConfig config = const InterstitialGateConfig(),
}) => streak >= config.graceStreak || lifetimePlays >= config.graceLifetimePlays;

/// True if an interstitial hasn't already shown on [today] (UTC calendar
/// day, matching the puzzle-day convention elsewhere in the app).
bool isUnderDailyFrequencyCap({required String? lastShownUtcDate, required String today}) =>
    lastShownUtcDate != today;

final interstitialGateProvider = Provider((ref) => InterstitialGate());

/// Total puzzles played (solved or revealed) across both modes — the
/// "lifetime plays" half of the new-player grace check.
final lifetimePlaysProvider = Provider<int>((ref) {
  var total = 0;
  for (final m in ModeId.values) {
    total += ref.watch(resultsProvider(m)).length;
  }
  return total;
});

/// Wraps the two pure checks above with the small bit of persisted state
/// (last-shown day) they need.
class InterstitialGate {
  static const _lastShownKey = 'tessera:ads:interstitial-last-shown';

  Future<bool> shouldShow({
    required int streak,
    required int lifetimePlays,
    InterstitialGateConfig config = const InterstitialGateConfig(),
  }) async {
    if (!isPastNewPlayerGrace(
      streak: streak,
      lifetimePlays: lifetimePlays,
      config: config,
    )) {
      return false;
    }
    final p = await SharedPreferences.getInstance();
    return isUnderDailyFrequencyCap(
      lastShownUtcDate: p.getString(_lastShownKey),
      today: todayUtcDate(),
    );
  }

  /// Call once the interstitial has actually been shown, so the daily cap
  /// takes effect.
  Future<void> recordShown() async {
    final p = await SharedPreferences.getInstance();
    await p.setString(_lastShownKey, todayUtcDate());
  }
}
