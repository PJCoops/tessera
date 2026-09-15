// The one interstitial placement (spec §8.1): after the result screen's
// win animation has fully settled plus a short beat, never overlapping the
// solved-cascade frames. Preloaded during play so there's no spinner —
// [InterstitialAdController.preload] is called as soon as the board is
// solved, and [maybeShow] (called after the cascade-settle delay) shows
// whatever's already loaded rather than loading on demand.
//
// Gating is layered: [InterstitialGate] (new-player grace + once/day,
// pure logic, already unit-tested) decides *whether* an interstitial is
// allowed at all; this controller additionally requires consent to have
// resolved ([canRequestAds]) and `!adsRemoved` before ever calling the SDK.

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';

import '../sync/sync_providers.dart';
import 'ad_request.dart';
import 'ad_units.dart';
import 'consent_flow.dart';
import 'interstitial_gate.dart';

final interstitialAdControllerProvider =
    Provider<InterstitialAdController>((ref) {
      final controller = InterstitialAdController(ref);
      ref.onDispose(controller.dispose);
      return controller;
    });

class InterstitialAdController {
  InterstitialAdController(this._ref);

  final Ref _ref;
  InterstitialAd? _loaded;
  Completer<void>? _loadCompleter;

  /// Completes only once the load actually resolves (fill or failure),
  /// not just once the load request round-trips — `InterstitialAd.load`'s
  /// own future resolves on the latter, well before `onAdLoaded`/
  /// `onAdFailedToLoad` fire, which would otherwise race callers that
  /// need to know whether an ad is actually ready right after preloading
  /// (see game_screen.dart's post-consent preload retry).
  Future<void> preload() {
    if (_loaded != null) return Future.value();
    final inFlight = _loadCompleter;
    if (inFlight != null) return inFlight.future;
    if (_ref.read(adsRemovedProvider)) return Future.value();

    final completer = Completer<void>();
    _loadCompleter = completer;
    () async {
      try {
        if (!await canRequestAds()) {
          _loadCompleter = null;
          completer.complete();
          return;
        }
        await InterstitialAd.load(
          adUnitId: AdUnits.interstitial,
          request: await buildAdRequest(),
          adLoadCallback: InterstitialAdLoadCallback(
            onAdLoaded: (ad) {
              _loadCompleter = null;
              _loaded = ad;
              if (!completer.isCompleted) completer.complete();
            },
            onAdFailedToLoad: (_) {
              _loadCompleter = null;
              if (!completer.isCompleted) completer.complete();
            },
          ),
        );
      } catch (_) {
        _loadCompleter = null;
        if (!completer.isCompleted) completer.complete();
      }
    }();
    return completer.future;
  }

  /// Shows the preloaded ad if [InterstitialGate] allows it this time,
  /// consent has resolved, and ads aren't removed. No-op (never throws)
  /// otherwise — a missing/unfilled ad must never block the result screen.
  Future<void> maybeShow({
    required int streak,
    required int lifetimePlays,
  }) async {
    if (_ref.read(adsRemovedProvider)) return;
    final ad = _loaded;
    if (ad == null) return;
    if (!await canRequestAds()) return;
    if (!await _ref
        .read(interstitialGateProvider)
        .shouldShow(streak: streak, lifetimePlays: lifetimePlays)) {
      return;
    }

    _loaded = null;
    ad.fullScreenContentCallback = FullScreenContentCallback(
      onAdDismissedFullScreenContent: (ad) {
        ad.dispose();
        preload();
      },
      onAdFailedToShowFullScreenContent: (ad, _) {
        ad.dispose();
        preload();
      },
    );
    await _ref.read(interstitialGateProvider).recordShown();
    try {
      await ad.show();
    } catch (_) {
      ad.dispose();
    }
  }

  void dispose() {
    _loaded?.dispose();
  }
}
