"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo } from "react";
import { dateFromPuzzleNumber } from "./lib/rng";
import type { Streak } from "./lib/streak";
import { TIERS, getTier } from "./lib/tier";

type Result = { moves: number; bonus: boolean; completedAt: number; revealed?: boolean };

type Entry = { num: number; date: string; result: Result };

const RESULT_PREFIX = "tessera:result:";

function readAllResults(epoch: string): Entry[] {
  if (typeof window === "undefined") return [];
  const out: Entry[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key || !key.startsWith(RESULT_PREFIX)) continue;
    const num = Number(key.slice(RESULT_PREFIX.length));
    if (!Number.isFinite(num)) continue;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const r = JSON.parse(raw) as Result;
      out.push({ num, date: dateFromPuzzleNumber(num, epoch), result: r });
    } catch {}
  }
  out.sort((a, b) => b.num - a.num);
  return out;
}

export function HistoryModal({
  open,
  onClose,
  streak,
  epoch,
}: {
  open: boolean;
  onClose: () => void;
  streak: Streak;
  epoch: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const entries = useMemo(() => (open ? readAllResults(epoch) : []), [open, epoch]);
  const solved = entries.filter((e) => !e.result.revealed);
  const solvedCount = solved.length;
  const avgMoves = solvedCount > 0
    ? Math.round(solved.reduce((s, e) => s + e.result.moves, 0) / solvedCount)
    : 0;
  const tierCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of solved) {
      const t = getTier(e.result.moves).name;
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return counts;
  }, [solved]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[color:var(--color-ink)]/30 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md bg-[color:var(--color-paper)] border border-[color:var(--color-rule)] rounded-lg p-8 shadow-xl max-h-[85vh] flex flex-col"
          >
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)] rounded"
            >
              ×
            </button>

            <p className="text-[var(--text-kicker)] uppercase tracking-[var(--tracking-kicker)] text-[color:var(--color-muted)]">
              History
            </p>
            <h2 className="text-2xl font-light tracking-tight mt-1">Your Tessera.</h2>

            <div className="mt-5 grid grid-cols-4 gap-3 text-center">
              <Stat label="Solved" value={solvedCount} />
              <Stat label="Avg moves" value={avgMoves} />
              <Stat label="Streak" value={streak.current} />
              <Stat label="Best" value={streak.max} />
            </div>

            {solvedCount > 0 && (
              <div className="mt-4">
                <p className="text-[10px] uppercase tracking-wider text-[color:var(--color-muted)] mb-2">By tier</p>
                <ul className="space-y-1">
                  {TIERS.map((t) => {
                    const count = tierCounts.get(t.name) ?? 0;
                    const range = t.max === Infinity ? `${(TIERS[TIERS.indexOf(t) - 1]?.max ?? 0) + 1}+` : `≤${t.max}`;
                    return (
                      <li key={t.name} className="flex items-baseline justify-between text-sm">
                        <span>
                          <span className="font-medium">{t.name}</span>
                          <span className="text-[color:var(--color-muted)] ml-2 text-xs">{range}</span>
                        </span>
                        <span className="tabular-nums text-[color:var(--color-muted)]">{count}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div className="mt-6 flex-1 overflow-y-auto -mx-2">
              {entries.length === 0 ? (
                <p className="text-sm text-[color:var(--color-muted)] px-2">
                  No puzzles solved yet. Today&rsquo;s your day.
                </p>
              ) : (
                <ul className="divide-y divide-[color:var(--color-rule)]">
                  {entries.map((e) => (
                    <li key={e.num} className="flex items-baseline justify-between px-2 py-2 text-sm">
                      <span className="text-[color:var(--color-muted)] tabular-nums">
                        #{e.num} · {e.date}
                      </span>
                      <span className="font-medium tabular-nums">
                        {e.result.revealed
                          ? <span className="text-[color:var(--color-muted)]">revealed</span>
                          : (
                            <>
                              {e.result.moves} {e.result.moves === 1 ? "move" : "moves"}
                              <span className="text-[color:var(--color-muted)] ml-2 text-xs">{getTier(e.result.moves).name}</span>
                            </>
                          )
                        }
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[color:var(--color-cream)] rounded-md py-2">
      <div className="text-xl font-light tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">{label}</div>
    </div>
  );
}
