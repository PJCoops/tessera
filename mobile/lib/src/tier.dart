// Port of app/lib/tier.ts. Tier by ratio of moves taken to the puzzle's
// exact min-swap count; the same bands cover 4x4 and 5x5. Keys are
// locale-independent; display names live in the locale dictionaries under
// `tiers.<key>`.

enum TierKey { legendary, genius, wordsmith, persistent, tenacious }

class Tier {
  const Tier(this.key, this.maxRatio);
  final TierKey key;
  final double maxRatio;
}

const List<Tier> tiers = [
  Tier(TierKey.legendary, 1.5),
  Tier(TierKey.genius, 2.5),
  Tier(TierKey.wordsmith, 4.5),
  Tier(TierKey.persistent, 7.0),
  Tier(TierKey.tenacious, double.infinity),
];

/// minSwaps <= 0 means the start was already solved (never in production) —
/// bucket as Legendary rather than divide by zero.
Tier getTier(int moves, int minSwaps) {
  if (minSwaps <= 0) return tiers.first;
  final ratio = moves / minSwaps;
  for (final t in tiers) {
    if (ratio <= t.maxRatio) return t;
  }
  return tiers.last;
}
