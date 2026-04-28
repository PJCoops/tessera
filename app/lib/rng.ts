// Tiny seeded PRNG. Same seed → same stream, on every device.
export function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffled<T>(arr: readonly T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Today's date as YYYY-MM-DD in UTC.
export function todayUtc(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Stable seed from a YYYY-MM-DD string. djb2 hash.
export function seedFromDate(date: string): number {
  let h = 5381;
  for (let i = 0; i < date.length; i++) {
    h = (h * 33) ^ date.charCodeAt(i);
  }
  return h >>> 0;
}

// Days since epoch UTC date (inclusive). Epoch is day 1.
export function puzzleNumber(today: string, epoch: string): number {
  const t = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10));
  const e = Date.UTC(+epoch.slice(0, 4), +epoch.slice(5, 7) - 1, +epoch.slice(8, 10));
  return Math.floor((t - e) / 86400000) + 1;
}

// Inverse of puzzleNumber: returns the YYYY-MM-DD UTC date for a given puzzle.
export function dateFromPuzzleNumber(num: number, epoch: string): string {
  const e = Date.UTC(+epoch.slice(0, 4), +epoch.slice(5, 7) - 1, +epoch.slice(8, 10));
  const ms = e + (num - 1) * 86400000;
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
