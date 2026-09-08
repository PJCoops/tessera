// Reads all stored results for a mode and returns the player's most
// frequent tier — used by the streak toast to flavour the message.
//
// minSwaps is read from each stored result (written at solve time). Results
// solved before minSwaps was persisted are skipped — this is a cosmetic
// toast, so a partial count is fine and it never blocks on the network.
// Revealed results are skipped too — they're not real solves.

import { getTier, type TierKey } from "./tier";
import type { ModeConfig } from "./mode";

type Result = { moves: number; revealed?: boolean; minSwaps?: number };

export function dominantTier(mode: ModeConfig): TierKey | null {
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
      if (r.revealed || typeof r.minSwaps !== "number") continue;
      const tier = getTier(r.moves, r.minSwaps);
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
