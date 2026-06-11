"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocale } from "../lib/locale-context";
import { accountsEnabled, getSupabaseBrowser, useSupabaseUser } from "../lib/supabase-browser";
import { track } from "../lib/analytics";

type Step = "email" | "code";
type Status = "idle" | "busy" | "error";

// Email + 6-digit code sign-in. A code keeps the player on the device
// they're already playing on (a magic link would sign in whichever device
// opened the email), which matters for a cross-device sync feature.
// Signed-in users see their email and a sign-out button instead.
export function AccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLocale();
  const { user } = useSupabaseUser();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<Step>("email");
  const [status, setStatus] = useState<Status>("idle");

  // Reset on the way out (instead of an open-effect) so reopening always
  // starts from the email step.
  const close = useCallback(() => {
    setStatus("idle");
    setStep("email");
    setEmail("");
    setCode("");
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

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "busy") return;
    const supabase = getSupabaseBrowser();
    if (!supabase) {
      setStatus("error");
      return;
    }
    setStatus("busy");
    // No emailRedirectTo: the email template carries the code, not a link.
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
    });
    if (error) {
      setStatus("error");
      return;
    }
    track("sign_in_code_sent", {});
    setStep("code");
    setStatus("idle");
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "busy") return;
    const supabase = getSupabaseBrowser();
    if (!supabase) {
      setStatus("error");
      return;
    }
    setStatus("busy");
    const e164 = email.trim().toLowerCase();
    const token = code.trim();
    // On success the browser client writes the session to cookies and
    // useSupabaseUser flips to the signed-in view; no redirect route needed.
    // A returning user's OTP verifies as type "email"; a brand-new user's
    // first code is a signup confirmation, so fall back to "signup".
    let { error } = await supabase.auth.verifyOtp({ email: e164, token, type: "email" });
    if (error) {
      ({ error } = await supabase.auth.verifyOtp({ email: e164, token, type: "signup" }));
    }
    if (error) {
      setStatus("error");
      return;
    }
    track("sign_in_verified", {});
    setStatus("idle");
  };

  const restart = () => {
    setStep("email");
    setStatus("idle");
    setCode("");
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

            <h2 className="text-2xl font-light tracking-tight">
              {user ? t("account.title") : t("account.modalTitle")}
            </h2>

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
            ) : step === "email" ? (
              <>
                <p className="mt-2 text-sm text-[color:var(--color-muted)]">
                  {t("account.modalBody")}
                </p>
                <form onSubmit={sendCode} className="mt-4 flex flex-col gap-2">
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    inputMode="email"
                    spellCheck={false}
                    placeholder={t("account.placeholder")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={status === "busy"}
                    className="w-full rounded-md border border-[color:var(--color-rule)] bg-[color:var(--color-paper)] px-3 py-2 text-sm placeholder:text-[color:var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ink)]/20"
                  />
                  <button
                    type="submit"
                    disabled={status === "busy"}
                    className="w-full px-4 py-2.5 text-sm bg-[color:var(--color-ink)] text-[color:var(--color-paper)] rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {status === "busy" ? t("account.submitting") : t("account.submit")}
                  </button>
                </form>
                {status === "error" && (
                  <p className="mt-2 text-[11px] text-red-700">{t("account.error")}</p>
                )}
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-[color:var(--color-muted)]">
                  {t("account.codePrompt", { email })}
                </p>
                <form onSubmit={verifyCode} className="mt-4 flex flex-col gap-2">
                  <input
                    type="text"
                    required
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={10}
                    autoFocus
                    spellCheck={false}
                    placeholder={t("account.codePlaceholder")}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    disabled={status === "busy"}
                    className="w-full rounded-md border border-[color:var(--color-rule)] bg-[color:var(--color-paper)] px-3 py-2 text-base tracking-[0.4em] text-center placeholder:tracking-normal placeholder:text-[color:var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ink)]/20"
                  />
                  <button
                    type="submit"
                    disabled={status === "busy" || code.length < 6}
                    className="w-full px-4 py-2.5 text-sm bg-[color:var(--color-ink)] text-[color:var(--color-paper)] rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {status === "busy" ? t("account.verifying") : t("account.verify")}
                  </button>
                </form>
                {status === "error" && (
                  <p className="mt-2 text-[11px] text-red-700">{t("account.codeError")}</p>
                )}
                <button
                  onClick={restart}
                  className="mt-3 text-[11px] text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)] underline-offset-4 hover:underline"
                >
                  {t("account.restart")}
                </button>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Persistent round icon for the bottom chrome row, matching the ? and
// history buttons. Filled when signed in so the state reads at a glance.
// Hidden entirely when accounts are off. Opens the same AccountModal.
export function AccountButton({ onOpenAccount }: { onOpenAccount: () => void }) {
  const { t } = useLocale();
  const { user, loaded } = useSupabaseUser();
  if (!accountsEnabled() || !loaded) return null;
  const signedIn = user !== null;
  return (
    <button
      onClick={onOpenAccount}
      aria-label={t("account.title")}
      className={`inline-flex items-center justify-center w-7 h-7 rounded-full border transition-colors ${
        signedIn
          ? "border-[color:var(--color-ink)] bg-[color:var(--color-ink)] text-[color:var(--color-paper)]"
          : "border-[color:var(--color-rule)] hover:bg-[color:var(--color-cream)] hover:text-[color:var(--color-ink)]"
      }`}
    >
      <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6" cy="4" r="2.2" />
        <path d="M2 10.2c0-2.2 1.8-3.4 4-3.4s4 1.2 4 3.4" />
      </svg>
    </button>
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
