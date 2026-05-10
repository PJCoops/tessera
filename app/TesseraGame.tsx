"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { DEMO_GRID, computeMinSwaps, generateDailyPuzzleFor, scrambleGoldRows, tilesFromRows, type Tile } from "./lib/puzzle";
import { seedFromDate, todayUtc } from "./lib/rng";
import { EPOCH } from "./lib/epoch";
import { resolvePuzzleFromParams } from "./lib/replay";
import { readStreak, recordWin, visibleCurrent, type Streak } from "./lib/streak";
import { buildSharePayload } from "./lib/share";
import { getTier } from "./lib/tier";
import { dominantTier } from "./lib/dominant-tier";
import { CLASSIC, HARD, homePath, type ModeConfig } from "./lib/mode";
import { HowToPlay, hasSeenHowTo, markHowToSeen } from "./HowToPlay";
import { HistoryModal } from "./HistoryModal";
import { EmailSignup } from "./EmailSignup";
import { track } from "./lib/analytics";
import { useLocale } from "./lib/locale-context";

// Tile sizing is responsive: pick the largest size that fits the
// available container width, then clamp. The same formula serves both
// 4×4 and 5×5 — 4×4 just lands on a larger tile within the same width.
const GAP = 6;
const MAX_TILE = 72;
const MIN_TILE = 48;
const MAX_GRID_WIDTH = 480;
function tileSizeFor(N: number, availableWidth: number): number {
  // Fall back to MAX_TILE if the container hasn't been measured yet
  // (SSR, or headless preview where innerWidth is 0). The grid will
  // re-measure on mount via ResizeObserver and adjust if needed.
  if (!availableWidth || availableWidth <= 0) return MAX_TILE;
  const available = Math.min(MAX_GRID_WIDTH, availableWidth);
  const raw = Math.floor((available - GAP * (N - 1)) / N);
  return Math.max(MIN_TILE, Math.min(MAX_TILE, raw));
}

type Result = { moves: number; bonus: boolean; completedAt: number; revealed?: boolean };

function rowLetters(positions: Tile[], r: number, N: number): string[] {
  return Array.from({ length: N }, (_, c) => positions[r * N + c].letter);
}
function colLetters(positions: Tile[], c: number, N: number): string[] {
  return Array.from({ length: N }, (_, r) => positions[r * N + c].letter);
}
function swapAt(p: Tile[], a: number, b: number): Tile[] {
  const next = p.slice();
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

const HIDE_HINTS_KEY = "tessera:hide-hints";
const MUTED_KEY = "tessera:muted";
const THEME_KEY = "tessera:theme";
const DEMO_PLAYED_KEY = "tessera:demo-played";

// True if this device has any prior puzzle result for this mode. Used to
// skip the idle-swap animation for returning players — they know the
// mechanic. Scoped per-mode so a 4×4 veteran still sees the demo on first
// /hard load.
function hasAnyResult(resultPrefix: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(resultPrefix)) return true;
    }
    return false;
  } catch {
    return false;
  }
}
function countResults(resultPrefix: string): number {
  if (typeof window === "undefined") return 0;
  try {
    let n = 0;
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(resultPrefix)) n += 1;
    }
    return n;
  } catch {
    return 0;
  }
}
function hasPlayedDemo(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DEMO_PLAYED_KEY) === "1";
  } catch {
    return false;
  }
}
function markDemoPlayed() {
  try {
    window.localStorage.setItem(DEMO_PLAYED_KEY, "1");
  } catch {}
}

export type ThemePref = "system" | "light" | "dark";
function isThemePref(v: unknown): v is ThemePref {
  return v === "system" || v === "light" || v === "dark";
}
function applyTheme(t: ThemePref) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  if (t !== "system") root.classList.add(t);
}

type Progress = { positions: Tile[]; moves: number };

function readResult(num: number, prefix: string): Result | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(prefix + num);
    return raw ? (JSON.parse(raw) as Result) : null;
  } catch {
    return null;
  }
}
function writeResult(num: number, r: Result, prefix: string) {
  try {
    window.localStorage.setItem(prefix + num, JSON.stringify(r));
  } catch {}
}
function readProgress(num: number, prefix: string): Progress | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(prefix + num);
    return raw ? (JSON.parse(raw) as Progress) : null;
  } catch {
    return null;
  }
}
function writeProgress(num: number, p: Progress, prefix: string) {
  try {
    window.localStorage.setItem(prefix + num, JSON.stringify(p));
  } catch {}
}
function clearProgress(num: number, prefix: string) {
  try {
    window.localStorage.removeItem(prefix + num);
  } catch {}
}
// Drop progress entries for any puzzle other than today's. Players abandon
// puzzles often — without this, those keys accumulate forever.
function pruneOldProgress(currentNum: number, prefix: string) {
  if (typeof window === "undefined") return;
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(prefix)) continue;
      const num = Number(key.slice(prefix.length));
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

export function TesseraGame({ mode = CLASSIC }: { mode?: ModeConfig } = {}) {
  const { locale, dict, t } = useLocale();
  const N = mode.N;
  const [mounted, setMounted] = useState(false);
  // Initial TILE matches the SSR-safe value (MAX_TILE) on both server
  // and first client paint, then updates to the measured size after
  // mount. Picking the actual viewport size on first client render
  // would cause a hydration mismatch with the SSR markup.
  const [tileSize, setTileSize] = useState<number>(MAX_TILE);
  const sizingRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const measure = () => {
      // Inner content width of the parent container (excludes its own
      // px-4 padding). Falls back to documentElement width for headless
      // previews where ResizeObserver may report 0 before layout.
      const el = sizingRef.current;
      const cs = el ? window.getComputedStyle(el) : null;
      const padX = cs ? parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) : 0;
      const w =
        (el?.getBoundingClientRect().width ?? 0) - padX ||
        document.documentElement.clientWidth ||
        0;
      setTileSize(tileSizeFor(N, w));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (sizingRef.current) ro.observe(sizingRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [N]);

  const TILE = tileSize;
  const [puzzle, setPuzzle] = useState<{
    num: number;
    date: string;
    startTiles: Tile[];
    goldRows: string[];
    minSwaps: number;
    forceSolved: boolean;
    demo: boolean;
    replay: boolean;
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
  const [demoSelected, setDemoSelected] = useState<number | null>(null);
  const [demoTap, setDemoTap] = useState<{ idx: number; key: number } | null>(null);
  // Rotates the demo candidate each cycle so a stalled player sees a
  // different pair on every replay. Survives renders without triggering them.
  const demoOffsetRef = useRef(0);
  // Position of the synthetic cursor follower used in ?demo mode for cleaner
  // screen recordings. Null until the mouse first moves.
  const [demoCursor, setDemoCursor] = useState<{ x: number; y: number; down: boolean } | null>(null);
  const [streakToast, setStreakToast] = useState<string | null>(null);
  // Legend strip is hidden for experienced players. Threshold is "two
  // or more solves in this mode" — after the second solve the player
  // has the language internalised and the strip is just visual noise.
  // Replays don't count: the read happens once on mount against the
  // mode's result prefix.
  const [showLegend, setShowLegend] = useState(true);
  const [hideHints, setHideHints] = useState(false);
  const [muted, setMuted] = useState(true);
  const [theme, setTheme] = useState<ThemePref>("system");

  // Initialise on client mount (avoids SSR/UTC drift hydration mismatch).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const today = todayUtc();
    const resolved = resolvePuzzleFromParams(params, today, EPOCH);
    const { date, num, replay } = resolved;
    const seed = seedFromDate(date);
    const forceSolved = params.get("solve") !== null;
    const demo = params.get("demo") !== null;

    let goldRows: string[];
    let startTiles: Tile[];
    let minSwaps: number;
    // Demo mode is classic-only — DEMO_GRID is a 4×4 grid. On hard mode
    // the demo flag is treated as a no-op and we render the daily.
    const useDemo = demo && N === 4;
    if (useDemo) {
      goldRows = [...DEMO_GRID];
      startTiles = forceSolved ? tilesFromRows(goldRows) : scrambleGoldRows(goldRows, 42);
      minSwaps = forceSolved ? 0 : computeMinSwaps(startTiles, goldRows);
    } else {
      const generated = generateDailyPuzzleFor(locale, seed, mode.swaps, N);
      goldRows = generated.goldRows;
      startTiles = forceSolved ? tilesFromRows(goldRows) : generated.startTiles;
      minSwaps = forceSolved ? 0 : generated.minSwaps;
    }

    setPuzzle({ num, date, startTiles, goldRows, minSwaps, forceSolved, demo: useDemo, replay });

    // Demo, force-solved, and replay modes are isolated from real player
    // state — no stored result, no progress restore, no streak interaction,
    // and no progress writes on tap. Replay also skips analytics events
    // tied to the live daily flow (`puzzle_started`/`puzzle_solved` etc.).
    const isolated = useDemo || forceSolved || replay;
    const stored = isolated ? null : readResult(num, mode.resultPrefix);
    setStoredResult(stored);
    const streakNow = readStreak(mode.streakKey);
    setStreak(streakNow);
    const progress = !isolated && !stored ? readProgress(num, mode.progressPrefix) : null;
    if (progress) {
      setPositions(progress.positions);
      setMoves(progress.moves);
    } else {
      setPositions(startTiles);
    }
    if (!isolated && !stored && !progress) {
      track("puzzle_started", { num, day: date, mode: mode.id, N, minSwaps });
    }
    if (replay) {
      track("puzzle_replay_opened", { num, day: date, mode: mode.id, N, minSwaps });
    }
    // `pruneOldProgress(num)` would wipe today's saved progress while we're
    // replaying #5 — only run it on the live daily puzzle.
    if (!useDemo && !replay) pruneOldProgress(num, mode.progressPrefix);
    if (!hasSeenHowTo()) setHowToOpen(true);
    try {
      const hh = window.localStorage.getItem(HIDE_HINTS_KEY);
      if (hh !== null) {
        setHideHints(hh === "1");
      } else if (visibleCurrent(streakNow, num) >= 2) {
        // Players on a live 2+ streak don't need the dotted-tile hint —
        // hide it by default. They can flip it back on via the Show
        // hints button (which then writes an explicit pref so this
        // auto-hide doesn't fight a manual choice).
        setHideHints(true);
      }
      // Legend strip: once the player has logged two or more solves
      // for this mode, hide it. New players still get the swatch key.
      if (countResults(mode.resultPrefix) >= 2) {
        setShowLegend(false);
      }
      const m = window.localStorage.getItem(MUTED_KEY);
      if (m !== null) setMuted(m === "1");
      const t = window.localStorage.getItem(THEME_KEY);
      if (isThemePref(t)) setTheme(t);
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

  const updateTheme = useCallback((v: ThemePref) => {
    setTheme(v);
    try {
      window.localStorage.setItem(THEME_KEY, v);
    } catch {}
    applyTheme(v);
    track("theme_changed", { theme: v });
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
      (_, r) => rowLetters(positions, r, N).join("") === goldRowsUpper[r]
    );
    const colValid = Array.from({ length: N }, (_, c) => {
      const goldCol = goldRowsUpper.map((row) => row[c]).join("");
      return colLetters(positions, c, N).join("") === goldCol;
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
      // Track move count locally even in demo/replay so the status reads
      // "Solved in N moves" — those modes just skip the localStorage and
      // streak writes. Replay fires its own analytics event so we can
      // measure the feature without polluting the daily-solve funnel.
      setSolvedAt(moves);
      if (puzzle.replay) {
        track("puzzle_replayed", {
          num: puzzle.num,
          moves,
          bonus: validity.isBonus,
          mode: mode.id,
          N,
          minSwaps: puzzle.minSwaps,
        });
      } else if (!puzzle.demo) {
        const r: Result = { moves, bonus: validity.isBonus, completedAt: Date.now() };
        writeResult(puzzle.num, r, mode.resultPrefix);
        clearProgress(puzzle.num, mode.progressPrefix);
        setStoredResult(r);
        const s = recordWin(puzzle.num, mode.streakKey);
        setStreak(s);
        track("puzzle_solved", {
          num: puzzle.num,
          moves,
          bonus: validity.isBonus,
          streak: s.current,
          mode: mode.id,
          N,
          minSwaps: puzzle.minSwaps,
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
  // First-time players only: skip if they've played the demo before on this
  // device, or if they have any prior solve (returning players know the
  // mechanic). Hold the timer while the how-to modal is open — otherwise
  // first-launch consumes the 7s window and the demo never gets seen.
  useEffect(() => {
    if (!mounted || !puzzle) return;
    if (howToOpen) return;
    if (demoPlaying) return;
    if (moves > 0 || selectedIdx !== null) return;
    if (validity.isSolved || storedResult) return;
    if (hasPlayedDemo() || hasAnyResult(mode.resultPrefix)) return;
    // Idle-swap demo is built around a 4×4 candidate set. Skip on hard.
    if (mode.N !== 4) return;
    const id = setTimeout(() => {
      markDemoPlayed();
      setDemoPlaying(true);
    }, 7000);
    return () => clearTimeout(id);
  }, [mounted, puzzle, howToOpen, demoPlaying, moves, selectedIdx, validity.isSolved, storedResult, mode.N, mode.resultPrefix]);

  // When demoPlaying flips true, run the sequence: tap A (ripple + ring),
  // tap B (ripple), real swap, hold, real revert. Positions are snapshotted
  // so cancellation always restores. This uses the actual setPositions path
  // so the swap animation matches a real player swap exactly — same spring
  // physics, same ring, same scale.
  useEffect(() => {
    if (!demoPlaying || !puzzle) return;
    const snapshot = positions;
    const [a, b] = pickDemoSwap(snapshot, puzzle.goldRows, demoOffsetRef.current);
    demoOffsetRef.current += 1;
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
      await wait(1400);
      if (cancelled) return;
      setPositions(snapshot);

      await wait(450);
      if (cancelled) return;
      setDemoTap(null);
      setDemoPlaying(false);
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
    if (!puzzle.demo && !puzzle.forceSolved && !puzzle.replay) {
      const r: Result = { moves, bonus: false, completedAt: Date.now(), revealed: true };
      writeResult(puzzle.num, r, mode.resultPrefix);
      clearProgress(puzzle.num, mode.progressPrefix);
      setStoredResult(r);
      track("puzzle_revealed", {
        num: puzzle.num,
        moves,
        mode: mode.id,
        N,
        minSwaps: puzzle.minSwaps,
      });
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
        if (puzzle && !puzzle.demo && !puzzle.forceSolved && !puzzle.replay) {
          writeProgress(puzzle.num, { positions: next, moves: moves + 1 }, mode.progressPrefix);
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

  // Per-tile "this tile's letter belongs in this row" hint, multiset
  // aware. A tile in row r gets dotted iff its letter is still needed
  // in row r's gold solution (after accounting for tiles already on
  // their home row). This handles duplicate letters correctly — if
  // both row 0 and row 2 need an "A", an "A" tile from row 2 sitting
  // visually in row 0 is functionally as useful as the home tile and
  // should be dotted. The priority sort dots home tiles first so
  // duplicate letters credit the home instance before any spillover.
  const homeHintByIdx = new Array<boolean>(positions.length).fill(false);
  for (let r = 0; r < N; r++) {
    const remaining = new Map<string, number>();
    for (const ch of puzzle.goldRows[r].toUpperCase()) {
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
  const sharePayload = shareSrc
    ? buildSharePayload({
        puzzleNumber: puzzle.num,
        moves: shareSrc.moves,
        minSwaps: puzzle.minSwaps,
        streak: liveStreak,
        bonus: shareSrc.bonus,
        revealed: shareSrc.revealed,
        locale,
        dict,
        mode,
      })
    : null;

  const onShare = async () => {
    if (!sharePayload) return;
    // Pass text+url separately so Facebook (which ignores `text`) can still
    // unfurl via the per-solve OG card, while WhatsApp/X/iMessage continue
    // to render the headline + grid plus the link.
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ text: sharePayload.text, url: sharePayload.url });
        return;
      } catch {
        // user cancelled or share failed; fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(sharePayload.full);
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
    <div ref={sizingRef} className="flex flex-col items-center select-none w-full max-w-[var(--tessera-grid-max,520px)] mx-auto px-4">
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
        initialTab={helpTab}
        hideHints={hideHints}
        onHideHintsChange={updateHideHints}
        muted={muted}
        onMutedChange={updateMuted}
        theme={theme}
        onThemeChange={updateTheme}
        mode={mode}
      />
      <HistoryModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        streak={streak}
        epoch={EPOCH}
        mode={mode}
      />
      <RevealConfirm open={confirmReveal} onClose={() => setConfirmReveal(false)} onConfirm={handleReveal} />
      <div className="mb-6 text-center">
        {puzzle.replay ? (
          <>
            <p className="text-[var(--text-kicker)] uppercase tracking-[var(--tracking-kicker)] font-medium text-[color:var(--color-ink)]">
              {t("game.replay.kicker")}
            </p>
            <p className="text-[var(--text-kicker)] tracking-[var(--tracking-kicker)] text-[color:var(--color-muted)] mt-1">
              {t("game.replay.subKicker", { num: puzzle.num, date: puzzle.date })}
            </p>
          </>
        ) : (
          <p className="text-[var(--text-kicker)] uppercase tracking-[var(--tracking-kicker)] text-[color:var(--color-muted)]">
            {puzzle.demo
              ? t("game.kickerDemo")
              : t(mode.id === "hard" ? "game.kickerHard" : "game.kicker", {
                  num: puzzle.num,
                  date: puzzle.date,
                })}
          </p>
        )}
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
                    {t("game.revealedStatus")}
                  </motion.span>
                );
              }
              if (storedResult) {
                return (
                  <motion.span key="stored" {...rollProps} className="block">
                    <SolvedStatus moves={storedResult.moves} minSwaps={puzzle.minSwaps} />
                  </motion.span>
                );
              }
              if (validity.isSolved && puzzle.forceSolved) {
                return (
                  <motion.span key="forcesolved" {...rollProps} className="block font-medium">
                    {t("game.solvedShort")}
                  </motion.span>
                );
              }
              if (validity.isSolved && solvedAt !== null) {
                return (
                  <motion.span key="solvedat" {...rollProps} className="block">
                    <SolvedStatus moves={solvedAt} minSwaps={puzzle.minSwaps} />
                  </motion.span>
                );
              }
              if (moves === 0 && selectedIdx === null) {
                return (
                  <motion.span key="tip" {...rollProps} className="block text-sm leading-snug text-[color:var(--color-muted)] text-center">
                    {t("game.demoTipL1")}
                    <br />
                    {t("game.demoTipL2", { n: N })}
                  </motion.span>
                );
              }
              return (
                <motion.span key="moves" {...rollProps} className="block text-[color:var(--color-muted)]">
                  {t("game.movesStatus", { moves, valid: validity.validRowCount, total: N })}
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
                  backgroundColor: validity.isSolved ? "#b85a1c" : undefined,
                  color: validity.isSolved ? "#fafaf7" : undefined,
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
          <TapRipple key={demoTap.key} idx={demoTap.idx} tileSize={TILE} gap={GAP} N={N} />
        )}
      </div>

      <div className="mt-8 flex flex-col items-center gap-4">
        {(canShare || finished) && (
          <div className="flex flex-wrap items-center justify-center gap-3">
            {canShare && (
              <button
                onClick={onShare}
                className="px-5 py-2 text-sm border border-[color:var(--color-rule)] rounded-md hover:bg-[color:var(--color-cream)] transition-colors"
              >
                {copied
                  ? t("game.copied")
                  : t(shareSrc?.revealed ? "game.shareRevealed" : "game.share")}
              </button>
            )}
            {finished && (
              <button
                onClick={() => openHelp("words")}
                className="px-5 py-2 text-sm border border-[color:var(--color-rule)] rounded-md hover:bg-[color:var(--color-cream)] transition-colors"
              >
                {t("game.seeWords")}
              </button>
            )}
          </div>
        )}
        {!validity.isSolved && !storedResult && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => openHelp("how")}
              className="px-3 py-1.5 text-xs text-[color:var(--color-muted)] bg-[color:var(--color-cream)] rounded-md hover:text-[color:var(--color-ink)] transition-colors"
            >
              {t("game.howToPlay")}
            </button>
            <button
              onClick={() => updateHideHints(!hideHints)}
              className="px-3 py-1.5 text-xs text-[color:var(--color-muted)] bg-[color:var(--color-cream)] rounded-md hover:text-[color:var(--color-ink)] transition-colors"
            >
              {hideHints ? t("game.showHints") : t("game.hideHints")}
            </button>
            <button
              onClick={() => setConfirmReveal(true)}
              className="px-3 py-1.5 text-xs text-[color:var(--color-muted)] bg-[color:var(--color-cream)] rounded-md hover:text-[color:var(--color-ink)] transition-colors"
            >
              {t("game.reveal")}
            </button>
          </div>
        )}
        {finished && !puzzle.replay && (
          <p className="text-xs text-[color:var(--color-muted)]">{t("game.nextPuzzle", { countdown })}</p>
        )}
        {finished && !puzzle.replay && (
          <div className="mt-2 w-full max-w-xs">
            <EmailSignup source={isRevealed ? "revealed" : "solved"} />
          </div>
        )}
        {puzzle.replay && (
          <a
            href={homePath(mode, locale)}
            className="text-xs text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)] transition-colors"
          >
            {t("game.replay.backToToday")}
          </a>
        )}

        {showLegend && (
          <div className="mt-2 flex items-center gap-4 text-xs text-[color:var(--color-muted)]">
            {!hideHints && <Legend variant="hint">{t("game.legend.correctRow")}</Legend>}
            <Legend variant="row">{t("game.legend.correctWord")}</Legend>
            <Legend variant="bonus">{t("game.legend.puzzleComplete")}</Legend>
          </div>
        )}

        <div className="mt-2 flex items-center gap-3 text-[color:var(--color-muted)]">
          <button
            onClick={() => openHelp("how")}
            aria-label={t("game.ariaHowToPlay")}
            className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-[color:var(--color-rule)] text-xs hover:bg-[color:var(--color-cream)] hover:text-[color:var(--color-ink)] transition-colors"
          >
            ?
          </button>
          <button
            onClick={() => setHistoryOpen(true)}
            aria-label={t("game.ariaHistory")}
            className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-[color:var(--color-rule)] hover:bg-[color:var(--color-cream)] hover:text-[color:var(--color-ink)] transition-colors"
          >
            <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="6" cy="6" r="4.5" />
              <path d="M6 3.2v3l1.8 1.1" />
            </svg>
          </button>
          <a
            href={homePath(mode.id === "hard" ? CLASSIC : HARD, locale)}
            className="inline-flex items-center h-7 px-3 rounded-full border border-[color:var(--color-rule)] text-xs hover:bg-[color:var(--color-cream)] hover:text-[color:var(--color-ink)] transition-colors"
          >
            {t(mode.id === "hard" ? "game.switchToClassic" : "game.switchToHard")}
          </a>
          {liveStreak > 0 && !puzzle.replay && (
            <button
              type="button"
              onClick={() => {
                const tierKey = dominantTier(mode, locale, EPOCH);
                const tierName = tierKey ? t(`tiers.${tierKey}`) : "";
                const key = liveStreak === 1 ? "streakToast.single" : "streakToast.plural";
                const msg = tierKey
                  ? t(key, { n: liveStreak, tier: tierName })
                  : t("streakToast.noTier", { n: liveStreak });
                setStreakToast(msg);
                window.setTimeout(() => setStreakToast((c) => (c === msg ? null : c)), 2600);
              }}
              className="inline-flex items-center gap-1 h-7 px-3 rounded-full border border-[color:var(--color-rule)] text-xs tabular-nums hover:bg-[color:var(--color-cream)] hover:text-[color:var(--color-ink)] transition-colors"
            >
              🔥 {liveStreak}
            </button>
          )}
        </div>
      </div>
      <AnimatePresence>
        {streakToast && (
          <motion.div
            key="streak-toast"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            role="status"
            aria-live="polite"
            className="fixed left-1/2 -translate-x-1/2 bottom-16 z-50 pointer-events-none rounded-full bg-[color:var(--color-ink)] text-[color:var(--color-paper)] px-4 py-2 text-xs shadow-lg"
          >
            {streakToast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Touch-style ripple at a tile's centre. Expands from a dot to fill the
// tile area while fading out — the same metaphor as Material's tap ripple,
// readable on both touch and mouse.
function TapRipple({ idx, tileSize, gap, N }: { idx: number; tileSize: number; gap: number; N: number }) {
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
// (which would flash a fake "you got one!" on screen). All candidates
// cross both axes — same-row and same-column pairs are excluded so the
// demo can't read as "you can only swap inside a line." `offset` rotates
// the starting point so successive demo loops show different pairs.
// Falls back to opposite-corner [0, 15] if every candidate would
// validate a row.
function pickDemoSwap(
  positions: Tile[],
  goldRows: string[],
  offset: number
): [number, number] {
  const candidates: [number, number][] = [
    [0, 15],  // diagonal corners
    [3, 12],  // anti-diagonal corners
    [0, 10],  // long diagonal
    [1, 14],  // mid-grid diagonal
    [2, 13],  // mid-grid diagonal
    [5, 11],  // mid-grid diagonal
  ];
  const upper = goldRows.map((r) => r.toUpperCase());
  // pickDemoSwap is gated to N=4 by its caller — encode that locally so
  // this helper is self-contained.
  const N = 4;
  const validRows = (p: Tile[]) =>
    [0, 1, 2, 3].filter(
      (r) => Array.from({ length: N }, (_, c) => p[r * N + c].letter).join("") === upper[r]
    ).length;
  const before = validRows(positions);
  const start = ((offset % candidates.length) + candidates.length) % candidates.length;
  for (let i = 0; i < candidates.length; i++) {
    const [a, b] = candidates[(start + i) % candidates.length];
    if (a >= positions.length || b >= positions.length) continue;
    const after = validRows(swapAt(positions, a, b));
    if (after <= before) return [a, b];
  }
  return [0, 15];
}

function Legend({ children, variant }: { children: React.ReactNode; variant: "row" | "bonus" | "hint" }) {
  // Mini tiles, styled to match the real grid 1:1 so the legend swatch is
  // visually identical to what you're looking for on the board.
  const isHint = variant === "hint";
  const bg = isHint ? "var(--color-cream)" : variant === "bonus" ? "#b85a1c" : "#7a9070";
  // Sage/rust swatches have fixed backgrounds — pin their text contrast too so
  // they read the same in light and dark themes. Hint tile follows the theme.
  const color = isHint ? "var(--color-ink)" : "#fafaf7";
  const letter = isHint ? "A" : variant === "row" ? "B" : "C";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-flex items-center justify-center w-5 h-5 rounded-[3px] text-[11px] font-medium leading-none"
        style={{
          background: bg,
          color,
          outline: isHint ? "2px dashed var(--color-ink)" : undefined,
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
  if (rowValid) return "bg-[#7a9070] text-[#fafaf7]";
  if (homeHint) return "bg-[color:var(--color-cream)] text-[color:var(--color-ink)] outline-2 outline-dashed outline-[color:var(--color-ink)] -outline-offset-[3px]";
  return "bg-[color:var(--color-cream)] text-[color:var(--color-ink)] border border-[color:var(--color-rule)]";
}

function SolvedStatus({ moves, minSwaps }: { moves: number; minSwaps: number }) {
  const { t } = useLocale();
  const tier = getTier(moves, minSwaps);
  const moveWord = t(moves === 1 ? "game.moveSingular" : "game.movePlural");
  return (
    <span className="font-medium">
      {t("game.solvedIn", { moves, moveWord, tier: t(`tiers.${tier.key}`) })}
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
  const { t } = useLocale();
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
          {t("game.revealConfirm.kicker")}
        </p>
        <h2 className="text-xl font-light tracking-tight mt-1">{t("game.revealConfirm.title")}</h2>
        <p className="text-sm mt-3 text-[color:var(--color-ink-soft)]">
          {t("game.revealConfirm.body")}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-[color:var(--color-rule)] rounded-md hover:bg-[color:var(--color-cream)] transition-colors"
          >
            {t("game.revealConfirm.cancel")}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm bg-[color:var(--color-ink)] text-[color:var(--color-paper)] rounded-md hover:opacity-90 transition-opacity"
          >
            {t("game.revealConfirm.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

