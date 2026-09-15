// The one banner placement (spec §8.1): anchored on the History/Stats
// screen only. Collapses to zero height — no empty grey box — whenever
// there's no ad to show: consent unresolved, ads removed, or the network
// request comes back unfilled. Styled to sit in the design (padding,
// hairline divider, "Ad" label) rather than raw SDK chrome.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';

import '../i18n.dart';
import '../i18n/dict.dart';
import '../sync/sync_providers.dart';
import '../theme/tokens.dart';
import 'ad_request.dart';
import 'ad_units.dart';
import 'consent_flow.dart';

class HistoryBannerAd extends ConsumerStatefulWidget {
  const HistoryBannerAd({super.key});

  @override
  ConsumerState<HistoryBannerAd> createState() => _HistoryBannerAdState();
}

class _HistoryBannerAdState extends ConsumerState<HistoryBannerAd> {
  BannerAd? _ad;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _ad?.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    if (ref.read(adsRemovedProvider)) return;
    if (!await canRequestAds()) return;
    if (!mounted) return;

    final ad = BannerAd(
      size: AdSize.banner,
      adUnitId: AdUnits.banner,
      request: await buildAdRequest(),
      listener: BannerAdListener(
        onAdLoaded: (ad) {
          if (!mounted) {
            ad.dispose();
            return;
          }
          setState(() => _ad = ad as BannerAd);
        },
        onAdFailedToLoad: (ad, _) => ad.dispose(),
      ),
    );
    try {
      await ad.load();
    } catch (_) {
      // Never surface a load failure — the widget just stays collapsed.
    }
  }

  @override
  Widget build(BuildContext context) {
    final ad = _ad;
    if (ad == null) return const SizedBox.shrink();

    final c = context.colors;
    final dict = ref.watch(dictOrEmptyProvider);
    return SafeArea(
      top: false,
      child: Container(
        decoration: BoxDecoration(
          border: Border(top: BorderSide(color: c.rule)),
        ),
        padding: const EdgeInsets.only(top: 4, bottom: 4),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              t(dict, 'ads.label'),
              style: TextStyle(fontSize: 10, color: c.muted, letterSpacing: 1),
            ),
            const SizedBox(height: 2),
            SizedBox(
              width: ad.size.width.toDouble(),
              height: ad.size.height.toDouble(),
              child: AdWidget(ad: ad),
            ),
          ],
        ),
      ),
    );
  }
}
