import type { Metadata } from "next";
import { parseShareSlug, buildShareSlug, type ShareSlug } from "./share";
import { getTier } from "./tier";
import { getDictionary, t, type Locale } from "./i18n";

// Build OG/Twitter metadata for a share slug. Used by both the path-based
// /s/[slug] route and the legacy ?s= query handlers on the home pages.
export function buildShareMetadata(
  slug: ShareSlug,
  locale: Locale
): Metadata {
  const dict = getDictionary(locale);
  const { num, moves, bonus, revealed } = slug;

  const ogParams = new URLSearchParams({ n: String(num) });
  if (moves !== null) ogParams.set("m", String(moves));
  if (bonus) ogParams.set("b", "1");
  if (revealed) ogParams.set("r", "1");
  const ogUrl = `/api/og?${ogParams.toString()}`;

  const localePrefix = locale === "en" ? "" : `/${locale}`;
  const canonical = `${localePrefix}/s/${buildShareSlug(slug)}`;

  if (locale === "es") {
    const moveWord = (n: number) => (n === 1 ? "movimiento" : "movimientos");
    const tierName = moves !== null ? t(dict, `tiers.${getTier(moves).key}`) : "";
    const title = revealed
      ? `Tessera #${num} · solución revelada`
      : moves !== null
      ? `Tessera #${num} · resuelto en ${moves} ${moveWord(moves)}${bonus ? " · bonus" : ""}`
      : `Tessera #${num}`;
    const cardDescription = revealed
      ? "Revelé la solución de hoy. Prueba la partida tú mismo."
      : moves !== null
      ? `${tierName} · resuelto en ${moves} ${moveWord(moves)}${bonus ? ", con las columnas bonus" : ""}. Juega la cuadrícula de hoy.`
      : dict.meta.description;
    return {
      title,
      description: cardDescription,
      openGraph: {
        title,
        description: cardDescription,
        url: canonical,
        images: [{ url: ogUrl, width: 1200, height: 630 }],
        locale: "es_ES",
      },
      twitter: {
        card: "summary_large_image",
        title,
        description: cardDescription,
        images: [ogUrl],
      },
    };
  }

  const swapWord = (n: number) => (n === 1 ? "swap" : "swaps");
  const tierName = moves !== null ? t(dict, `tiers.${getTier(moves).key}`) : "";
  const title = revealed
    ? `Tessera #${num} · revealed`
    : moves !== null
    ? `Tessera #${num} · solved in ${moves} ${swapWord(moves)}${bonus ? " · bonus" : ""}`
    : `Tessera #${num}`;
  const cardDescription = revealed
    ? "I revealed today's solution. Try the puzzle yourself."
    : moves !== null
    ? `${tierName} · solved in ${moves} ${swapWord(moves)}${bonus ? ", with the bonus columns" : ""}. Play today's grid.`
    : dict.meta.description;
  return {
    title,
    description: cardDescription,
    openGraph: {
      title,
      description: cardDescription,
      url: canonical,
      images: [{ url: ogUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: cardDescription,
      images: [ogUrl],
    },
  };
}

export { parseShareSlug };
