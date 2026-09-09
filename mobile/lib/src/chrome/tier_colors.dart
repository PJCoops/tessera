import 'package:flutter/painting.dart';

import '../tier.dart';

/// Tier swatch colours, matched 1:1 to `TIER_COLORS` in app/lib/tier.ts
/// (legendary == the solved tile, genius == a valid row). Used by the
/// history tier-distribution chart and the per-result dots.
const Map<TierKey, Color> tierColors = {
  TierKey.legendary: Color(0xFFB85A1C),
  TierKey.genius: Color(0xFF7A9070),
  TierKey.wordsmith: Color(0xFF5B8AA8),
  TierKey.persistent: Color(0xFF6B7A8A),
  TierKey.tenacious: Color(0xFF7A6F8A),
};
