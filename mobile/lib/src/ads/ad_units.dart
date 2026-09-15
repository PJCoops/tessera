// AdMob ad unit ids (spec §8.1: one interstitial, one anchored banner — no
// mediation, no rewarded yet). `dev` never uses real ad units: Google
// documents fixed public test ids that always return a sample ad and never
// count as invalid traffic, which matters because repeated impressions on
// real units from the same test devices risks the AdMob account being
// flagged. Only `prod` requests real inventory.
//
// App IDs go into native config (Info.plist / AndroidManifest via
// per-flavor xcconfig / manifest placeholders — see
// ios/Flutter/*.xcconfig and android/app/flavorizr.gradle.kts), not here;
// this file is only the ad-unit ids the Dart-side ad calls use directly.

import 'dart:io' show Platform;

import '../../flavors.dart';

class AdUnits {
  const AdUnits._();

  // Google's official sample ad unit ids — https://developers.google.com/admob/flutter/test-ads
  static const _testInterstitialIOS = 'ca-app-pub-3940256099942544/4411468910';
  static const _testInterstitialAndroid =
      'ca-app-pub-3940256099942544/1033173712';
  static const _testBannerIOS = 'ca-app-pub-3940256099942544/2934735716';
  static const _testBannerAndroid = 'ca-app-pub-3940256099942544/6300978111';

  static const _prodInterstitialIOS = 'ca-app-pub-9183489019845927/2473687843';
  static const _prodInterstitialAndroid =
      'ca-app-pub-9183489019845927/7755777993';
  static const _prodBannerIOS = 'ca-app-pub-9183489019845927/1160606172';
  static const _prodBannerAndroid = 'ca-app-pub-9183489019845927/6823996397';

  static bool get _isProd => F.appFlavor == Flavor.prod;

  static String get interstitial {
    if (!_isProd) return Platform.isIOS ? _testInterstitialIOS : _testInterstitialAndroid;
    return Platform.isIOS ? _prodInterstitialIOS : _prodInterstitialAndroid;
  }

  static String get banner {
    if (!_isProd) return Platform.isIOS ? _testBannerIOS : _testBannerAndroid;
    return Platform.isIOS ? _prodBannerIOS : _prodBannerAndroid;
  }
}
