import { getTier, type TierKey } from "./tier";
import { type Dictionary, type Locale, t } from "./i18n";
import { CLASSIC, type ModeConfig, type ModeId } from "./mode";

export type ShareInput = {
  puzzleNumber: number;
  moves: number;
  // The puzzle's exact minimum number of swaps. Required for tier
  // computation under the ratio-based system.
  minSwaps: number;
  streak: number;
  bonus?: boolean;
  revealed?: boolean;
  locale: Locale;
  // Locale-aware copy: pass the player's current dictionary so the headline,
  // streak line, and bonus tag are in the language they're playing in.
  dict: Dictionary;
  mode?: ModeConfig;
};

// Compact representation of a share slug. Used both in the share URL
// (so the recipient lands on a page with a per-solve OG card) and parsed
// back in app/page.tsx generateMetadata to populate the card.
export type ShareSlug = {
  num: number;
  moves: number | null;
  bonus: boolean;
  revealed: boolean;
  mode?: ModeId;
};

// Tier-specific emoji used in the share headline. Keyed by locale-independent
// tier key so emoji stay constant across languages.
const TIER_EMOJI: Record<TierKey, string> = {
  legendary: "🏆",
  genius: "🧠",
  wordsmith: "📖",
  persistent: "🧩",
  tenacious: "💪",
};

const SOLVED_TILE = "🟩";
const BONUS_TILE = "🟧";
const REVEALED_TILE = "⬜";

// Render an N×N emoji grid encoding the player's result. Solved rows
// fill green; on a bonus solve the corner tiles flip to orange as a
// visual flourish ("rows + columns"); on a reveal the grid is empty.
function buildGrid({
  revealed,
  bonus,
  N,
}: {
  revealed: boolean;
  bonus: boolean;
  N: number;
}): string {
  if (revealed) {
    return Array.from({ length: N }, () => REVEALED_TILE.repeat(N)).join("\n");
  }
  if (!bonus) {
    return Array.from({ length: N }, () => SOLVED_TILE.repeat(N)).join("\n");
  }
  // Bonus solve: corners become orange to flag the columns-also-spell
  // achievement. Reads as a "framed" grid.
  const last = N - 1;
  const corners = new Set([`0,0`, `0,${last}`, `${last},0`, `${last},${last}`]);
  return Array.from({ length: N }, (_, r) =>
    Array.from({ length: N }, (_, c) =>
      corners.has(`${r},${c}`) ? BONUS_TILE : SOLVED_TILE
    ).join("")
  ).join("\n");
}

// Encode a result into a short URL slug. Classic shares stay
// unchanged: "6-12", "6-12-b", "6-r". Hard mode gets an "h" prefix:
// "h6-12", "h6-12-b", "h6-r". The mode is inferred from the URL path
// (/s vs /hard/s) but the slug carries it too so legacy or copy-pasted
// URLs that lose the path still parse correctly.
export function buildShareSlug(s: ShareSlug): string {
  const prefix = s.mode === "hard" ? "h" : "";
  if (s.revealed) return `${prefix}${s.num}-r`;
  const flag = s.bonus ? "-b" : "";
  const moves = s.moves ?? 0;
  return `${prefix}${s.num}-${moves}${flag}`;
}

// Inverse of buildShareSlug. Returns null on anything malformed so the
// page can fall back to default metadata rather than render a broken
// card. Accepts an optional leading "h" for hard mode.
export function parseShareSlug(slug: string): ShareSlug | null {
  const hardMatch = /^h(\d.*)$/.exec(slug);
  const isHard = hardMatch !== null;
  const body = isHard ? hardMatch[1] : slug;
  if (!/^\d+(?:-(?:r|\d+(?:-b)?))?$/.test(body)) return null;
  const parts = body.split("-");
  const num = parseInt(parts[0], 10);
  if (!Number.isFinite(num) || num <= 0) return null;
  const mode: ModeId | undefined = isHard ? "hard" : undefined;
  if (parts.length === 1) {
    return { num, moves: null, bonus: false, revealed: false, mode };
  }
  if (parts[1] === "r") {
    return { num, moves: null, bonus: false, revealed: true, mode };
  }
  const moves = parseInt(parts[1], 10);
  if (!Number.isFinite(moves) || moves < 0) return null;
  const bonus = parts[2] === "b";
  return { num, moves, bonus, revealed: false, mode };
}

// Returns the share split into a `text` half (headline, meta, grid) and a
// separate `url`. Web Share API targets disagree on which field they read:
// WhatsApp / X / iMessage concatenate text+url; Facebook drops `text` and
// only reads `url`, relying on OG tags to unfurl. Passing both fields
// makes every target work. `full` is the joined version used for the
// clipboard fallback.
export function buildSharePayload(input: ShareInput): {
  text: string;
  url: string;
  full: string;
} {
  const {
    puzzleNumber,
    moves,
    minSwaps,
    streak,
    bonus = false,
    revealed = false,
    locale,
    dict,
    mode = CLASSIC,
  } = input;
  const tier = getTier(moves, minSwaps);
  const tierName = t(dict, `tiers.${tier.key}`);
  const tierEmoji = TIER_EMOJI[tier.key] ?? "";
  const swapWord = t(dict, moves === 1 ? "game.swapSingular" : "game.swapPlural");

  const headlineKey = mode.id === "hard" ? "share.headlineSolvedHard" : "share.headlineSolved";
  const revealedKey = mode.id === "hard" ? "share.headlineRevealedHard" : "share.headlineRevealed";
  const headline = revealed
    ? t(dict, revealedKey, { num: puzzleNumber })
    : t(dict, headlineKey, {
        num: puzzleNumber,
        moves,
        swapWord,
        tierEmoji,
        tier: tierName,
      }).trim();

  const meta: string[] = [];
  if (!revealed && streak > 1) meta.push(t(dict, "share.streakMeta", { streak }));
  if (!revealed && bonus) meta.push(t(dict, "share.bonusMeta"));

  const slug = buildShareSlug({
    num: puzzleNumber,
    moves,
    bonus,
    revealed,
    mode: mode.id,
  });
  const localePrefix = locale === "en" ? "" : `/${locale}`;
  const sharePath = mode.id === "hard" ? "/hard/s" : "/s";
  const url = `https://tesserapuzzle.com${localePrefix}${sharePath}/${slug}`;

  const lines = [headline];
  if (meta.length) lines.push(meta.join(" · "));
  lines.push("");
  lines.push(buildGrid({ revealed, bonus, N: mode.N }));
  const text = lines.join("\n");
  return { text, url, full: `${text}\n\n${url}` };
}
