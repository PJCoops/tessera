// Shared ad-request builder: until iOS ATT is granted, every request must
// be non-personalized (spec §8.1/§8.3 — "until granted, request
// non-personalized ads only"). Android has no ATT concept; UMP's own GDPR
// signal already governs personalization there via the SDK's internal
// consent state, so it always gets a plain request.

import 'dart:io' show Platform;

import 'package:app_tracking_transparency/app_tracking_transparency.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';

Future<AdRequest> buildAdRequest() async {
  if (!Platform.isIOS) return const AdRequest();
  final status = await AppTrackingTransparency.trackingAuthorizationStatus;
  return AdRequest(
    nonPersonalizedAds: status == TrackingStatus.authorized ? null : true,
  );
}
