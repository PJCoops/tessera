"use client";

import { accountsEnabled, useSupabaseUser } from "../lib/supabase-browser";
import { useLocale } from "../lib/locale-context";
import { track } from "../lib/analytics";

// Post-win nudge, styled like the share row buttons. Hidden when accounts
// are off, auth state hasn't loaded, or the player is already signed in.
export function AccountCta({ onOpenAccount }: { onOpenAccount: () => void }) {
  const { t } = useLocale();
  const { user, loaded } = useSupabaseUser();
  if (!accountsEnabled() || !loaded || user) return null;
  return (
    <button
      onClick={() => {
        track("account_cta_clicked", {});
        onOpenAccount();
      }}
      className="px-5 py-2 text-sm border border-[color:var(--color-rule)] rounded-md hover:bg-[color:var(--color-cream)] transition-colors"
    >
      {t("account.saveStreak")}
    </button>
  );
}
