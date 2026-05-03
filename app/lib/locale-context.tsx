"use client";

import { createContext, useCallback, useContext, useEffect, useMemo } from "react";
import posthog from "posthog-js";
import {
  type Dictionary,
  type Locale,
  LOCALE_COOKIE,
  getDictionary,
  t as translate,
} from "./i18n";

type LocaleContextValue = {
  locale: Locale;
  dict: Dictionary;
  t: (path: string, vars?: Record<string, string | number>) => string;
};

const Ctx = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const dict = useMemo(() => getDictionary(locale), [locale]);

  // Keep <html lang>, the cookie, and PostHog's session-wide event
  // properties aligned with the route the user is on. Registering
  // `language` here means every analytics event captured for the rest of
  // the session carries it as a property — no individual track() call
  // needs updating, and the /stats dashboard can group by it.
  useEffect(() => {
    if (document.documentElement.lang !== locale) {
      document.documentElement.lang = locale;
    }
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
    try {
      posthog.register({ language: locale });
    } catch {
      // analytics must never break gameplay
    }
  }, [locale]);

  const t = useCallback(
    (path: string, vars?: Record<string, string | number>) => translate(dict, path, vars),
    [dict]
  );

  const value = useMemo<LocaleContextValue>(() => ({ locale, dict, t }), [locale, dict, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLocale(): LocaleContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLocale must be used inside a <LocaleProvider>");
  return v;
}
