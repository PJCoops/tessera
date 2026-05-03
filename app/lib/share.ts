import { getTier, type TierKey } from "./tier";
import { type Dictionary, type Locale, t } from "./i18n";

export type ShareInput = {
  puzzleNumber: number;
  moves: number;
  streak: number;
  bonus?: boolean;
  revealed?: boolean;
  locale: Locale;
  // Locale-aware copy: pass the player's current dictionary so the headline,
  // streak line, and bonus tag are in the language they're playing in.
  dict: Dictionary;
};

// Compact representation of a share slug. Used both in the share URL
// (so the recipient lands on a page with a per-solve OG card) and parsed
// back in app/page.tsx generateMetadata to populate the card.
export type ShareSlug = {
  num: number;
  moves: number | null;
  bonus: boolean;
  revealed: boolean;
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
const BONUS_TILE = "🟨";
const REVEALED_TILE = "⬜";

// Render a 4×4 emoji grid encoding the player's result. Solved rows
// fill green; on a bonus solve the corner tiles flip to yellow as a
// visual flourish ("rows + columns"); on a reveal the grid is empty.
function buildGrid({
  revealed,
  bonus,
}: {
  revealed: boolean;
  bonus: boolean;
}): string {
  if (revealed) {
    return Array.from({ length: 4 }, () => REVEALED_TILE.repeat(4)).join("\n");
  }
  if (!bonus) {
    return Array.from({ length: 4 }, () => SOLVED_TILE.repeat(4)).join("\n");
  }
  // Bonus solve: corners become yellow to flag the columns-also-spell
  // achievement. Reads as a "framed" grid.
  const corners = new Set(["0,0", "0,3", "3,0", "3,3"]);
  return Array.from({ length: 4 }, (_, r) =>
    Array.from({ length: 4 }, (_, c) =>
      corners.has(`${r},${c}`) ? BONUS_TILE : SOLVED_TILE
    ).join("")
  ).join("\n");
}

// Encode a result into a short URL slug like "6-12", "6-12-b", "6-r".
// Kept short because the slug shows up in shared URLs and chat windows.
export function buildShareSlug(s: ShareSlug): string {
  if (s.revealed) return `${s.num}-r`;
  const flag = s.bonus ? "-b" : "";
  const moves = s.moves ?? 0;
  return `${s.num}-${moves}${flag}`;
}

// Inverse of buildShareSlug. Returns null on anything malformed so the
// page can fall back to default metadata rather than render a broken
// card.
export function parseShareSlug(slug: string): ShareSlug | null {
  if (!/^\d+(?:-(?:r|\d+(?:-b)?))?$/.test(slug)) return null;
  const parts = slug.split("-");
  const num = parseInt(parts[0], 10);
  if (!Number.isFinite(num) || num <= 0) return null;
  if (parts.length === 1) {
    return { num, moves: null, bonus: false, revealed: false };
  }
  if (parts[1] === "r") {
    return { num, moves: null, bonus: false, revealed: true };
  }
  const moves = parseInt(parts[1], 10);
  if (!Number.isFinite(moves) || moves < 0) return null;
  const bonus = parts[2] === "b";
  return { num, moves, bonus, revealed: false };
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
  const { puzzleNumber, moves, streak, bonus = false, revealed = false, locale, dict } = input;
  const tier = getTier(moves);
  const tierName = t(dict, `tiers.${tier.key}`);
  const tierEmoji = TIER_EMOJI[tier.key] ?? "";
  const swapWord = t(dict, moves === 1 ? "game.swapSingular" : "game.swapPlural");

  const headline = revealed
    ? t(dict, "share.headlineRevealed", { num: puzzleNumber })
    : t(dict, "share.headlineSolved", {
        num: puzzleNumber,
        moves,
        swapWord,
        tierEmoji,
        tier: tierName,
      }).trim();

  const meta: string[] = [];
  if (!revealed && streak > 1) meta.push(t(dict, "share.streakMeta", { streak }));
  if (!revealed && bonus) meta.push(t(dict, "share.bonusMeta"));

  const slug = buildShareSlug({ num: puzzleNumber, moves, bonus, revealed });
  const localePrefix = locale === "en" ? "" : `/${locale}`;
  const url = `https://tesserapuzzle.com${localePrefix}/s/${slug}`;

  const lines = [headline];
  if (meta.length) lines.push(meta.join(" · "));
  lines.push("");
  lines.push(buildGrid({ revealed, bonus }));
  const text = lines.join("\n");
  return { text, url, full: `${text}\n\n${url}` };
}
