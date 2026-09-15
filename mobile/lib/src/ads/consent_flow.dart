// Consent sequencing (spec §8.3): never before first play. Triggered once,
// from the result screen right after the first puzzle is solved — app opens
// → playable → first solve → this flow. Two system prompts, each preceded
// by our own one-line primer so the player is never surprised by a native
// dialog:
//   1. Google UMP (only actually shown in EEA/UK/CH — Google's own geo
//      gate; `loadAndShowConsentFormIfRequired` is a no-op everywhere else,
//      and our primer only shows when a form is genuinely pending, so
//      nobody outside those regions sees an irrelevant primer either).
//   2. iOS App Tracking Transparency (no-op on Android / already-decided
//      iOS installs — gated on `trackingAuthorizationStatus == notDetermined`
//      the same way the package's own docs recommend).
//
// Ads are then only ever requested once `ConsentInformation.canRequestAds()`
// is true (see [canRequestAds] below) — until iOS ATT is granted, ad
// requests are non-personalized only (spec: "until granted, request
// non-personalized ads only" — see ad_request.dart). SDK initialization
// itself (`MobileAds.instance.initialize()`) is NOT gated on consent — it
// isn't a request or a display, and it must run every process launch, not
// just once ever, so it lives in main.dart alongside the app's other
// startup init rather than here. Runs fully best-effort: any SDK failure
// here must never block gameplay ("the app boots and plays fully with
// everything denied").

import 'dart:async';
import 'dart:io' show Platform;

import 'package:app_tracking_transparency/app_tracking_transparency.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../i18n.dart';
import '../i18n/dict.dart';
import '../theme/tokens.dart';

const _doneKey = 'tessera:ads:consent-flow-done';

/// True once ads may actually be requested — either because consent has
/// been resolved (obtained, or not required for this user) and, on iOS,
/// tracking authorization has been decided one way or the other.
Future<bool> canRequestAds() =>
    ConsentInformation.instance.canRequestAds().catchError((_) => false);

/// Runs the one-time consent dialog sequence if it hasn't already run, and
/// (every call, not just the first) re-syncs UMP's in-memory consent state
/// from its persisted decision — `requestConsentInfoUpdate` must run every
/// process launch for `canRequestAds()`/`getConsentStatus()` to reflect
/// reality; only the *dialogs* are one-time-ever, not the state sync. Skew
/// here was a real bug: on a returning launch the dialog sequence (and
/// therefore `requestConsentInfoUpdate`) was skipped entirely, so
/// `canRequestAds()` stayed false all process long even though the player
/// had already granted consent in an earlier session. Never throws: any
/// SDK failure just leaves ads unrequestable, which the rest of the ads
/// code already treats as "don't show anything."
Future<void> ensureConsentFlow(BuildContext context, WidgetRef ref) async {
  await _syncConsentInfo();

  final prefs = await SharedPreferences.getInstance();
  if (prefs.getBool(_doneKey) ?? false) return;

  try {
    if (context.mounted) await _maybeShowUmpForm(context, ref);
    if (Platform.isIOS && context.mounted) {
      await _runAttStep(context, ref);
    }
  } catch (_) {
    // Fall through — still mark done, so a transient SDK error doesn't
    // re-prompt the player every launch.
  }
  await prefs.setBool(_doneKey, true);
}

Future<void> _syncConsentInfo() async {
  final completer = Completer<void>();
  ConsentInformation.instance.requestConsentInfoUpdate(
    ConsentRequestParameters(),
    completer.complete,
    (_) => completer.complete(),
  );
  await completer.future;
}

Future<void> _maybeShowUmpForm(BuildContext context, WidgetRef ref) async {
  final status = await ConsentInformation.instance.getConsentStatus();
  if (status != ConsentStatus.required) return;
  if (!context.mounted) return;

  await _showPrimer(context, ref, section: 'consentPrimer');
  if (!context.mounted) return;

  final dismissed = Completer<void>();
  ConsentForm.loadAndShowConsentFormIfRequired((_) => dismissed.complete());
  await dismissed.future;
}

Future<void> _runAttStep(BuildContext context, WidgetRef ref) async {
  final status = await AppTrackingTransparency.trackingAuthorizationStatus;
  if (status != TrackingStatus.notDetermined) return;
  if (!context.mounted) return;

  await _showPrimer(context, ref, section: 'attPrimer');
  // Let the primer's own dismiss animation finish before the system
  // dialog appears — matches the package's documented recommendation.
  await Future.delayed(const Duration(milliseconds: 200));
  await AppTrackingTransparency.requestTrackingAuthorization();
}

Future<void> _showPrimer(
  BuildContext context,
  WidgetRef ref, {
  required String section,
}) {
  final c = context.colors;
  final dict = ref.read(dictOrEmptyProvider);
  return showDialog<void>(
    context: context,
    barrierDismissible: false,
    builder: (ctx) => AlertDialog(
      backgroundColor: c.paper,
      title: Text(t(dict, 'ads.$section.title')),
      content: Text(t(dict, 'ads.$section.body')),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(),
          child: Text(t(dict, 'ads.$section.continue')),
        ),
      ],
    ),
  );
}
