"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocale } from "../lib/locale-context";
import { validateHandle } from "../lib/handle";
import { track } from "../lib/analytics";

type Status = "idle" | "saving" | "taken" | "invalid" | "error";

// Pick a public display name (handle). Setting one opts the player into
// leaderboards and leagues. On success, onSaved fires so callers can
// refetch boards that now include this player.
export function HandleModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: (handle: string) => void;
}) {
  const { t } = useLocale();
  const [name, setName] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  const close = useCallback(() => {
    setStatus("idle");
    setName("");
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
    if (status === "saving") return;
    const local = validateHandle(name);
    if (!local.ok) {
      setStatus("invalid");
      return;
    }
    setStatus("saving");
    try {
      const res = await fetch("/api/profiles", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName: local.value }),
      });
      if (res.status === 409) {
        setStatus("taken");
        return;
      }
      if (!res.ok) {
        setStatus(res.status === 400 ? "invalid" : "error");
        return;
      }
      track("handle_set", {});
      onSaved?.(local.value);
      close();
    } catch {
      setStatus("error");
    }
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
          className="fixed inset-0 z-[80] flex items-center justify-center p-6 bg-[color:var(--color-ink)]/30 backdrop-blur-sm"
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
              aria-label={t("handle.ariaClose")}
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)] rounded"
            >
              ×
            </button>
            <h2 className="text-2xl font-light tracking-tight">{t("handle.title")}</h2>
            <p className="mt-2 text-sm text-[color:var(--color-muted)]">{t("handle.body")}</p>
            <form onSubmit={submit} className="mt-4 flex flex-col gap-2">
              <input
                type="text"
                required
                autoFocus
                maxLength={20}
                autoComplete="off"
                spellCheck={false}
                placeholder={t("handle.placeholder")}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (status !== "saving") setStatus("idle");
                }}
                disabled={status === "saving"}
                className="w-full rounded-md border border-[color:var(--color-rule)] bg-[color:var(--color-paper)] px-3 py-2 text-sm placeholder:text-[color:var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ink)]/20"
              />
              <button
                type="submit"
                disabled={status === "saving" || name.trim().length < 3}
                className="w-full px-4 py-2.5 text-sm bg-[color:var(--color-ink)] text-[color:var(--color-paper)] rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {status === "saving" ? t("handle.saving") : t("handle.submit")}
              </button>
            </form>
            {status === "taken" && <p className="mt-2 text-[11px] text-red-700">{t("handle.taken")}</p>}
            {status === "invalid" && <p className="mt-2 text-[11px] text-red-700">{t("handle.invalid")}</p>}
            {status === "error" && <p className="mt-2 text-[11px] text-red-700">{t("account.error")}</p>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
