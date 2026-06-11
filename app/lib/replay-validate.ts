// Server-side replay validation. A replay is the ordered list of swaps a
// player made, each a pair of board position indices (row-major). Applying
// them to the day's start letters must land every row on the gold solution,
// the same check the client runs in TesseraGame's `validity`.

export type SwapPair = [number, number];

// Real solves are well under 100 swaps; this only guards against
// pathological payloads.
export const MAX_REPLAY_MOVES = 500;

export type ReplayVerdict =
  | { ok: true; moves: number; bonus: boolean }
  | { ok: false; reason: "bad_history" | "too_many_moves" | "not_solved" };

export function isSwapHistory(v: unknown): v is SwapPair[] {
  return (
    Array.isArray(v) &&
    v.every(
      (p) =>
        Array.isArray(p) &&
        p.length === 2 &&
        Number.isInteger(p[0]) &&
        Number.isInteger(p[1])
    )
  );
}

// startLetters: the N*N start grid as one uppercase string in position
// order, as pinned in the puzzles table.
export function validateReplay(
  startLetters: string,
  goldRows: string[],
  history: SwapPair[]
): ReplayVerdict {
  const N = goldRows.length;
  const cells = N * N;
  if (startLetters.length !== cells) return { ok: false, reason: "bad_history" };
  if (history.length > MAX_REPLAY_MOVES) return { ok: false, reason: "too_many_moves" };

  const grid = startLetters.toUpperCase().split("");
  for (const [a, b] of history) {
    if (
      !Number.isInteger(a) ||
      !Number.isInteger(b) ||
      a === b ||
      a < 0 ||
      b < 0 ||
      a >= cells ||
      b >= cells
    ) {
      return { ok: false, reason: "bad_history" };
    }
    [grid[a], grid[b]] = [grid[b], grid[a]];
  }

  const goldUpper = goldRows.map((r) => r.toUpperCase());
  for (let r = 0; r < N; r++) {
    if (grid.slice(r * N, r * N + N).join("") !== goldUpper[r]) {
      return { ok: false, reason: "not_solved" };
    }
  }

  // When every row matches exactly the grid equals the gold grid, so this
  // always holds today; computed anyway to stay in lockstep with the
  // client's isBonus definition rather than assuming it.
  let bonus = true;
  for (let c = 0; c < N && bonus; c++) {
    for (let r = 0; r < N; r++) {
      if (grid[r * N + c] !== goldUpper[r][c]) {
        bonus = false;
        break;
      }
    }
  }
  return { ok: true, moves: history.length, bonus };
}
