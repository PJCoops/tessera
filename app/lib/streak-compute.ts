import type { Streak } from "./streak";

// Derives a streak from won puzzle numbers (callers must exclude revealed
// results — they are not wins). Matches recordWin's arithmetic in streak.ts:
// a streak is a run of consecutive puzzle numbers.
export function computeStreak(nums: number[], importedMax = 0): Streak {
  const uniq = Array.from(new Set(nums)).sort((a, b) => a - b);
  let max = 0;
  let run = 0;
  let prev: number | null = null;
  for (const n of uniq) {
    run = prev !== null && n === prev + 1 ? run + 1 : 1;
    if (run > max) max = run;
    prev = n;
  }
  if (uniq.length === 0) return { current: 0, max: importedMax, lastWon: 0 };
  return {
    current: run,
    max: Math.max(max, importedMax),
    lastWon: uniq[uniq.length - 1],
  };
}

// Merge a local and a server streak: the fresher lastWon decides `current`,
// maxima combine. The spec's take-the-higher-value-per-field rule.
export function mergeStreaks(a: Streak, b: Streak): Streak {
  const fresher = a.lastWon >= b.lastWon ? a : b;
  return {
    current: fresher.current,
    max: Math.max(a.max, b.max),
    lastWon: fresher.lastWon,
  };
}
