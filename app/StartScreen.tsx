"use client";

import { motion } from "framer-motion";
import { useLocale } from "./lib/locale-context";
import { StartDemo } from "./StartDemo";

const SEEN_KEY = "tessera:seen-start";

export function hasSeenStart(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

export function markStartSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {}
}

export function StartScreen({
  onPlay,
  onHowToPlay,
}: {
  onPlay: () => void;
  onHowToPlay: () => void;
}) {
  const { t } = useLocale();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex flex-col items-center select-none w-full max-w-[var(--tessera-grid-max,520px)] mx-auto px-4 py-8"
    >
      <div
        aria-hidden
        className="flex items-center justify-center w-14 h-14 rounded-md text-3xl font-medium"
        style={{ background: "#b85a1c", color: "#fafaf7" }}
      >
        T
      </div>
      <h1 className="mt-3 text-3xl font-light tracking-tight text-[color:var(--color-ink)]">Tessera</h1>

      <div className="mt-8 flex justify-center">
        <StartDemo />
      </div>

      <p
        className="mt-6 text-sm text-center text-[color:var(--color-ink-soft)] max-w-[280px] leading-relaxed"
        style={{ textWrap: "balance" }}
      >
        {t("start.tagline")}
      </p>

      <button
        onClick={onPlay}
        className="mt-6 px-6 py-3 text-base font-medium bg-[color:var(--color-ink)] text-[color:var(--color-paper)] rounded-md hover:opacity-90 active:scale-[0.98] transition-all"
        style={{ width: 236 }}
      >
        {t("start.play")}
      </button>

      <button
        onClick={onHowToPlay}
        className="mt-3 text-sm text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)] transition-colors underline-offset-4 hover:underline"
      >
        {t("start.howToPlay")}
      </button>
    </motion.div>
  );
}
