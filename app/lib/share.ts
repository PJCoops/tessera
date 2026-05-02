import { getTier } from "./tier";

export type ShareInput = {
  puzzleNumber: number;
  moves: number;
  streak: number;
  bonus?: boolean;
  revealed?: boolean;
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

// Tier-specific emoji used in the share headline. Keeps the share line
// distinctive at a glance — Wordle has its yellow/green grid, Tessera
// has the tier badge plus the gold rows below.
const TIER_EMOJI: Record<string, string> = {
  Legendary: "🏆",
  Genius: "🧠",
  Wordsmith: "📖",
  Persistent: "🧩",
  Tenacious: "💪",
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

export function buildShareString(input: ShareInput): string {
  const { puzzleNumber, moves, streak, bonus = false, revealed = false } = input;
  const tier = getTier(moves);
  const tierEmoji = TIER_EMOJI[tier.name] ?? "";
  const headline = revealed
    ? `Tessera #${puzzleNumber} · revealed`
    : `Tessera #${puzzleNumber} · ${moves} ${moves === 1 ? "swap" : "swaps"} · ${tierEmoji} ${tier.name}`.trim();

  const meta: string[] = [];
  if (!revealed && streak > 1) meta.push(`🔥 ${streak}-day streak`);
  if (!revealed && bonus) meta.push("✨ bonus");

  const slug = buildShareSlug({ num: puzzleNumber, moves, bonus, revealed });
  const url = `tesserapuzzle.com/?s=${slug}`;

  const lines = [headline];
  if (meta.length) lines.push(meta.join(" · "));
  lines.push("");
  lines.push(buildGrid({ revealed, bonus }));
  lines.push("");
  lines.push(url);
  return lines.join("\n");
}
