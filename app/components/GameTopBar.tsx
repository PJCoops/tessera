"use client";

import { useLocale } from "../lib/locale-context";
import { CLASSIC, homePath } from "../lib/mode";
import { LeaderboardButton } from "./LeaderboardModal";
import { AccountButton } from "./AccountModal";

// Persistent game chrome lifted out of the post-grid column: wordmark left,
// streak + utility icons right. Aligns to the grid container's edges.
export function GameTopBar({
  liveStreak,
  replay,
  accountNudge,
  onOpenHelp,
  onOpenHistory,
  onOpenLeaderboard,
  onOpenAccount,
  onStreakClick,
}: {
  liveStreak: number;
  replay: boolean;
  accountNudge: boolean;
  onOpenHelp: () => void;
  onOpenHistory: () => void;
  onOpenLeaderboard: () => void;
  onOpenAccount: () => void;
  onStreakClick: () => void;
}) {
  const { t, locale } = useLocale();
  const showStreak = liveStreak > 0 && !replay;
  return (
    // In-flow on mobile (where the narrow column reads well); pinned to the
    // viewport's top corners on desktop so the logo and icons reach the edges.
    <div className="mb-6 w-full flex items-center justify-between gap-3 md:fixed md:top-0 md:inset-x-0 md:z-40 md:mb-0 md:px-6 md:py-4">
      <a
        href={homePath(CLASSIC, locale)}
        aria-label="Tessera"
        className="flex items-center gap-2 hover:opacity-80 transition-opacity"
      >
        <span
          aria-hidden
          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[color:var(--color-paper)] text-base font-bold"
          style={{ background: "#b85a1c" }}
        >
          T
        </span>
        <span className="text-lg font-medium tracking-tight text-[color:var(--color-ink)]">Tessera</span>
      </a>
      <div className="flex items-center gap-2 text-[color:var(--color-muted)]">
        {showStreak && (
          <button
            type="button"
            onClick={onStreakClick}
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full border border-[color:var(--color-rule)] text-xs tabular-nums hover:bg-[color:var(--color-cream)] hover:text-[color:var(--color-ink)] transition-colors"
          >
            🔥 {liveStreak}
          </button>
        )}
        <button
          onClick={onOpenHelp}
          aria-label={t("game.ariaHowToPlay")}
          className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-[color:var(--color-rule)] text-xs hover:bg-[color:var(--color-cream)] hover:text-[color:var(--color-ink)] transition-colors"
        >
          ?
        </button>
        <button
          onClick={onOpenHistory}
          aria-label={t("game.ariaHistory")}
          className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-[color:var(--color-rule)] hover:bg-[color:var(--color-cream)] hover:text-[color:var(--color-ink)] transition-colors"
        >
          <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="6" cy="6" r="4.5" />
            <path d="M6 3.2v3l1.8 1.1" />
          </svg>
        </button>
        {!replay && (
          <>
            <LeaderboardButton onOpen={onOpenLeaderboard} />
            <AccountButton onOpenAccount={onOpenAccount} nudge={accountNudge} />
          </>
        )}
      </div>
    </div>
  );
}
