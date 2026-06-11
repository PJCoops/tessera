import type { Tile } from "./puzzle";
import type { SwapPair } from "./replay-validate";

// localStorage shapes for daily results and in-progress games, shared by
// the game and account sync. history/timeMs/startedAt arrived with
// accounts sync; entries written before that lack them, so every new
// field stays optional.
export type StoredResult = {
  moves: number;
  bonus: boolean;
  completedAt: number;
  revealed?: boolean;
  history?: SwapPair[];
  timeMs?: number;
};

export type StoredProgress = {
  positions: Tile[];
  moves: number;
  history?: SwapPair[];
  startedAt?: number;
};

export function readResult(num: number, prefix: string): StoredResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(prefix + num);
    return raw ? (JSON.parse(raw) as StoredResult) : null;
  } catch {
    return null;
  }
}

export function writeResult(num: number, r: StoredResult, prefix: string) {
  try {
    window.localStorage.setItem(prefix + num, JSON.stringify(r));
  } catch {}
}

export function readAllResults(prefix: string): Map<number, StoredResult> {
  const out = new Map<number, StoredResult>();
  if (typeof window === "undefined") return out;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(prefix)) continue;
      const num = Number(key.slice(prefix.length));
      if (!Number.isFinite(num)) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      try {
        out.set(num, JSON.parse(raw) as StoredResult);
      } catch {}
    }
  } catch {}
  return out;
}

export function readProgress(num: number, prefix: string): StoredProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(prefix + num);
    return raw ? (JSON.parse(raw) as StoredProgress) : null;
  } catch {
    return null;
  }
}

export function writeProgress(num: number, p: StoredProgress, prefix: string) {
  try {
    window.localStorage.setItem(prefix + num, JSON.stringify(p));
  } catch {}
}

export function clearProgress(num: number, prefix: string) {
  try {
    window.localStorage.removeItem(prefix + num);
  } catch {}
}

// Drop progress entries for any puzzle other than today's. Players abandon
// puzzles often — without this, those keys accumulate forever.
export function pruneOldProgress(currentNum: number, prefix: string) {
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
