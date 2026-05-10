// Reads all stored results for a mode and returns the player's most
// frequent tier — used by the streak toast to flavour the message.
//
// Regenerating each historic puzzle to recover its minSwaps is the
// same trick HistoryModal uses; we cache per (locale, mode, num) so
// repeat clicks are cheap. Revealed results are skipped — they're
// not real solves and shouldn't tilt the player's identity.

import { dateFromPuzzleNumber, seedFromDate } from "./rng";
import { generateDailyPuzzleFor } from "./puzzle";
import { getTier, type TierKey } from "./tier";
import type { ModeConfig } from "./mode";
import type { Locale } from "./i18n";

type Result = { moves: number; bonus: boolean; completedAt: number; revealed?: boolean };

const minSwapsCache = new Map<string, number>();

function minSwapsFor(num: number, mode: ModeConfig, locale: Locale, epoch: string): number {
  const key = `${locale}:${mode.id}:${num}`;
  const cached = minSwapsCache.get(key);
  if (cached !== undefined) return cached;
  try {
    const date = dateFromPuzzleNumber(num, epoch);
    const { minSwaps } = generateDailyPuzzleFor(locale, seedFromDate(date), mode.swaps, mode.N);
    minSwapsCache.set(key, minSwaps);
    return minSwaps;
  } catch {
    return 1;
  }
}

export function dominantTier(
  mode: ModeConfig,
  locale: Locale,
  epoch: string
): TierKey | null {
  if (typeof window === "undefined") return null;
  const counts: Record<TierKey, number> = {
    legendary: 0,
    genius: 0,
    wordsmith: 0,
    persistent: 0,
    tenacious: 0,
  };
  let total = 0;
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key || !key.startsWith(mode.resultPrefix)) continue;
    const num = Number(key.slice(mode.resultPrefix.length));
    if (!Number.isFinite(num)) continue;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const r = JSON.parse(raw) as Result;
      if (r.revealed) continue;
      const ms = minSwapsFor(num, mode, locale, epoch);
      const tier = getTier(r.moves, ms);
      counts[tier.key] += 1;
      total += 1;
    } catch {}
  }
  if (total === 0) return null;
  let bestKey: TierKey = "tenacious";
  let bestCount = -1;
  // Iterate in TIERS order so ties favour the higher tier.
  const order: TierKey[] = ["legendary", "genius", "wordsmith", "persistent", "tenacious"];
  for (const k of order) {
    if (counts[k] > bestCount) {
      bestCount = counts[k];
      bestKey = k;
    }
  }
  return bestKey;
}
