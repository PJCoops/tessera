"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocale } from "../lib/locale-context";
import type { ModeId } from "../lib/mode";
import { track } from "../lib/analytics";
import { accountsEnabled } from "../lib/supabase-browser";

// Round trophy icon for the chrome row, matching AccountButton's style.
// Visible whenever accounts are on; the board itself is public.
export function LeaderboardButton({ onOpen }: { onOpen: () => void }) {
  const { t } = useLocale();
  if (!accountsEnabled()) return null;
  return (
    <button
      onClick={onOpen}
      aria-label={t("leaderboard.ariaOpen")}
      className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-[color:var(--color-rule)] hover:bg-[color:var(--color-cream)] hover:text-[color:var(--color-ink)] transition-colors"
    >
      <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 1.5h6v2a3 3 0 0 1-6 0v-2z" />
        <path d="M3 2.2H1.6c0 1.2.5 1.9 1.6 2.1M9 2.2h1.4c0 1.2-.5 1.9-1.6 2.1M4.6 6.4 4.2 8.5h3.6l-.4-2.1M3.4 10.5h5.2" />
      </svg>
    </button>
  );
}

// Post-win bordered button ("Today's leaderboard"). Public, so shown
// signed in or out whenever accounts are on.
export function LeaderboardCta({ onOpen }: { onOpen: () => void }) {
  const { t } = useLocale();
  if (!accountsEnabled()) return null;
  return (
    <button
      onClick={onOpen}
      className="px-5 py-2 text-sm border border-[color:var(--color-rule)] rounded-md hover:bg-[color:var(--color-cream)] transition-colors"
    >
      {t("leaderboard.cta")}
    </button>
  );
}

type Entry = { rank: number; handle: string; moves: number; timeMs: number | null; isMe: boolean };
type LeaderboardResponse = {
  ok: true;
  global: Entry[];
  country: { code: string | null; entries: Entry[] };
  me: { global: Entry | null; country: Entry | null };
  hasHandle: boolean;
  signedIn: boolean;
};

type Tab = "global" | "country";

function fmtTime(ms: number | null): string {
  if (ms === null) return "—";
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function BoardRow({ e }: { e: Entry }) {
  return (
    <div
      className={`grid grid-cols-[2.25rem_1fr_3rem_3.25rem] gap-2 items-center px-2 py-1.5 text-xs tabular-nums border-t border-[color:var(--color-rule)] ${
        e.isMe ? "bg-[color:var(--color-cream)] font-medium" : ""
      }`}
    >
      <span className="text-[color:var(--color-muted)]">{e.rank}</span>
      <span className="truncate">{e.handle}</span>
      <span className="text-right">{e.moves}</span>
      <span className="text-right text-[color:var(--color-muted)]">{fmtTime(e.timeMs)}</span>
    </div>
  );
}

export function LeaderboardModal({
  open,
  onClose,
  mode,
  num,
  onOpenAccount,
  onOpenHandle,
}: {
  open: boolean;
  onClose: () => void;
  mode: ModeId;
  num: number;
  onOpenAccount: () => void;
  onOpenHandle: () => void;
}) {
  const { t } = useLocale();
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [tab, setTab] = useState<Tab>("global");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/leaderboard?mode=${mode}&num=${num}`);
      const json = (await res.json()) as LeaderboardResponse;
      if (json.ok) setData(json);
    } catch {
      // leave previous data; the empty state covers a first-load miss
    }
  }, [mode, num]);

  // Derived rather than a separate setState so the open-effect stays free
  // of synchronous state updates.
  const loading = open && data === null;

  useEffect(() => {
    if (!open) return;
    track("leaderboard_opened", { mode, num });
    // load() only setStates after an await, so this isn't a synchronous
    // cascade; the linter can't see past the call.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, load, onClose, mode, num]);

  const hasCountry = !!data?.country.code;
  const entries = tab === "country" && data ? data.country.entries : data?.global ?? [];
  const meRow = data ? (tab === "country" ? data.me.country : data.me.global) : null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-[color:var(--color-ink)]/30 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md bg-[color:var(--color-paper)] border border-[color:var(--color-rule)] rounded-lg p-6 shadow-xl"
          >
            <button
              onClick={onClose}
              aria-label={t("leaderboard.ariaClose")}
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)] rounded"
            >
              ×
            </button>
            <h2 className="text-2xl font-light tracking-tight">{t("leaderboard.title")}</h2>
            <p className="mt-1 text-xs text-[color:var(--color-muted)]">
              {t(mode === "hard" ? "leaderboard.subHard" : "leaderboard.sub", { num })}
            </p>

            <div className="mt-4 flex gap-1 border-b border-[color:var(--color-rule)]">
              <TabButton active={tab === "global"} onClick={() => setTab("global")}>
                {t("leaderboard.tabGlobal")}
              </TabButton>
              {hasCountry && (
                <TabButton active={tab === "country"} onClick={() => setTab("country")}>
                  {data?.country.code ?? t("leaderboard.tabCountry")}
                </TabButton>
              )}
            </div>

            <div className="mt-3">
              <div className="grid grid-cols-[2.25rem_1fr_3rem_3.25rem] gap-2 px-2 text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">
                <span>{t("leaderboard.colRank")}</span>
                <span>{t("leaderboard.colPlayer")}</span>
                <span className="text-right">{t("leaderboard.colMoves")}</span>
                <span className="text-right">{t("leaderboard.colTime")}</span>
              </div>
              <div className="mt-1 max-h-[50vh] overflow-y-auto">
                {entries.length === 0 ? (
                  <p className="py-6 text-center text-xs text-[color:var(--color-muted)]">
                    {loading ? t("leaderboard.loading") : t("leaderboard.empty")}
                  </p>
                ) : (
                  entries.map((e) => <BoardRow key={`${e.rank}-${e.handle}`} e={e} />)
                )}
                {meRow && !entries.some((e) => e.isMe) && (
                  <>
                    <p className="mt-2 px-2 text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">
                      {t("leaderboard.yourRank")}
                    </p>
                    <BoardRow e={{ ...meRow, isMe: true }} />
                  </>
                )}
              </div>
            </div>

            {data && !data.signedIn && (
              <Footer
                text={t("leaderboard.signInPrompt")}
                cta={t("account.signIn")}
                onClick={onOpenAccount}
              />
            )}
            {data && data.signedIn && !data.hasHandle && (
              <Footer
                text={t("leaderboard.optInPrompt")}
                cta={t("leaderboard.pickName")}
                onClick={onOpenHandle}
              />
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
      className={`px-3 py-1.5 text-sm -mb-px border-b-2 transition-colors ${
        active
          ? "border-[color:var(--color-ink)] text-[color:var(--color-ink)]"
          : "border-transparent text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)]"
      }`}
    >
      {children}
    </button>
  );
}

function Footer({ text, cta, onClick }: { text: string; cta: string; onClick: () => void }) {
  return (
    <div className="mt-4 pt-3 border-t border-[color:var(--color-rule)] flex items-center justify-between gap-3">
      <p className="text-xs text-[color:var(--color-muted)]">{text}</p>
      <button
        onClick={onClick}
        className="flex-shrink-0 px-3 py-1.5 text-xs border border-[color:var(--color-rule)] rounded-md hover:bg-[color:var(--color-cream)] transition-colors"
      >
        {cta}
      </button>
    </div>
  );
}
