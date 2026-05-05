"use client";

// Install hint shown to iOS Safari visitors who haven't yet added the
// puzzle to their home screen. The Settings panel already gates push
// reminders behind "install first" — this banner exists to surface
// that path before the user goes hunting in Settings.
//
// Rules:
//   - iOS Safari only. Android Chrome surfaces its own install UI via
//     `beforeinstallprompt`; we don't try to compete with it.
//   - Hidden when already running standalone (i.e. opened from the
//     home-screen icon).
//   - Dismissible. Dismissal persisted to localStorage for 30 days so
//     the user isn't nagged on every visit.
//   - Mounted client-side after first paint so it never blocks the
//     puzzle's first render.

import { useEffect, useState } from "react";
import { useLocale } from "../lib/locale-context";

const DISMISS_KEY = "tessera:install-dismissed";
const DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function shouldShow(): boolean {
  if (typeof window === "undefined") return false;
  // iOS detection. Avoid touching `navigator` on the server.
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (!isIOS) return false;
  // Hidden once installed. iOS Safari uses the legacy `navigator.standalone`.
  const navAny = navigator as Navigator & { standalone?: boolean };
  if (navAny.standalone === true) return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return false;
  // Recently dismissed?
  try {
    const stamp = window.localStorage.getItem(DISMISS_KEY);
    if (stamp) {
      const at = Number(stamp);
      if (Number.isFinite(at) && Date.now() - at < DISMISS_TTL_MS) return false;
    }
  } catch {
    // localStorage unavailable (private mode, sandboxed iframe). Show
    // anyway; dismissal will simply not persist.
  }
  return true;
}

export function InstallBanner() {
  const { t } = useLocale();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Defer the visibility check until after hydration so we don't
    // mismatch SSR (where window is undefined) with first paint.
    setVisible(shouldShow());
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore
    }
    setVisible(false);
  };

  return (
    <div
      role="status"
      className="fixed inset-x-2 bottom-2 z-30 mx-auto max-w-sm rounded-lg border border-[color:var(--color-rule)] bg-[color:var(--color-paper)] p-3 text-sm shadow-lg pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium">{t("pwa.installIOS.title")}</p>
          <p className="mt-0.5 text-xs leading-snug text-[color:var(--color-muted)]">
            {t("pwa.installIOS.body")}
          </p>
        </div>
        <button
          onClick={dismiss}
          className="flex-shrink-0 text-xs text-[color:var(--color-muted)] underline-offset-4 hover:underline"
          aria-label={t("pwa.installIOS.dismiss")}
        >
          {t("pwa.installIOS.dismiss")}
        </button>
      </div>
    </div>
  );
}
