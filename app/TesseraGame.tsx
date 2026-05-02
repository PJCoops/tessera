"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { DEMO_GRID, generateDailyPuzzle, scrambleGoldRows, tilesFromRows, type Tile } from "./lib/puzzle";
import { puzzleNumber, seedFromDate, todayUtc } from "./lib/rng";
import { readStreak, recordWin, visibleCurrent, type Streak } from "./lib/streak";
import { buildShareString } from "./lib/share";
import { getTier } from "./lib/tier";
import { HowToPlay, hasSeenHowTo, markHowToSeen } from "./HowToPlay";
import { HistoryModal } from "./HistoryModal";
import { EmailSignup } from "./EmailSignup";
import { track } from "./lib/analytics";

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
const MUTED_KEY = "tessera:muted";

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
  const [demoSelected, setDemoSelected] = useState<number | null>(null);
  const [demoTap, setDemoTap] = useState<{ idx: number; key: number } | null>(null);
  // Position of the synthetic cursor follower used in ?demo mode for cleaner
  // screen recordings. Null until the mouse first moves.
  const [demoCursor, setDemoCursor] = useState<{ x: number; y: number; down: boolean } | null>(null);
  const [hideHints, setHideHints] = useState(true);
  const [muted, setMuted] = useState(true);

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
    if (!isolated && !stored && !progress) {
      track("puzzle_started", { num, day: date });
    }
    if (!demo) pruneOldProgress(num);
    if (!hasSeenHowTo()) setHowToOpen(true);
    try {
      const hh = window.localStorage.getItem(HIDE_HINTS_KEY);
      if (hh !== null) setHideHints(hh === "1");
      const m = window.localStorage.getItem(MUTED_KEY);
      if (m !== null) setMuted(m === "1");
    } catch {}
    setMounted(true);
  }, []);

  const updateHideHints = useCallback((v: boolean) => {
    setHideHints(v);
    try {
      window.localStorage.setItem(HIDE_HINTS_KEY, v ? "1" : "0");
    } catch {}
    track("hide_hints_toggled", { enabled: v });
  }, []);

  const updateMuted = useCallback((v: boolean) => {
    setMuted(v);
    try {
      window.localStorage.setItem(MUTED_KEY, v ? "1" : "0");
    } catch {}
    track("muted_toggled", { enabled: v });
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
        const s = recordWin(puzzle.num);
        setStreak(s);
        track("puzzle_solved", {
          num: puzzle.num,
          moves,
          bonus: validity.isBonus,
          streak: s.current,
        });
      }
    }
    if (validity.isBonus && bonusAt === null) setBonusAt(moves);
  }, [validity.isSolved, validity.isBonus, moves, solvedAt, bonusAt, puzzle, storedResult]);

  // Play the win jingle once when the puzzle solves this session. Only fires
  // on a fresh solve (solvedAt was just set this render) — never on a stored
  // result from yesterday or on a forced reveal-as-solve, since those don't
  // earn the celebration.
  useEffect(() => {
    if (!validity.isSolved) return;
    if (solvedAt === null) return;
    if (storedResult?.revealed) return;
    if (muted) return;
    const audio = new Audio("/win.mp3");
    audio.volume = 0.25;
    audio.play().catch(() => {
      // Browsers may reject playback without a recent user gesture; the
      // solve itself is one, but be defensive — never throw.
    });
  }, [validity.isSolved, solvedAt, storedResult, muted]);

  // ?demo mode: hide the OS cursor and render a small grey follower dot
  // instead. Makes screen recordings look intentional rather than showing the
  // operating-system pointer.
  useEffect(() => {
    if (!puzzle?.demo) return;
    const onMove = (e: MouseEvent) => {
      setDemoCursor((prev) => ({ x: e.clientX, y: e.clientY, down: prev?.down ?? false }));
    };
    const onDown = () => setDemoCursor((prev) => (prev ? { ...prev, down: true } : prev));
    const onUp = () => setDemoCursor((prev) => (prev ? { ...prev, down: false } : prev));
    const onLeave = () => setDemoCursor(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    document.addEventListener("mouseleave", onLeave);
    document.documentElement.classList.add("demo-cursor-hide");
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      document.removeEventListener("mouseleave", onLeave);
      document.documentElement.classList.remove("demo-cursor-hide");
    };
  }, [puzzle?.demo]);

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

  // When demoPlaying flips true, run the sequence: tap A (ripple + ring),
  // tap B (ripple), real swap, hold, real revert. Positions are snapshotted
  // so cancellation always restores. This uses the actual setPositions path
  // so the swap animation matches a real player swap exactly — same spring
  // physics, same ring, same scale.
  useEffect(() => {
    if (!demoPlaying || !puzzle) return;
    const snapshot = positions;
    const [a, b] = pickDemoSwap(snapshot, puzzle.goldRows);
    let cancelled = false;
    let key = 0;
    const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

    const run = async () => {
      // Tap A — ripple + selection ring
      setDemoTap({ idx: a, key: ++key });
      setDemoSelected(a);
      await wait(550);
      if (cancelled) return;

      // Tap B — ripple, then swap fires (mirrors real interaction lag)
      setDemoTap({ idx: b, key: ++key });
      await wait(180);
      if (cancelled) return;
      setDemoSelected(null);
      setPositions(swapAt(snapshot, a, b));

      // Hold the swapped state long enough to register
      await wait(900);
      if (cancelled) return;
      setPositions(snapshot);

      await wait(450);
      if (cancelled) return;
      setDemoTap(null);
      setDemoPlaying(false);
      setIdleTick((n) => n + 1);
    };
    run();

    return () => {
      cancelled = true;
      setDemoSelected(null);
      setDemoTap(null);
      setPositions(snapshot);
    };
    // positions intentionally excluded — we snapshot once at demo start.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoPlaying, puzzle]);

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
      track("puzzle_revealed", { num: puzzle.num, moves });
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
      setDemoSelected(null);
      setDemoTap(null);
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
  const demoSelectedTileId =
    demoSelected !== null ? positions[demoSelected]?.id ?? null : null;

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
    ? { moves: storedResult!.moves, bonus: false, revealed: true }
    : validity.isSolved
    ? { moves, bonus: validity.isBonus, revealed: false }
    : storedResult
    ? { moves: storedResult.moves, bonus: storedResult.bonus, revealed: false }
    : null;
  const canShare = shareSrc !== null;
  const shareString = shareSrc
    ? buildShareString({
        puzzleNumber: puzzle.num,
        moves: shareSrc.moves,
        streak: liveStreak,
        bonus: shareSrc.bonus,
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
      {puzzle.demo && demoCursor && (
        <div
          className="pointer-events-none fixed rounded-full"
          style={{
            left: demoCursor.x - 11,
            top: demoCursor.y - 11,
            width: 22,
            height: 22,
            background: demoCursor.down ? "rgba(60,60,60,0.55)" : "rgba(120,120,120,0.45)",
            border: "1px solid rgba(255,255,255,0.6)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
            zIndex: 9999,
            transform: demoCursor.down ? "scale(0.85)" : "scale(1)",
            transition: "transform 80ms ease-out, background 80ms ease-out",
          }}
        />
      )}
      <HowToPlay
        open={howToOpen}
        onClose={closeHowTo}
        goldRows={puzzle.goldRows}
        showWordsTab={finished}
        initialTab={helpTab}
        hideHints={hideHints}
        onHideHintsChange={updateHideHints}
        muted={muted}
        onMutedChange={updateMuted}
      />
      <HistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} streak={streak} epoch={EPOCH} />
      <RevealConfirm open={confirmReveal} onClose={() => setConfirmReveal(false)} onConfirm={handleReveal} />
      <div className="mb-6 text-center">
        <p className="text-[var(--text-kicker)] uppercase tracking-[var(--tracking-kicker)] text-[color:var(--color-muted)]">
          {puzzle.demo ? "Tessera · puzzle" : `Tessera · #${puzzle.num} · ${puzzle.date}`}
        </p>
        <div className="text-base mt-2 h-10 overflow-hidden flex items-center justify-center px-4 max-w-md mx-auto">
          <AnimatePresence mode="wait" initial={false}>
            {(() => {
              // Roll transition between status messages. Demo tip preempts
              // the moves counter while a demo is playing, then rolls back.
              const rollProps = {
                initial: { y: 14, opacity: 0 },
                animate: { y: 0, opacity: 1 },
                exit: { y: -14, opacity: 0 },
                transition: { duration: 0.25, ease: "easeOut" as const },
              };
              if (isRevealed) {
                return (
                  <motion.span key="revealed" {...rollProps} className="block font-medium text-[color:var(--color-muted)]">
                    Revealed
                  </motion.span>
                );
              }
              if (storedResult) {
                return (
                  <motion.span key="stored" {...rollProps} className="block">
                    <SolvedStatus moves={storedResult.moves} />
                  </motion.span>
                );
              }
              if (validity.isSolved && puzzle.forceSolved) {
                return (
                  <motion.span key="forcesolved" {...rollProps} className="block font-medium">
                    Solved
                  </motion.span>
                );
              }
              if (validity.isSolved && solvedAt !== null) {
                return (
                  <motion.span key="solvedat" {...rollProps} className="block">
                    <SolvedStatus moves={solvedAt} />
                  </motion.span>
                );
              }
              if (demoPlaying) {
                return (
                  <motion.span key="demo" {...rollProps} className="block text-sm leading-snug text-[color:var(--color-muted)] text-center">
                    Tap two tiles to swap them
                    <br />
                    to make a grid of 4 letter words
                  </motion.span>
                );
              }
              return (
                <motion.span key="moves" {...rollProps} className="block text-[color:var(--color-muted)]">
                  Moves {moves} · {validity.validRowCount}/{N} rows
                </motion.span>
              );
            })()}
          </AnimatePresence>
        </div>
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
            const isSelected = selectedTileId === tile.id || demoSelectedTileId === tile.id;
            return (
              <motion.button
                key={tile.id}
                animate={{
                  x: c * (TILE + GAP),
                  y: r * (TILE + GAP),
                  // Solved cascade: each tile bounces + wobbles in reading
                  // order (top-left to bottom-right) with a 70 ms stagger.
                  scale: validity.isSolved ? [1, 1.1, 1] : isSelected ? 1.04 : 1,
                  rotate: validity.isSolved ? [0, -3, 3, 0] : 0,
                  // Drive bg/text via framer when solved so we can stagger;
                  // otherwise leave undefined so the Tailwind class wins.
                  backgroundColor: validity.isSolved ? "#d9b25a" : undefined,
                  color: validity.isSolved ? "#0a0a0a" : undefined,
                }}
                transition={{
                  type: "spring",
                  stiffness: 500,
                  damping: 35,
                  scale: validity.isSolved
                    ? { duration: 0.5, delay: idx * 0.07, ease: "easeOut" }
                    : isSelected
                    ? { type: "spring", stiffness: 500, damping: 35 }
                    : { duration: 0.15 },
                  rotate: validity.isSolved
                    ? { duration: 0.5, delay: idx * 0.07, ease: "easeOut" }
                    : { duration: 0.15 },
                  backgroundColor: validity.isSolved
                    ? { duration: 0.25, delay: idx * 0.07 + 0.1 }
                    : { duration: 0.2 },
                  color: validity.isSolved
                    ? { duration: 0.25, delay: idx * 0.07 + 0.1 }
                    : { duration: 0.2 },
                }}
                onClick={() => handleTap(idx)}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: TILE,
                  height: TILE,
                  zIndex: isSelected ? 10 : 1,
                }}
                className={`flex items-center justify-center rounded-md text-3xl font-medium touch-manipulation ${tileClasses(
                  rv,
                  !hideHints && homeHintByIdx[idx]
                )} ${isSelected ? "ring-2 ring-[color:var(--color-ink)]" : ""}`}
              >
                {tile.letter}
              </motion.button>
            );
          })}
        {demoTap && (
          <TapRipple key={demoTap.key} idx={demoTap.idx} tileSize={TILE} gap={GAP} />
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
        {finished && (
          <div className="mt-2 w-full max-w-xs">
            <EmailSignup source={isRevealed ? "revealed" : "solved"} />
          </div>
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

// Touch-style ripple at a tile's centre. Expands from a dot to fill the
// tile area while fading out — the same metaphor as Material's tap ripple,
// readable on both touch and mouse.
function TapRipple({ idx, tileSize, gap }: { idx: number; tileSize: number; gap: number }) {
  const r = Math.floor(idx / N);
  const c = idx % N;
  const x = c * (tileSize + gap);
  const y = r * (tileSize + gap);
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0.55 }}
      animate={{ scale: 1, opacity: 0 }}
      transition={{ duration: 0.55, ease: "easeOut" }}
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: tileSize,
        height: tileSize,
        borderRadius: "50%",
        background: "var(--color-ink)",
        pointerEvents: "none",
        zIndex: 20,
        transformOrigin: "center",
      }}
    />
  );
}

// Pick a swap pair for the demo that won't accidentally validate a row
// (which would flash a fake "you got one!" on screen). Falls back to [0,1]
// if every candidate is risky.
function pickDemoSwap(positions: Tile[], goldRows: string[]): [number, number] {
  const candidates: [number, number][] = [
    [0, 1], [1, 2], [2, 3],
    [4, 5], [5, 6], [6, 7],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  const upper = goldRows.map((r) => r.toUpperCase());
  const validRows = (p: Tile[]) =>
    [0, 1, 2, 3].filter(
      (r) => Array.from({ length: N }, (_, c) => p[r * N + c].letter).join("") === upper[r]
    ).length;
  const before = validRows(positions);
  for (const [a, b] of candidates) {
    if (a >= positions.length || b >= positions.length) continue;
    const after = validRows(swapAt(positions, a, b));
    if (after <= before) return [a, b];
  }
  return [0, 1];
}

function Legend({ children, variant }: { children: React.ReactNode; variant: "row" | "bonus" | "hint" }) {
  // Mini tiles, styled to match the real grid 1:1 so the legend swatch is
  // visually identical to what you're looking for on the board.
  const isHint = variant === "hint";
  const bg = isHint ? "var(--color-cream)" : variant === "bonus" ? "#d9b25a" : "#7a9070";
  const color = variant === "row" ? "var(--color-paper)" : "var(--color-ink)";
  const letter = isHint ? "A" : variant === "row" ? "B" : "C";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-flex items-center justify-center w-5 h-5 rounded-[3px] text-[11px] font-medium leading-none"
        style={{
          background: bg,
          color,
          outline: isHint ? "2px dashed #3d5a32" : undefined,
          outlineOffset: isHint ? "-3px" : undefined,
        }}
      >
        {letter}
      </span>
      {children}
    </span>
  );
}

function tileClasses(rowValid: boolean, homeHint: boolean): string {
  // The solved (gold) state is driven by framer's animate prop so the cascade
  // can stagger per tile — see the motion.button in the grid render.
  if (rowValid) return "bg-[#7a9070] text-[color:var(--color-paper)]";
  if (homeHint) return "bg-[color:var(--color-cream)] text-[color:var(--color-ink)] outline-2 outline-dashed outline-[#3d5a32] -outline-offset-[3px]";
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

