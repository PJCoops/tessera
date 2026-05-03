"use client";

import { createContext, useCallback, useContext, useEffect, useMemo } from "react";
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

  // Keep <html lang> and the cookie aligned with the route the user is on, so
  // assistive tech, browser language tooling, and proxy redirects all stay in
  // sync without a server round-trip.
  useEffect(() => {
    if (document.documentElement.lang !== locale) {
      document.documentElement.lang = locale;
    }
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
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
