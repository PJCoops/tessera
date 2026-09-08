// Client-side fetch for the canonical daily puzzle. The generator and
// wordlists are server-only (app/lib/server/puzzle-engine); clients get the
// board from GET /api/v1/puzzle and never compute it
// (docs/flutter-app-spec.md §4.3, decision 2).
//
// Cached two ways: an in-memory Map for the session, and sessionStorage so a
// reload is instant and doesn't re-hit the network. Network failures get one
// retry with jittered backoff; a 4xx (bad/again-future date) is not retried.

import type { Locale } from "./i18n";
import type { ModeId } from "./mode";
import type { Tile } from "./puzzle";

export type FetchedPuzzle = {
  num: number;
  goldRows: string[];
  startLetters: string;
  startTiles: Tile[];
  minSwaps: number;
};

const mem = new Map<string, FetchedPuzzle>();

const keyFor = (date: string, locale: Locale, mode: ModeId) => `${locale}:${mode}:${date}`;
const storageKey = (k: string) => `puzzle:${k}`;

function readSession(k: string): FetchedPuzzle | null {
  try {
    const raw = window.sessionStorage.getItem(storageKey(k));
    if (!raw) return null;
    const p = JSON.parse(raw) as FetchedPuzzle;
    if (!Array.isArray(p.goldRows) || !Array.isArray(p.startTiles)) return null;
    return p;
  } catch {
    return null;
  }
}

function writeSession(k: string, p: FetchedPuzzle) {
  try {
    window.sessionStorage.setItem(storageKey(k), JSON.stringify(p));
  } catch {}
}

class PuzzleFetchError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "PuzzleFetchError";
  }
}

export async function fetchDailyPuzzle(
  date: string,
  locale: Locale,
  mode: ModeId,
  opts: { signal?: AbortSignal } = {}
): Promise<FetchedPuzzle> {
  const k = keyFor(date, locale, mode);
  const cached = mem.get(k) ?? readSession(k);
  if (cached) {
    mem.set(k, cached);
    return cached;
  }

  const url = `/api/v1/puzzle?date=${date}&locale=${locale}&mode=${mode}`;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 400 * attempt + Math.random() * 200));
    }
    try {
      const res = await fetch(url, { signal: opts.signal });
      if (res.ok) {
        const p = (await res.json()) as FetchedPuzzle;
        mem.set(k, p);
        writeSession(k, p);
        return p;
      }
      // 4xx won't change on retry — surface it immediately.
      if (res.status >= 400 && res.status < 500) {
        throw new PuzzleFetchError(res.status, `puzzle ${date}: ${res.status}`);
      }
      lastErr = new PuzzleFetchError(res.status, `puzzle ${date}: ${res.status}`);
    } catch (e) {
      if (e instanceof PuzzleFetchError && e.status >= 400 && e.status < 500) throw e;
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`puzzle ${date}: fetch failed`);
}
