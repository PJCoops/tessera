"use client";

import { accountsEnabled, useSupabaseUser } from "../lib/supabase-browser";
import { useLocale } from "../lib/locale-context";
import { track } from "../lib/analytics";

// Post-win nudge, styled like the share row buttons. Hidden when accounts
// are off, auth state hasn't loaded, or the player is already signed in.
// When the player has a live streak, the label names it ("Save your N-day
// streak") so the thing they'd lose is concrete; at 7+ it goes filled-ink
// for a touch more urgency.
export function AccountCta({
  onOpenAccount,
  liveStreak = 0,
}: {
  onOpenAccount: () => void;
  liveStreak?: number;
}) {
  const { t } = useLocale();
  const { user, loaded } = useSupabaseUser();
  if (!accountsEnabled() || !loaded || user) return null;
  const label = t("account.saveStreak");
  const bold = liveStreak >= 7;
  return (
    <button
      onClick={() => {
        track("account_cta_clicked", { streak: liveStreak });
        onOpenAccount();
      }}
      className={
        bold
          ? "px-5 py-2 text-sm rounded-md bg-[color:var(--color-ink)] text-[color:var(--color-paper)] hover:opacity-90 transition-opacity"
          : "px-5 py-2 text-sm border border-[color:var(--color-rule)] rounded-md hover:bg-[color:var(--color-cream)] transition-colors"
      }
    >
      {label}
    </button>
  );
}
