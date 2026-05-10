"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

type Tile = { id: number; letter: string };

const N = 4;
const TILE = 56;
const GAP = 4;
const GRID_PX = TILE * N + GAP * (N - 1);

const SOLVED_ROWS = ["SHOW", "HAVE", "OVER", "WERE"];
const SOLVED_LETTERS_BY_ID = SOLVED_ROWS.join("").split(""); // index = id, value = solved letter

// Solving sequence applied to scramble produces the solved grid. Indices
// are flat 0–15. Order is meaningful for which row completes when.
const SOLVE_SEQUENCE: ReadonlyArray<readonly [number, number]> = [
  [1, 10],
  [4, 12],
  [6, 15],
  [2, 11],
  [0, 5],
];

// IDs at each scramble index, derived by applying SOLVE_SEQUENCE forward
// to the identity array [0..15]. This keeps tile ids tied to their
// solved-grid home position (id / N === home row), which is what the
// home-hint logic relies on.
const SCRAMBLE_IDS = [5, 10, 11, 3, 12, 0, 15, 7, 8, 9, 1, 2, 4, 13, 14, 6];

function buildScrambled(): Tile[] {
  return SCRAMBLE_IDS.map((id) => ({ id, letter: SOLVED_LETTERS_BY_ID[id] }));
}

function indexToXY(idx: number) {
  const r = Math.floor(idx / N);
  const c = idx % N;
  return { x: c * (TILE + GAP), y: r * (TILE + GAP) };
}

function rowValidArr(positions: Tile[]): boolean[] {
  const out: boolean[] = [];
  for (let r = 0; r < N; r++) {
    let s = "";
    for (let c = 0; c < N; c++) s += positions[r * N + c].letter;
    out.push(s === SOLVED_ROWS[r]);
  }
  return out;
}

// Multiset-aware home-hint: a tile in row r gets dotted iff its letter
// is still needed in row r's gold solution (priority to actual home tiles).
// Mirrors the logic in TesseraGame.
function homeHintArr(positions: Tile[]): boolean[] {
  const hints = new Array<boolean>(positions.length).fill(false);
  for (let r = 0; r < N; r++) {
    const remaining = new Map<string, number>();
    for (const ch of SOLVED_ROWS[r]) {
      remaining.set(ch, (remaining.get(ch) ?? 0) + 1);
    }
    const order = Array.from({ length: N }, (_, c) => r * N + c).sort((a, b) => {
      const aHome = Math.floor(positions[a].id / N) === r ? 0 : 1;
      const bHome = Math.floor(positions[b].id / N) === r ? 0 : 1;
      return aHome - bHome;
    });
    for (const idx of order) {
      const ch = positions[idx].letter;
      const left = remaining.get(ch) ?? 0;
      if (left > 0) {
        hints[idx] = true;
        remaining.set(ch, left - 1);
      }
    }
  }
  return hints;
}

export function StartDemo() {
  const [positions, setPositions] = useState<Tile[]>(() => buildScrambled());
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [cursorIdx, setCursorIdx] = useState<number>(SOLVE_SEQUENCE[0][0]);
  const [cursorDown, setCursorDown] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(true);

  const rowValid = useMemo(() => rowValidArr(positions), [positions]);
  const isSolved = rowValid.every(Boolean);
  const homeHint = useMemo(() => homeHintArr(positions), [positions]);

  // Stable map: tile id → current index.
  const idxById = new Map<number, number>();
  positions.forEach((t, i) => idxById.set(t.id, i));

  useEffect(() => {
    let cancelled = false;
    const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

    const swap = (arr: Tile[], a: number, b: number): Tile[] => {
      const next = arr.slice();
      [next[a], next[b]] = [next[b], next[a]];
      return next;
    };

    async function runOnce() {
      const start = buildScrambled();
      setPositions(start);
      setSelectedIdx(null);
      setCursorIdx(SOLVE_SEQUENCE[0][0]);
      setCursorDown(false);
      setCursorVisible(true);

      let current = start;
      await wait(700);

      for (const [a, b] of SOLVE_SEQUENCE) {
        if (cancelled) return;

        setCursorIdx(a);
        await wait(520);
        if (cancelled) return;

        setCursorDown(true);
        setSelectedIdx(a);
        await wait(180);
        if (cancelled) return;
        setCursorDown(false);
        await wait(140);
        if (cancelled) return;

        setCursorIdx(b);
        await wait(480);
        if (cancelled) return;

        setCursorDown(true);
        await wait(160);
        if (cancelled) return;
        setSelectedIdx(null);
        const next = swap(current, a, b);
        current = next;
        setPositions(next);
        await wait(120);
        if (cancelled) return;
        setCursorDown(false);

        await wait(520);
        if (cancelled) return;
      }

      // Hold solved state — let the rust cascade play out
      setCursorVisible(false);
      await wait(2200);
    }

    async function loop() {
      while (!cancelled) {
        await runOnce();
      }
    }

    loop();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cursorXY = indexToXY(cursorIdx);
  const cursorCenter = { x: cursorXY.x + TILE / 2, y: cursorXY.y + TILE / 2 };

  const selectedTileId =
    selectedIdx !== null ? positions[selectedIdx]?.id ?? null : null;

  return (
    <div
      className="relative"
      style={{ width: GRID_PX, height: GRID_PX }}
      aria-hidden
    >
      {[...positions]
        .map((t) => ({ tile: t, idx: idxById.get(t.id)! }))
        .sort((a, b) => a.tile.id - b.tile.id)
        .map(({ tile, idx }) => {
          const r = Math.floor(idx / N);
          const rv = rowValid[r];
          const isSelected = selectedTileId === tile.id;
          const xy = indexToXY(idx);
          const showHint = !rv && !isSolved && homeHint[idx];

          // Color states: solved (rust) > row valid (green) > default (cream)
          const bg = isSolved
            ? "#b85a1c"
            : rv
            ? "#7a9070"
            : "var(--color-cream)";
          const fg = isSolved || rv ? "#fafaf7" : "var(--color-ink)";

          return (
            <motion.div
              key={tile.id}
              initial={false}
              animate={{
                x: xy.x,
                y: xy.y,
                scale: isSolved ? [1, 1.1, 1] : isSelected ? 1.04 : 1,
                rotate: isSolved ? [0, -3, 3, 0] : 0,
                backgroundColor: bg,
                color: fg,
              }}
              transition={{
                x: { type: "spring", stiffness: 500, damping: 35 },
                y: { type: "spring", stiffness: 500, damping: 35 },
                scale: isSolved
                  ? { duration: 0.5, delay: idx * 0.07, ease: "easeOut" }
                  : isSelected
                  ? { type: "spring", stiffness: 500, damping: 35 }
                  : { duration: 0.15 },
                rotate: isSolved
                  ? { duration: 0.5, delay: idx * 0.07, ease: "easeOut" }
                  : { duration: 0.15 },
                backgroundColor: isSolved
                  ? { duration: 0.25, delay: idx * 0.07 + 0.1 }
                  : { duration: 0.2 },
                color: isSolved
                  ? { duration: 0.25, delay: idx * 0.07 + 0.1 }
                  : { duration: 0.2 },
              }}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: TILE,
                height: TILE,
                fontSize: TILE * 0.42,
                zIndex: isSelected ? 10 : 1,
              }}
              className={`flex items-center justify-center rounded-md font-medium ${
                showHint
                  ? "outline-2 outline-dashed outline-[color:var(--color-ink)] -outline-offset-[3px]"
                  : !rv && !isSolved
                  ? "border border-[color:var(--color-rule)]"
                  : ""
              } ${isSelected ? "ring-2 ring-[color:var(--color-ink)]" : ""}`}
            >
              {tile.letter}
            </motion.div>
          );
        })}

      <motion.div
        className="absolute pointer-events-none rounded-full"
        style={{
          width: 22,
          height: 22,
          marginLeft: -11,
          marginTop: -11,
          background: cursorDown ? "rgba(60,60,60,0.55)" : "rgba(120,120,120,0.45)",
          border: "1px solid rgba(255,255,255,0.6)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
          zIndex: 20,
        }}
        initial={false}
        animate={{
          x: cursorCenter.x,
          y: cursorCenter.y,
          scale: cursorDown ? 0.85 : 1,
          opacity: cursorVisible ? 1 : 0,
        }}
        transition={{
          x: { type: "spring", stiffness: 220, damping: 28, mass: 0.6 },
          y: { type: "spring", stiffness: 220, damping: 28, mass: 0.6 },
          scale: { duration: 0.08, ease: "easeOut" },
          opacity: { duration: 0.25 },
        }}
      />
    </div>
  );
}
