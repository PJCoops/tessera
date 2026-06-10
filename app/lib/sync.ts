"use client";

import { CLASSIC, HARD, type ModeConfig, type ModeId } from "./mode";
import { detectLocaleFromPathname, type Locale } from "./i18n";
import { readAllResults, writeResult, type StoredResult } from "./results-local";
import { readStreak, type Streak } from "./streak";
import { mergeStreaks } from "./streak-compute";
import type { SwapPair } from "./replay-validate";
import { accountsEnabled, getSupabaseBrowser } from "./supabase-browser";
import { track } from "./analytics";

export const SYNC_EVENT = "tessera:sync-complete";

const MODES: ModeConfig[] = [CLASSIC, HARD];

async function hasSession(): Promise<boolean> {
  const supabase = getSupabaseBrowser();
  if (!supabase) return false;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session !== null;
  } catch {
    return false;
  }
}

export type SubmitArgs = {
  num: number;
  mode: ModeId;
  locale: Locale;
  moves: number;
  bonus: boolean;
  revealed?: boolean;
  history?: SwapPair[];
  timeMs?: number;
  completedAt: number;
};

// Fire-and-forget solve submission. Signed-out play is a cheap no-op, and
// any miss (offline, tab closed) is covered by the next sync-on-load.
export async function submitResult(args: SubmitArgs): Promise<void> {
  try {
    if (!accountsEnabled() || !(await hasSession())) return;
    const res = await fetch("/api/results/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(args),
      keepalive: true,
    });
    if (res.ok) {
      track("result_submitted", { num: args.num, mode: args.mode, revealed: args.revealed === true });
    }
  } catch {}
}

type ServerResult = {
  num: number;
  mode: ModeId;
  moves: number;
  bonus: boolean;
  revealed: boolean;
  verified: boolean;
  timeMs: number | null;
  completedAt: number;
};

type GetResponse = {
  ok: boolean;
  results: ServerResult[];
  streaks: { classic: Streak; hard: Streak };
};

// Two-way merge between localStorage and the server:
// push local rows the server lacks (plus rows whose history could upgrade
// an unverified server row), pull server rows this device lacks, then
// merge streaks per mode. Returns null on any failure; the next load
// simply tries again.
export async function syncAll(): Promise<{ pushed: number; pulled: number } | null> {
  try {
    const res = await fetch("/api/results");
    if (!res.ok) return null;
    const data = (await res.json()) as GetResponse;
    if (!data.ok) return null;

    const locale = detectLocaleFromPathname(window.location.pathname);
    const serverByKey = new Map<string, ServerResult>();
    for (const r of data.results) serverByKey.set(`${r.mode}:${r.num}`, r);

    const toPush: SubmitArgs[] = [];
    for (const mode of MODES) {
      for (const [num, r] of readAllResults(mode.resultPrefix)) {
        const server = serverByKey.get(`${mode.id}:${num}`);
        const couldUpgrade =
          server && !server.verified && !r.revealed && (r.history?.length ?? 0) > 0;
        if (!server || couldUpgrade) {
          toPush.push({
            num,
            mode: mode.id,
            locale,
            moves: r.moves,
            bonus: r.bonus,
            revealed: r.revealed === true,
            history: r.history,
            timeMs: r.timeMs,
            completedAt: r.completedAt,
          });
        }
      }
    }

    let pushed = 0;
    if (toPush.length > 0) {
      const streaks = {
        classic: readStreak(CLASSIC.streakKey),
        hard: readStreak(HARD.streakKey),
      };
      const ires = await fetch("/api/results/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ results: toPush, streaks }),
      });
      if (ires.ok) pushed = toPush.length;
    }

    let pulled = 0;
    for (const mode of MODES) {
      const locals = readAllResults(mode.resultPrefix);
      for (const r of data.results) {
        if (r.mode !== mode.id || locals.has(r.num)) continue;
        const stored: StoredResult = {
          moves: r.moves,
          bonus: r.bonus,
          completedAt: r.completedAt,
        };
        if (r.revealed) stored.revealed = true;
        if (r.timeMs !== null) stored.timeMs = r.timeMs;
        writeResult(r.num, stored, mode.resultPrefix);
        pulled++;
      }
    }

    for (const mode of MODES) {
      const server = mode.id === "hard" ? data.streaks.hard : data.streaks.classic;
      const merged = mergeStreaks(readStreak(mode.streakKey), server);
      try {
        window.localStorage.setItem(mode.streakKey, JSON.stringify(merged));
      } catch {}
    }

    try {
      window.dispatchEvent(new Event(SYNC_EVENT));
    } catch {}
    return { pushed, pulled };
  } catch {
    return null;
  }
}
