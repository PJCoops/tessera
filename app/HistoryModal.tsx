"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { dateFromPuzzleNumber, puzzleNumber, todayUtc } from "./lib/rng";
import type { Streak } from "./lib/streak";
import { TIERS, TIER_COLORS, getTier } from "./lib/tier";
import { useLocale } from "./lib/locale-context";

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

type Tab = "solves" | "all";

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
  const { locale, t } = useLocale();
  const [tab, setTab] = useState<Tab>("solves");

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
      const k = getTier(e.result.moves).key;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return counts;
  }, [solved]);

  // The "All puzzles" tab lists every past puzzle (#1 → today − 1) so
  // players can replay anything they missed. Each row links to ?day=...
  // which the resolver opens in isolated replay mode.
  const todayNum = useMemo(
    () => (open ? puzzleNumber(todayUtc(), epoch) : 0),
    [open, epoch]
  );
  const resultByNum = useMemo(() => {
    const m = new Map<number, Result>();
    for (const e of entries) m.set(e.num, e.result);
    return m;
  }, [entries]);
  const pastNums = useMemo(() => {
    if (todayNum <= 1) return [] as number[];
    const out: number[] = [];
    for (let n = todayNum - 1; n >= 1; n--) out.push(n);
    return out;
  }, [todayNum]);
  const localePrefix = locale === "en" ? "" : `/${locale}`;

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
              aria-label={t("history.ariaClose")}
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)] rounded"
            >
              ×
            </button>

            <p className="text-[var(--text-kicker)] uppercase tracking-[var(--tracking-kicker)] text-[color:var(--color-muted)]">
              {t("history.kicker")}
            </p>
            <h2 className="text-2xl font-light tracking-tight mt-1">{t("history.title")}</h2>

            <div className="mt-5 flex border-b border-[color:var(--color-rule)]">
              <TabButton active={tab === "solves"} onClick={() => setTab("solves")}>
                {t("history.tabs.solves")}
              </TabButton>
              <TabButton active={tab === "all"} onClick={() => setTab("all")}>
                {t("history.tabs.all")}
              </TabButton>
            </div>

            {tab === "solves" ? (
              <div className="mt-5 flex-1 flex flex-col min-h-0">
                <div className="grid grid-cols-4 gap-3 text-center">
                  <Stat label={t("history.stats.solved")} value={solvedCount} />
                  <Stat label={t("history.stats.avgMoves")} value={avgMoves} />
                  <Stat label={t("history.stats.streak")} value={streak.current} />
                  <Stat label={t("history.stats.best")} value={streak.max} />
                </div>

                {solvedCount > 0 && (
                  <div className="mt-4">
                    <p className="text-[10px] uppercase tracking-wider text-[color:var(--color-muted)] mb-2">{t("history.byTier")}</p>
                    <TierDistribution tierCounts={tierCounts} t={t} />
                  </div>
                )}

                <div className="mt-6 flex-1 overflow-y-auto -mx-2">
                  {entries.length === 0 ? (
                    <p className="text-sm text-[color:var(--color-muted)] px-2">
                      {t("history.empty")}
                    </p>
                  ) : (
                    <ul className="divide-y divide-[color:var(--color-rule)]">
                      {entries.map((e) => {
                        const tierKey = e.result.revealed ? null : getTier(e.result.moves).key;
                        return (
                          <li key={e.num} className="flex items-center justify-between px-2 py-2 text-sm gap-3">
                            <span className="text-[color:var(--color-muted)] tabular-nums whitespace-nowrap">
                              #{e.num} · {e.date}
                            </span>
                            <span className="flex items-center gap-2 tabular-nums whitespace-nowrap">
                              {tierKey && (
                                <span
                                  aria-label={t(`tiers.${tierKey}`)}
                                  title={t(`tiers.${tierKey}`)}
                                  className="inline-block w-2 h-2 rounded-full shrink-0"
                                  style={{ background: TIER_COLORS[tierKey] }}
                                />
                              )}
                              {e.result.revealed ? (
                                <span className="text-[color:var(--color-muted)]">{t("history.revealed")}</span>
                              ) : (
                                <span className="font-medium">
                                  {e.result.moves} {t(e.result.moves === 1 ? "game.moveSingular" : "game.movePlural")}
                                </span>
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-5 flex-1 overflow-y-auto -mx-2 min-h-0">
                {pastNums.length === 0 ? (
                  <p className="text-sm text-[color:var(--color-muted)] px-2">
                    {t("history.allPuzzles.empty")}
                  </p>
                ) : (
                  <ul className="divide-y divide-[color:var(--color-rule)]">
                    {pastNums.map((num) => {
                      const date = dateFromPuzzleNumber(num, epoch);
                      const result = resultByNum.get(num);
                      const tierKey = result && !result.revealed ? getTier(result.moves).key : null;
                      return (
                        <li key={num} className="text-sm">
                          <a
                            href={`${localePrefix}/?day=${date}`}
                            aria-label={t("history.allPuzzles.ariaPlay", { num })}
                            className="flex items-center justify-between px-2 py-2 gap-3 hover:bg-[color:var(--color-cream)] transition-colors"
                          >
                            <span className="text-[color:var(--color-muted)] tabular-nums whitespace-nowrap">
                              #{num} · {date}
                            </span>
                            <span className="flex items-center gap-2 tabular-nums whitespace-nowrap">
                              {tierKey && (
                                <span
                                  aria-label={t(`tiers.${tierKey}`)}
                                  title={t(`tiers.${tierKey}`)}
                                  className="inline-block w-2 h-2 rounded-full shrink-0"
                                  style={{ background: TIER_COLORS[tierKey] }}
                                />
                              )}
                              {result?.revealed ? (
                                <span className="text-[color:var(--color-muted)]">{t("history.revealed")}</span>
                              ) : result ? (
                                <span className="font-medium">
                                  {result.moves} {t(result.moves === 1 ? "game.moveSingular" : "game.movePlural")}
                                </span>
                              ) : (
                                <span className="text-[color:var(--color-muted)] text-xs">
                                  {t("history.allPuzzles.notPlayed")}
                                </span>
                              )}
                              <span aria-hidden className="text-[color:var(--color-muted)] text-base leading-none">›</span>
                            </span>
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
        active
          ? "border-[color:var(--color-ink)] text-[color:var(--color-ink)] font-medium"
          : "border-transparent text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)]"
      }`}
    >
      {children}
    </button>
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

function TierDistribution({
  tierCounts,
  t,
}: {
  tierCounts: Map<string, number>;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const max = Math.max(1, ...Array.from(tierCounts.values()));
  return (
    <ul className="space-y-1">
      {TIERS.map((tier) => {
        const count = tierCounts.get(tier.key) ?? 0;
        const pct = count === 0 ? 0 : Math.max(8, (count / max) * 100);
        return (
          <li key={tier.key} className="flex items-center gap-2 text-xs">
            <span className="w-20 shrink-0 text-[color:var(--color-muted)]">{t(`tiers.${tier.key}`)}</span>
            <div className="flex-1 h-5 rounded-sm overflow-hidden">
              {count === 0 ? (
                <div className="h-full flex items-center px-1.5 text-[10px] text-[color:var(--color-muted)] tabular-nums border border-[color:var(--color-rule)] rounded-sm">
                  0
                </div>
              ) : (
                <div
                  className="h-full flex items-center justify-end px-1.5 text-[10px] font-medium tabular-nums text-white"
                  style={{ width: `${pct}%`, background: TIER_COLORS[tier.key] }}
                >
                  {count}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
