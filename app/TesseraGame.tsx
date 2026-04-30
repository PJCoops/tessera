"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { DEMO_GRID, generateDailyPuzzle, scrambleGoldRows, tilesFromRows, type Tile } from "./lib/puzzle";
import { puzzleNumber, seedFromDate, todayUtc } from "./lib/rng";
import { readStreak, recordWin, visibleCurrent, type Streak } from "./lib/streak";
import { buildShareString } from "./lib/share";
import { getTier } from "./lib/tier";
import { HowToPlay, hasSeenHowTo, markHowToSeen } from "./HowToPlay";
import { HistoryModal } from "./HistoryModal";

const N = 4;
const EPOCH = "2026-04-27"; // Tessera #1
const TILE = 68;
const GAP = 6;

type Result = { moves: number; bonus: boolean; completedAt: number; revealed?: boolean };

function rowLetters(positions: Tile[], r: number): string[] {
  return Array.from({ length: N }, (_, c) => positions[r * N + c].letter);
}
function colLetters(positions: Tile[], c: number): string[] {
  return Array.from({ length: N }, (_, r) => positions[r * N + c].letter);
}
function swapAt(p: Tile[], a: number, b: number): Tile[] {
  const next = p.slice();
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

const RESULT_PREFIX = "tessera:result:";
const PROGRESS_PREFIX = "tessera:progress:";
const HIDE_HINTS_KEY = "tessera:hide-hints";

type Progress = { positions: Tile[]; moves: number };

function readResult(num: number): Result | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(RESULT_PREFIX + num);
    return raw ? (JSON.parse(raw) as Result) : null;
  } catch {
    return null;
  }
}
function writeResult(num: number, r: Result) {
  try {
    window.localStorage.setItem(RESULT_PREFIX + num, JSON.stringify(r));
  } catch {}
}
function readProgress(num: number): Progress | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PROGRESS_PREFIX + num);
    return raw ? (JSON.parse(raw) as Progress) : null;
  } catch {
    return null;
  }
}
function writeProgress(num: number, p: Progress) {
  try {
    window.localStorage.setItem(PROGRESS_PREFIX + num, JSON.stringify(p));
  } catch {}
}
function clearProgress(num: number) {
  try {
    window.localStorage.removeItem(PROGRESS_PREFIX + num);
  } catch {}
}
// Drop progress entries for any puzzle other than today's. Players abandon
// puzzles often — without this, those keys accumulate forever.
function pruneOldProgress(currentNum: number) {
  if (typeof window === "undefined") return;
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(PROGRESS_PREFIX)) continue;
      const num = Number(key.slice(PROGRESS_PREFIX.length));
      if (Number.isFinite(num) && num !== currentNum) toRemove.push(key);
    }
    for (const k of toRemove) window.localStorage.removeItem(k);
  } catch {}
}

function msToNextUtcMidnight(): number {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return next.getTime() - now.getTime();
}
function formatHms(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export function TesseraGame() {
  const [mounted, setMounted] = useState(false);
  const [puzzle, setPuzzle] = useState<{
    num: number;
    date: string;
    startTiles: Tile[];
    goldRows: string[];
    forceSolved: boolean;
    demo: boolean;
  } | null>(null);
  const [positions, setPositions] = useState<Tile[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [solvedAt, setSolvedAt] = useState<number | null>(null);
  const [bonusAt, setBonusAt] = useState<number | null>(null);
  const [storedResult, setStoredResult] = useState<Result | null>(null);
  const [countdown, setCountdown] = useState<string>("");
  const [streak, setStreak] = useState<Streak>({ current: 0, max: 0, lastWon: 0 });
  const [copied, setCopied] = useState(false);
  const [howToOpen, setHowToOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [helpTab, setHelpTab] = useState<"how" | "words">("how");
  const [confirmReveal, setConfirmReveal] = useState(false);
  const [demoPlaying, setDemoPlaying] = useState(false);
  const [idleTick, setIdleTick] = useState(0);
  const [hideHints, setHideHints] = useState(false);

  // Initialise on client mount (avoids SSR/UTC drift hydration mismatch).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const today = todayUtc();
    const dateOverride = params.get("day"); // e.g. ?day=2026-05-01
    const date = dateOverride ?? today;
    const num = puzzleNumber(date, EPOCH);
    const seed = seedFromDate(date);
    const forceSolved = params.get("solve") !== null;
    const demo = params.get("demo") !== null;

    let goldRows: string[];
    let startTiles: Tile[];
    if (demo) {
      goldRows = [...DEMO_GRID];
      startTiles = forceSolved ? tilesFromRows(goldRows) : scrambleGoldRows(goldRows, 42);
    } else {
      const generated = generateDailyPuzzle(seed);
      goldRows = generated.goldRows;
      startTiles = forceSolved ? tilesFromRows(goldRows) : generated.startTiles;
    }

    setPuzzle({ num, date, startTiles, goldRows, forceSolved, demo });

    // Demo and force-solved modes are isolated from real player state — no
    // stored result, no progress restore, no streak interaction.
    const isolated = demo || forceSolved;
    const stored = isolated ? null : readResult(num);
    setStoredResult(stored);
    setStreak(readStreak());
    const progress = !isolated && !stored ? readProgress(num) : null;
    if (progress) {
      setPositions(progress.positions);
      setMoves(progress.moves);
    } else {
      setPositions(startTiles);
    }
    if (!demo) pruneOldProgress(num);
    if (!hasSeenHowTo()) setHowToOpen(true);
    try {
      setHideHints(window.localStorage.getItem(HIDE_HINTS_KEY) === "1");
    } catch {}
    setMounted(true);
  }, []);

  const updateHideHints = useCallback((v: boolean) => {
    setHideHints(v);
    try {
      window.localStorage.setItem(HIDE_HINTS_KEY, v ? "1" : "0");
    } catch {}
  }, []);

  // Countdown to next puzzle.
  useEffect(() => {
    const tick = () => setCountdown(formatHms(msToNextUtcMidnight()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const validity = useMemo(() => {
    if (positions.length === 0 || !puzzle)
      return { rowValid: [], colValid: [], validRowCount: 0, validColCount: 0, isSolved: false, isBonus: false };
    const goldRowsUpper = puzzle.goldRows.map((r) => r.toUpperCase());
    const rowValid = Array.from(
      { length: N },
      (_, r) => rowLetters(positions, r).join("") === goldRowsUpper[r]
    );
    const colValid = Array.from({ length: N }, (_, c) => {
      const goldCol = goldRowsUpper.map((row) => row[c]).join("");
      return colLetters(positions, c).join("") === goldCol;
    });
    return {
      rowValid,
      colValid,
      validRowCount: rowValid.filter(Boolean).length,
      validColCount: colValid.filter(Boolean).length,
      isSolved: rowValid.every(Boolean),
      isBonus: rowValid.every(Boolean) && colValid.every(Boolean),
    };
  }, [positions, puzzle]);

  useEffect(() => {
    if (!puzzle) return;
    if (
      validity.isSolved &&
      solvedAt === null &&
      !storedResult?.revealed &&
      !puzzle.forceSolved
    ) {
      // Track move count locally even in demo mode so the status reads
      // "Solved in N moves" — demo just skips the localStorage writes.
      setSolvedAt(moves);
      if (!puzzle.demo) {
        const r: Result = { moves, bonus: validity.isBonus, completedAt: Date.now() };
        writeResult(puzzle.num, r);
        clearProgress(puzzle.num);
        setStoredResult(r);
        setStreak(recordWin(puzzle.num));
      }
    }
    if (validity.isBonus && bonusAt === null) setBonusAt(moves);
  }, [validity.isSolved, validity.isBonus, moves, solvedAt, bonusAt, puzzle, storedResult]);

  // Show a one-shot demo swap if the player has stalled before their first move.
  // Replays every 7s of continued inactivity so it's always there when they look up.
  useEffect(() => {
    if (!mounted || !puzzle) return;
    if (demoPlaying) return;
    if (moves > 0 || selectedIdx !== null) return;
    if (validity.isSolved || storedResult) return;
    const id = setTimeout(() => setDemoPlaying(true), 7000);
    return () => clearTimeout(id);
  }, [mounted, puzzle, demoPlaying, moves, selectedIdx, validity.isSolved, storedResult, idleTick]);

  const handleReveal = useCallback(() => {
    if (!puzzle) return;
    const goldPositions = puzzle.goldRows
      .join("")
      .toUpperCase()
      .split("")
      .map((letter, id) => ({ id, letter }));
    if (!puzzle.demo && !puzzle.forceSolved) {
      const r: Result = { moves, bonus: false, completedAt: Date.now(), revealed: true };
      writeResult(puzzle.num, r);
      clearProgress(puzzle.num);
      setStoredResult(r);
    }
    setSolvedAt(moves);
    setBonusAt(moves);
    setPositions(goldPositions);
    setSelectedIdx(null);
    setConfirmReveal(false);
  }, [puzzle, moves]);

  const handleTap = useCallback(
    (idx: number) => {
      setDemoPlaying(false);
      if (selectedIdx === null) return setSelectedIdx(idx);
      if (selectedIdx === idx) return setSelectedIdx(null);
      setPositions((p) => {
        const next = swapAt(p, selectedIdx, idx);
        if (puzzle && !puzzle.demo && !puzzle.forceSolved) {
          writeProgress(puzzle.num, { positions: next, moves: moves + 1 });
        }
        return next;
      });
      setMoves((n) => n + 1);
      setSelectedIdx(null);
    },
    [selectedIdx, puzzle, moves]
  );

  const gridPx = TILE * N + GAP * (N - 1);

  if (!mounted || !puzzle) {
    return (
      <div className="flex flex-col items-center select-none">
        <div className="mb-6 text-center h-[60px]" />
        <div className="rounded-md" style={{ width: gridPx, height: gridPx, background: "var(--color-cream)" }} />
      </div>
    );
  }

  const positionByTileId = new Map<number, number>();
  positions.forEach((t, idx) => positionByTileId.set(t.id, idx));
  const selectedTileId = selectedIdx !== null ? positions[selectedIdx].id : null;

  // Per-tile "letter belongs to this row's gold solution" hint, multiset-aware.
  // Prefer actual home tiles so duplicate letters don't get spuriously hinted.
  const homeHintByIdx = new Array<boolean>(positions.length).fill(false);
  for (let r = 0; r < N; r++) {
    const remaining = new Map<string, number>();
    for (const ch of puzzle.goldRows[r].toUpperCase()) {
      remaining.set(ch, (remaining.get(ch) ?? 0) + 1);
    }
    const order = [0, 1, 2, 3]
      .map((c) => r * N + c)
      .sort((a, b) => {
        const aHome = Math.floor(positions[a].id / N) === r ? 0 : 1;
        const bHome = Math.floor(positions[b].id / N) === r ? 0 : 1;
        return aHome - bHome;
      });
    for (const idx of order) {
      const ch = positions[idx].letter;
      const left = remaining.get(ch) ?? 0;
      if (left > 0) {
        homeHintByIdx[idx] = true;
        remaining.set(ch, left - 1);
      }
    }
  }

  const liveStreak = visibleCurrent(streak, puzzle.num);
  const isRevealed = storedResult?.revealed === true;
  const shareSrc = isRevealed
    ? { moves: storedResult!.moves, revealed: true }
    : validity.isSolved
    ? { moves, revealed: false }
    : storedResult
    ? { moves: storedResult.moves, revealed: false }
    : null;
  const canShare = shareSrc !== null;
  const shareString = shareSrc
    ? buildShareString({
        puzzleNumber: puzzle.num,
        moves: shareSrc.moves,
        streak: liveStreak,
        revealed: shareSrc.revealed,
      })
    : "";

  const onShare = async () => {
    if (!shareString) return;
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ text: shareString });
        return;
      } catch {
        // user cancelled or share failed; fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(shareString);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  const closeHowTo = () => {
    markHowToSeen();
    setHowToOpen(false);
  };

  const openHelp = (tab: "how" | "words") => {
    setHelpTab(tab);
    setHowToOpen(true);
  };

  const finished = validity.isSolved || isRevealed;

  return (
    <div className="flex flex-col items-center select-none">
      <HowToPlay
        open={howToOpen}
        onClose={closeHowTo}
        goldRows={puzzle.goldRows}
        showWordsTab={finished}
        initialTab={helpTab}
        hideHints={hideHints}
        onHideHintsChange={updateHideHints}
      />
      <HistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} streak={streak} epoch={EPOCH} />
      <RevealConfirm open={confirmReveal} onClose={() => setConfirmReveal(false)} onConfirm={handleReveal} />
      <div className="mb-6 text-center">
        <p className="text-[var(--text-kicker)] uppercase tracking-[var(--tracking-kicker)] text-[color:var(--color-muted)]">
          {puzzle.demo ? "Tessera · puzzle" : `Tessera · #${puzzle.num} · ${puzzle.date}`}
        </p>
        <p className="text-base mt-2">
          {isRevealed ? (
            <span className="font-medium text-[color:var(--color-muted)]">Revealed</span>
          ) : storedResult ? (
            <SolvedStatus moves={storedResult.moves} />
          ) : validity.isSolved && puzzle.forceSolved ? (
            <span className="font-medium">Solved</span>
          ) : validity.isSolved && solvedAt !== null ? (
            <SolvedStatus moves={solvedAt} />
          ) : (
            <span className="text-[color:var(--color-muted)]">
              Moves {moves} · {validity.validRowCount}/{N} rows
            </span>
          )}
        </p>
      </div>

      <div className="relative" style={{ width: gridPx, height: gridPx }}>
        {[...positions]
          .map((t) => ({ tile: t, idx: positionByTileId.get(t.id)! }))
          .sort((a, b) => a.tile.id - b.tile.id)
          .map(({ tile, idx }) => {
            const r = Math.floor(idx / N);
            const c = idx % N;
            const rv = validity.rowValid[r];
            const cv = validity.colValid[c];
            const isSelected = selectedTileId === tile.id;
            return (
              <motion.button
                key={tile.id}
                animate={{
                  x: c * (TILE + GAP),
                  y: r * (TILE + GAP),
                  scale: isSelected ? 1.04 : 1,
                }}
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
                onClick={() => handleTap(idx)}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: TILE,
                  height: TILE,
                  zIndex: isSelected ? 10 : 1,
                }}
                className={`flex items-center justify-center rounded-md text-3xl font-medium touch-manipulation transition-[background-color,color,border-color] duration-200 ${tileClasses(
                  rv,
                  validity.isSolved,
                  !hideHints && homeHintByIdx[idx]
                )} ${isSelected ? "ring-2 ring-[color:var(--color-ink)]" : ""}`}
              >
                {tile.letter}
              </motion.button>
            );
          })}
        {demoPlaying && positions.length >= 2 && (
          <DemoHint
            key={idleTick}
            tileSize={TILE}
            gap={GAP}
            fromIdx={0}
            toIdx={1}
            fromLetter={positions[0].letter}
            toLetter={positions[1].letter}
            onDone={() => {
              setDemoPlaying(false);
              setIdleTick((n) => n + 1);
            }}
          />
        )}
      </div>

      <div className="mt-8 flex flex-col items-center gap-4">
        {canShare && (
          <button
            onClick={onShare}
            className="px-5 py-2 text-sm border border-[color:var(--color-rule)] rounded-md hover:bg-[color:var(--color-cream)] transition-colors"
          >
            {copied ? "Copied" : "Share"}
          </button>
        )}
        {!validity.isSolved && !storedResult && (
          <button
            onClick={() => setConfirmReveal(true)}
            className="px-3 py-1.5 text-xs text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)] transition-colors"
          >
            Reveal solution
          </button>
        )}
        {finished && (
          <p className="text-xs text-[color:var(--color-muted)]">Next puzzle in {countdown}</p>
        )}

        <div className="mt-2 flex items-center gap-4 text-xs text-[color:var(--color-muted)]">
          {!hideHints && <Legend variant="hint">correct row</Legend>}
          <Legend variant="row">correct word</Legend>
          <Legend variant="bonus">puzzle complete</Legend>
        </div>

        <div className="mt-2 flex items-center gap-3 text-[color:var(--color-muted)]">
          <button
            onClick={() => openHelp("how")}
            aria-label="How to play"
            className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-[color:var(--color-rule)] text-xs hover:bg-[color:var(--color-cream)] hover:text-[color:var(--color-ink)] transition-colors"
          >
            ?
          </button>
          <button
            onClick={() => setHistoryOpen(true)}
            aria-label="History"
            className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-[color:var(--color-rule)] hover:bg-[color:var(--color-cream)] hover:text-[color:var(--color-ink)] transition-colors"
          >
            <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="6" cy="6" r="4.5" />
              <path d="M6 3.2v3l1.8 1.1" />
            </svg>
          </button>
          {liveStreak > 0 && (
            <span className="text-xs tabular-nums">
              🔥 {liveStreak}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function DemoHint({
  tileSize,
  gap,
  fromIdx,
  toIdx,
  fromLetter,
  toLetter,
  onDone,
}: {
  tileSize: number;
  gap: number;
  fromIdx: number;
  toIdx: number;
  fromLetter: string;
  toLetter: string;
  onDone: () => void;
}) {
  const pos = (idx: number) => {
    const r = Math.floor(idx / N);
    const c = idx % N;
    return { x: c * (tileSize + gap), y: r * (tileSize + gap) };
  };
  const a = pos(fromIdx);
  const b = pos(toIdx);
  // Cursor sits slightly inside the tile centre so the pointer tip lands on
  // the tile rather than its corner.
  const cox = tileSize / 2 - 4;
  const coy = tileSize / 2 - 2;
  const D = 2.6;
  // 7 keyframes to cover: idle | tap-A (ring on) | hold | swap | held-swapped | swap-back | fade
  const ghostTimes = [0, 0.08, 0.3, 0.45, 0.65, 0.85, 1];
  const ringOff = "0 0 0 0px rgba(10,10,10,0)";
  const ringOn = "0 0 0 2px rgba(10,10,10,1)";

  return (
    <>
      {/* Ghost A: covers tile A. Selection ring lights up while the faux
         cursor is tapping it; clears the moment the swap fires. */}
      <motion.div
        initial={{ x: a.x, y: a.y, opacity: 1, scale: 1, boxShadow: ringOff }}
        animate={{
          x: [a.x, a.x, a.x, b.x, b.x, a.x, a.x],
          y: [a.y, a.y, a.y, b.y, b.y, a.y, a.y],
          opacity: [1, 1, 1, 1, 1, 1, 0],
          scale: [1, 1.04, 1.04, 1, 1, 1, 1],
          boxShadow: [ringOff, ringOn, ringOn, ringOff, ringOff, ringOff, ringOff],
        }}
        transition={{ duration: D, times: ghostTimes, ease: "easeInOut" }}
        style={{ position: "absolute", top: 0, left: 0, width: tileSize, height: tileSize, pointerEvents: "none", zIndex: 5 }}
        className="flex items-center justify-center rounded-md text-3xl font-medium bg-[color:var(--color-cream)] text-[color:var(--color-ink)] border border-[color:var(--color-rule)]"
      >
        {fromLetter}
      </motion.div>
      {/* Ghost B: mirror swap path. No persistent ring — in the real
         interaction the second tap fires the swap immediately. */}
      <motion.div
        initial={{ x: b.x, y: b.y, opacity: 1 }}
        animate={{
          x: [b.x, b.x, b.x, a.x, a.x, b.x, b.x],
          y: [b.y, b.y, b.y, a.y, a.y, b.y, b.y],
          opacity: [1, 1, 1, 1, 1, 1, 0],
        }}
        transition={{ duration: D, times: ghostTimes, ease: "easeInOut" }}
        style={{ position: "absolute", top: 0, left: 0, width: tileSize, height: tileSize, pointerEvents: "none", zIndex: 5 }}
        className="flex items-center justify-center rounded-md text-3xl font-medium bg-[color:var(--color-cream)] text-[color:var(--color-ink)] border border-[color:var(--color-rule)]"
      >
        {toLetter}
      </motion.div>
      {/* Faux cursor: taps A, moves to B, taps, fades. */}
      <motion.div
        initial={{ x: a.x + cox, y: a.y + coy, opacity: 0 }}
        animate={{
          x: [a.x + cox, a.x + cox, a.x + cox, b.x + cox, b.x + cox, b.x + cox],
          y: [a.y + coy, a.y + coy, a.y + coy, b.y + coy, b.y + coy, b.y + coy],
          opacity: [0, 1, 1, 1, 1, 0],
        }}
        transition={{ duration: D, times: [0, 0.06, 0.3, 0.42, 0.7, 0.85], ease: "easeInOut" }}
        onAnimationComplete={onDone}
        style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", zIndex: 10 }}
      >
        <svg viewBox="0 0 18 18" width="20" height="20" fill="var(--color-ink)" stroke="var(--color-paper)" strokeWidth="1.2" strokeLinejoin="round">
          <path d="M3 2 L3 14 L6.5 10.8 L9 16 L11.5 14.8 L9 9.5 L13.5 9.5 Z" />
        </svg>
      </motion.div>
    </>
  );
}

function Legend({ children, variant }: { children: React.ReactNode; variant: "row" | "bonus" | "hint" }) {
  if (variant === "hint") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span
          className="inline-block w-3 h-3 rounded-sm"
          style={{ background: "var(--color-cream)", outline: "2px dashed #3d5a32", outlineOffset: "-3px" }}
        />
        {children}
      </span>
    );
  }
  const bg = variant === "bonus" ? "#d9b25a" : "#7a9070";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block w-3 h-3 rounded-sm" style={{ background: bg }} />
      {children}
    </span>
  );
}

function tileClasses(rowValid: boolean, puzzleSolved: boolean, homeHint: boolean): string {
  if (puzzleSolved) return "bg-[#d9b25a] text-[color:var(--color-ink)]";
  if (rowValid) return "bg-[#7a9070] text-[color:var(--color-paper)]";
  if (homeHint) return "bg-[color:var(--color-cream)] text-[color:var(--color-ink)] border border-[color:var(--color-rule)] outline-2 outline-dashed outline-[#3d5a32] -outline-offset-[3px]";
  return "bg-[color:var(--color-cream)] text-[color:var(--color-ink)] border border-[color:var(--color-rule)]";
}

function SolvedStatus({ moves }: { moves: number }) {
  const tier = getTier(moves);
  return (
    <span className="font-medium">
      Solved in {moves} {moves === 1 ? "move" : "moves"} · {tier.name}
    </span>
  );
}

function RevealConfirm({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[color:var(--color-ink)]/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm bg-[color:var(--color-paper)] border border-[color:var(--color-rule)] rounded-lg p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[var(--text-kicker)] uppercase tracking-[var(--tracking-kicker)] text-[color:var(--color-muted)]">
          Reveal solution
        </p>
        <h2 className="text-xl font-light tracking-tight mt-1">Give up for today?</h2>
        <p className="text-sm mt-3 text-[color:var(--color-ink-soft)]">
          The board will snap to the solved grid. Today won&rsquo;t count toward your streak (your current streak stays as it is).
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-[color:var(--color-rule)] rounded-md hover:bg-[color:var(--color-cream)] transition-colors"
          >
            Keep trying
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm bg-[color:var(--color-ink)] text-[color:var(--color-paper)] rounded-md hover:opacity-90 transition-opacity"
          >
            Reveal
          </button>
        </div>
      </div>
    </div>
  );
}

