"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocale } from "../lib/locale-context";
import { getSupabaseBrowser, useSupabaseUser } from "../lib/supabase-browser";
import { track } from "../lib/analytics";

type Status = "idle" | "submitting" | "sent" | "error";

// Magic-link sign-in modal. Signed-in users see their email and a sign-out
// button instead of the form.
export function AccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLocale();
  const { user } = useSupabaseUser();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  // Reset on the way out (instead of an open-effect) so reopening always
  // starts from the form, including after a "sent" confirmation.
  const close = useCallback(() => {
    setStatus("idle");
    setEmail("");
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "submitting") return;
    const supabase = getSupabaseBrowser();
    if (!supabase) {
      setStatus("error");
      return;
    }
    setStatus("submitting");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}/api/auth/confirm` },
    });
    if (error) {
      setStatus("error");
      return;
    }
    track("sign_in_link_sent", {});
    setStatus("sent");
  };

  const signOut = async () => {
    await getSupabaseBrowser()?.auth.signOut();
    close();
  };

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
          onClick={close}
        >
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm bg-[color:var(--color-paper)] border border-[color:var(--color-rule)] rounded-lg p-8 shadow-xl"
          >
            <button
              onClick={close}
              aria-label={t("account.ariaClose")}
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)] rounded"
            >
              ×
            </button>

            <h2 className="text-2xl font-light tracking-tight">{t("account.modalTitle")}</h2>

            {user ? (
              <div className="mt-4">
                <p className="text-sm text-[color:var(--color-muted)]">
                  {t("account.signedInAs", { email: user.email ?? "" })}
                </p>
                <button
                  onClick={signOut}
                  className="mt-4 w-full px-4 py-2.5 text-sm border border-[color:var(--color-rule)] rounded-md hover:bg-[color:var(--color-cream)] transition-colors"
                >
                  {t("account.signOut")}
                </button>
              </div>
            ) : status === "sent" ? (
              <p className="mt-4 text-sm text-[color:var(--color-ink-soft)]">{t("account.sent")}</p>
            ) : (
              <>
                <p className="mt-2 text-sm text-[color:var(--color-muted)]">
                  {t("account.modalBody")}
                </p>
                <form onSubmit={submit} className="mt-4 flex flex-col gap-2">
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    inputMode="email"
                    spellCheck={false}
                    placeholder={t("account.placeholder")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={status === "submitting"}
                    className="w-full rounded-md border border-[color:var(--color-rule)] bg-[color:var(--color-paper)] px-3 py-2 text-sm placeholder:text-[color:var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ink)]/20"
                  />
                  <button
                    type="submit"
                    disabled={status === "submitting"}
                    className="w-full px-4 py-2.5 text-sm bg-[color:var(--color-ink)] text-[color:var(--color-paper)] rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {status === "submitting" ? t("account.submitting") : t("account.submit")}
                  </button>
                </form>
                {status === "error" && (
                  <p className="mt-2 text-[11px] text-red-700">{t("account.error")}</p>
                )}
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Settings-row control: sign-in button when signed out, email + sign-out
// when signed in. The row itself is rendered by HowToPlay's settings tab,
// gated on accountsEnabled().
export function AccountControl({ onOpenAccount }: { onOpenAccount: () => void }) {
  const { t } = useLocale();
  const { user } = useSupabaseUser();

  if (user) {
    return (
      <div className="flex items-center gap-3 min-w-0">
        <span className="truncate text-xs text-[color:var(--color-muted)]">{user.email}</span>
        <button
          onClick={() => void getSupabaseBrowser()?.auth.signOut()}
          className="flex-shrink-0 px-3 py-1.5 text-xs border border-[color:var(--color-rule)] rounded-md hover:bg-[color:var(--color-cream)] transition-colors"
        >
          {t("account.signOut")}
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={onOpenAccount}
      className="px-3 py-1.5 text-xs border border-[color:var(--color-rule)] rounded-md hover:bg-[color:var(--color-cream)] transition-colors"
    >
      {t("account.signIn")}
    </button>
  );
}
