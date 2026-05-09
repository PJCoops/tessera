import { TIERS, TIERS_HARD, type Tier } from "./tier";
import type { Locale } from "./i18n";

export type ModeId = "classic" | "hard";

// Everything that varies between the 4×4 daily and the 5×5 hard daily
// reads from this config. Keep it a plain serialisable object — the same
// constant is read in server components and passed as a prop into the
// client `<TesseraGame>`, and Next.js refuses to serialise functions
// across that boundary.
export type ModeConfig = {
  id: ModeId;
  N: number;
  swaps: number;
  resultPrefix: string;
  progressPrefix: string;
  streakKey: string;
  tiers: readonly Tier[];
};

export const CLASSIC: ModeConfig = {
  id: "classic",
  N: 4,
  swaps: 12,
  resultPrefix: "tessera:result:",
  progressPrefix: "tessera:progress:",
  streakKey: "tessera:streak",
  tiers: TIERS,
};

export const HARD: ModeConfig = {
  id: "hard",
  N: 5,
  // 5×5 is roughly 1.4× the search space; bump scramble depth to keep the
  // start position visibly off and avoid trivial near-solves.
  swaps: 18,
  resultPrefix: "tessera:hard:result:",
  progressPrefix: "tessera:hard:progress:",
  streakKey: "tessera:hard:streak",
  tiers: TIERS_HARD,
};

export function modeById(id: ModeId): ModeConfig {
  return id === "hard" ? HARD : CLASSIC;
}

const localePrefix = (locale: Locale) => (locale === "en" ? "" : `/${locale}`);

export function homePath(mode: ModeConfig, locale: Locale): string {
  if (mode.id === "hard") return `${localePrefix(locale)}/hard`;
  return localePrefix(locale) || "/";
}

export function shareBase(mode: ModeConfig, locale: Locale): string {
  return mode.id === "hard"
    ? `${localePrefix(locale)}/hard/s`
    : `${localePrefix(locale)}/s`;
}
