import { getTier } from "./tier";

export type ShareInput = {
  puzzleNumber: number;
  moves: number;
  streak: number;
  revealed?: boolean;
};

export function buildShareString(input: ShareInput): string {
  const { puzzleNumber, moves, streak, revealed } = input;
  const headline = revealed
    ? `Tessera #${puzzleNumber} · revealed`
    : `Tessera #${puzzleNumber} · solved in ${moves} ${moves === 1 ? "swap" : "swaps"} · ${getTier(moves).name}`;
  const lines = [headline];
  if (!revealed && streak > 1) lines.push(`streak ${streak} 🔥`);
  lines.push("tesserapuzzle.com");
  return lines.join("\n");
}
