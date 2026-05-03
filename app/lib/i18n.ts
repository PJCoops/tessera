// Locale plumbing. English stays at /, Spanish at /es. Adding another locale
// later is: drop a JSON file in app/locales/, add the code to LOCALES, mirror
// app/<code>/ from app/es/. No other code changes required.

import enDict from "../locales/en.json";
import esDict from "../locales/es.json";

export const LOCALES = ["en", "es"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_COOKIE = "tessera:locale";

// English is the source of truth for keys; other dictionaries must satisfy
// the same shape. Missing keys become a TS error.
export type Dictionary = typeof enDict;

const dictionaries: Record<Locale, Dictionary> = {
  en: enDict as Dictionary,
  es: esDict as Dictionary,
};

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

// Pull a value out of a dictionary by dotted path, optionally interpolating
// {placeholders}. Returns the raw key on miss so a missing string is loud
// rather than silent.
export function t(
  dict: Dictionary,
  path: string,
  vars?: Record<string, string | number>
): string {
  const parts = path.split(".");
  let cur: unknown = dict;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return path;
    }
  }
  if (typeof cur !== "string") return path;
  if (!vars) return cur;
  return cur.replace(/\{(\w+)\}/g, (_, k) => {
    const v = vars[k];
    return v === undefined ? `{${k}}` : String(v);
  });
}

// URL-side helpers. Locale lives at the first path segment; English has none.
export function pathnameWithLocale(pathname: string, locale: Locale): string {
  const stripped = stripLocaleFromPathname(pathname);
  if (locale === DEFAULT_LOCALE) return stripped || "/";
  return `/${locale}${stripped === "/" ? "" : stripped}`;
}

export function stripLocaleFromPathname(pathname: string): string {
  for (const loc of LOCALES) {
    if (loc === DEFAULT_LOCALE) continue;
    if (pathname === `/${loc}`) return "/";
    if (pathname.startsWith(`/${loc}/`)) return pathname.slice(loc.length + 1);
  }
  return pathname || "/";
}

export function detectLocaleFromPathname(pathname: string): Locale {
  for (const loc of LOCALES) {
    if (loc === DEFAULT_LOCALE) continue;
    if (pathname === `/${loc}` || pathname.startsWith(`/${loc}/`)) return loc;
  }
  return DEFAULT_LOCALE;
}
