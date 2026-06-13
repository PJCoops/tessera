"use client";

import { accountsEnabled, useSupabaseUser } from "../lib/supabase-browser";
import { useLocale } from "../lib/locale-context";
import { track } from "../lib/analytics";

// Slim post-win nudge: a single low-weight line that only shows for a
// signed-out player who has a streak to lose. Account is otherwise always
// reachable from the top bar (with a dot), so this stays quiet and names
// the streak to make the stakes concrete.
export function AccountNudgeLine({
  onOpenAccount,
  liveStreak,
}: {
  onOpenAccount: () => void;
  liveStreak: number;
}) {
  const { t } = useLocale();
  const { user, loaded } = useSupabaseUser();
  if (!accountsEnabled() || !loaded || user || liveStreak < 1) return null;
  return (
    <button
      onClick={() => {
        track("account_cta_clicked", { streak: liveStreak });
        onOpenAccount();
      }}
      className="text-xs text-[color:var(--color-muted)] underline-offset-4 hover:underline hover:text-[color:var(--color-ink)] transition-colors"
    >
      {t("account.saveStreakLine", { n: liveStreak })}
    </button>
  );
}
