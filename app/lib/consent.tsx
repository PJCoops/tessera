"use client";

// Cookie consent state. Two opt-ins layered on top of always-on essentials:
//
//   - analytics : upgrades PostHog from cookieless (memory persistence, no
//                 $ip, no cross-session ID) to full (localStorage ID, IP,
//                 retention cohorts). Cookieless analytics runs regardless;
//                 this flag controls the *upgrade*.
//   - marketing : permission to load and fire marketing pixels (currently
//                 X; Reddit + Meta when re-enabled via env).
//
// Persisted in the `tessera_consent` cookie (first-party, 12-month expiry)
// so it survives across subdomains and is readable server-side if we ever
// need to gate server endpoints. Cookie shape is intentionally tiny.
//
// CONSENT_VERSION bumps re-prompt the user. Bump it whenever the categories
// change meaning (e.g. adding a new tracker outside the existing
// categories, or materially changing what's collected).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export const CONSENT_VERSION = 1;
const COOKIE_NAME = "tessera_consent";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 12 months

export type ConsentState = {
  /** Bumped when categories change meaning. Mismatch = re-prompt. */
  v: number;
  /** Full PostHog (persistent ID + IP). Cookieless mode runs regardless. */
  analytics: boolean;
  /** X / Reddit / Meta pixels — only those with env vars set. */
  marketing: boolean;
  /** Epoch ms of the decision. */
  t: number;
};

export type ConsentContextValue = {
  /** True once the user has made an explicit choice this version. */
  hasDecided: boolean;
  /** Current toggle values. Strictly-necessary is always implicitly on. */
  consent: Pick<ConsentState, "analytics" | "marketing">;
  /** Apply a partial update, persists immediately. */
  setConsent: (next: Partial<Pick<ConsentState, "analytics" | "marketing">>) => void;
  /** Set both toggles to true. */
  acceptAll: () => void;
  /** Set both toggles to false. The "keep it minimal" path. */
  rejectAll: () => void;
  /** Re-open the banner from the footer link. */
  openBanner: () => void;
  /** True while the bottom-bar banner should be shown. */
  bannerOpen: boolean;
  /** Close the banner without changing state (used internally after a choice). */
  closeBanner: () => void;
};

const defaultConsent: Pick<ConsentState, "analytics" | "marketing"> = {
  analytics: false,
  marketing: false,
};

const ConsentContext = createContext<ConsentContextValue | null>(null);

function readCookie(): ConsentState | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;
  try {
    const raw = decodeURIComponent(match.split("=").slice(1).join("="));
    const parsed = JSON.parse(raw) as ConsentState;
    if (typeof parsed.v !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCookie(state: ConsentState): void {
  if (typeof document === "undefined") return;
  const value = encodeURIComponent(JSON.stringify(state));
  // SameSite=Lax is fine for first-party preference. Secure required in prod
  // but breaks on http://localhost; we set it conditionally.
  const secure = typeof window !== "undefined" && window.location.protocol === "https:"
    ? "; Secure"
    : "";
  document.cookie = `${COOKIE_NAME}=${value}; Max-Age=${COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
}

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  // Start as "not decided" on every render so SSR and the first client paint
  // agree. We resolve the real cookie value in the effect below.
  const [hasDecided, setHasDecided] = useState(false);
  const [consent, setConsentState] = useState(defaultConsent);
  const [bannerOpen, setBannerOpen] = useState(false);

  useEffect(() => {
    // Cookie is browser-only; reading it during render would mismatch SSR
    // (where document is undefined) against the first client paint. The
    // canonical fix is to render defaults server-side, then resolve the
    // real value on mount.
    const existing = readCookie();
    if (existing && existing.v === CONSENT_VERSION) {
      // Hydrate state from the cookie on first mount. See note above.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConsentState({
        analytics: !!existing.analytics,
        marketing: !!existing.marketing,
      });
      setHasDecided(true);
      setBannerOpen(false);
    } else {
      // No cookie, or version bump: prompt.
      setHasDecided(false);
      setBannerOpen(true);
    }
  }, []);

  const persist = useCallback(
    (next: Pick<ConsentState, "analytics" | "marketing">) => {
      const state: ConsentState = {
        v: CONSENT_VERSION,
        analytics: next.analytics,
        marketing: next.marketing,
        t: Date.now(),
      };
      writeCookie(state);
      setConsentState(next);
      setHasDecided(true);
      setBannerOpen(false);
    },
    []
  );

  const setConsent = useCallback(
    (partial: Partial<Pick<ConsentState, "analytics" | "marketing">>) => {
      setConsentState((prev) => {
        const merged = { ...prev, ...partial };
        const state: ConsentState = {
          v: CONSENT_VERSION,
          analytics: merged.analytics,
          marketing: merged.marketing,
          t: Date.now(),
        };
        writeCookie(state);
        setHasDecided(true);
        return merged;
      });
    },
    []
  );

  const acceptAll = useCallback(() => {
    persist({ analytics: true, marketing: true });
  }, [persist]);

  const rejectAll = useCallback(() => {
    persist({ analytics: false, marketing: false });
  }, [persist]);

  const openBanner = useCallback(() => {
    setBannerOpen(true);
  }, []);

  const closeBanner = useCallback(() => {
    setBannerOpen(false);
  }, []);

  const value = useMemo<ConsentContextValue>(
    () => ({
      hasDecided,
      consent,
      setConsent,
      acceptAll,
      rejectAll,
      openBanner,
      bannerOpen,
      closeBanner,
    }),
    [hasDecided, consent, setConsent, acceptAll, rejectAll, openBanner, bannerOpen, closeBanner]
  );

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext);
  if (!ctx) {
    // Failsafe so a stray hook call doesn't crash gameplay. Returns "no
    // consent, no banner" — pixels stay off, analytics stays cookieless.
    return {
      hasDecided: false,
      consent: defaultConsent,
      setConsent: () => {},
      acceptAll: () => {},
      rejectAll: () => {},
      openBanner: () => {},
      bannerOpen: false,
      closeBanner: () => {},
    };
  }
  return ctx;
}
