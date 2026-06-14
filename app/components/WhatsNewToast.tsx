"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocale } from "../lib/locale-context";
import { accountsEnabled } from "../lib/supabase-browser";
import { useConsent } from "../lib/consent";

// One-time slide-up announcing accounts/leaderboards/leagues. Shows only
// when the feature is live (flag on) and the cookie choice is made, so it
// never stacks on the consent banner. Dismissal is remembered.
const KEY = "tessera:whatsnew:accounts";

export function WhatsNewToast({ onCreateAccount }: { onCreateAccount: () => void }) {
  const { t } = useLocale();
  const { hasDecided } = useConsent();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!accountsEnabled() || !hasDecided) return;
    try {
      if (window.localStorage.getItem(KEY) === "1") return;
    } catch {}
    // Slide it up shortly after load (and not synchronously in the effect).
    const id = window.setTimeout(() => setOpen(true), 1200);
    return () => window.clearTimeout(id);
  }, [hasDecided]);

  const dismiss = () => {
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {}
    setOpen(false);
  };

  const createAccount = () => {
    dismiss();
    onCreateAccount();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="whatsnew"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          role="status"
          className="fixed left-1/2 -translate-x-1/2 bottom-4 z-50 w-[calc(100%-2rem)] max-w-sm rounded-lg border border-[color:var(--color-rule)] bg-[color:var(--color-paper)] p-4 shadow-xl"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">
              {t("whatsNew.label")}
            </p>
            <button
              onClick={dismiss}
              aria-label={t("whatsNew.dismiss")}
              className="-mt-1 -mr-1 w-6 h-6 flex items-center justify-center text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)]"
            >
              ×
            </button>
          </div>
          <p className="mt-1 text-sm font-medium">{t("whatsNew.title")}</p>
          <p className="mt-1 text-xs text-[color:var(--color-muted)] leading-relaxed">{t("whatsNew.body")}</p>
          <button
            onClick={createAccount}
            className="mt-3 w-full px-4 py-2 text-xs bg-[color:var(--color-ink)] text-[color:var(--color-paper)] rounded-md hover:opacity-90 transition-opacity"
          >
            {t("whatsNew.cta")}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
