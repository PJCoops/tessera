const KEY = "tessera:streak";

export type Streak = { current: number; max: number; lastWon: number };

export function readStreak(): Streak {
  if (typeof window === "undefined") return { current: 0, max: 0, lastWon: 0 };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { current: 0, max: 0, lastWon: 0 };
    const s = JSON.parse(raw) as Streak;
    return { current: s.current ?? 0, max: s.max ?? 0, lastWon: s.lastWon ?? 0 };
  } catch {
    return { current: 0, max: 0, lastWon: 0 };
  }
}

export function recordWin(num: number): Streak {
  const prev = readStreak();
  let current: number;
  if (prev.lastWon === num) current = prev.current; // already won today; no-op
  else if (prev.lastWon === num - 1) current = prev.current + 1;
  else current = 1;
  const next: Streak = {
    current,
    max: Math.max(prev.max, current),
    lastWon: num,
  };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  return next;
}

// Streak is "live" only if lastWon is today or yesterday.
export function visibleCurrent(s: Streak, today: number): number {
  if (s.lastWon === today || s.lastWon === today - 1) return s.current;
  return 0;
}
