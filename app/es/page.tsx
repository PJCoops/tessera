import type { Metadata } from "next";
import Script from "next/script";
import { TesseraGame } from "../TesseraGame";
import { parseShareSlug, buildShareSlug } from "../lib/share";
import { getTier } from "../lib/tier";
import { LocaleProvider } from "../lib/locale-context";
import { getDictionary } from "../lib/i18n";

const dict = getDictionary("es");

const gameSchema = {
  "@context": "https://schema.org",
  "@type": "VideoGame",
  name: "Tessera",
  url: "https://www.tesserapuzzle.com/es",
  description: dict.meta.description,
  author: { "@type": "Person", name: "Paul Cooper", url: "https://pjcooper.design" },
  creator: { "@type": "Person", name: "Paul Cooper", url: "https://pjcooper.design" },
  genre: ["Casual", "Puzzle", "Word"],
  gamePlatform: ["Web browser"],
  applicationCategory: "Game",
  operatingSystem: "Any",
  inLanguage: "es-ES",
  datePublished: "2026-04-27",
  offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const params = await searchParams;
  const raw = typeof params.s === "string" ? params.s : null;
  const parsed = raw ? parseShareSlug(raw) : null;
  if (!parsed) {
    return {
      title: dict.meta.title,
      description: dict.meta.description,
      alternates: {
        canonical: "/es",
        languages: { en: "/", es: "/es" },
      },
      openGraph: {
        title: dict.meta.title,
        description: dict.meta.description,
        url: "/es",
        locale: "es_ES",
      },
    };
  }

  const { num, moves, bonus, revealed } = parsed;
  const ogParams = new URLSearchParams({ n: String(num) });
  if (moves !== null) ogParams.set("m", String(moves));
  if (bonus) ogParams.set("b", "1");
  if (revealed) ogParams.set("r", "1");
  const ogUrl = `/api/og?${ogParams.toString()}`;

  const title = revealed
    ? `Tessera #${num} · solución revelada`
    : moves !== null
    ? `Tessera #${num} · resuelto en ${moves} ${moves === 1 ? "movimiento" : "movimientos"}${bonus ? " · bonus" : ""}`
    : `Tessera #${num}`;
  const cardDescription =
    revealed
      ? "Revelé la solución de hoy. Prueba la partida tú mismo."
      : moves !== null
      ? `${getTier(moves).name} · resuelto en ${moves} ${moves === 1 ? "movimiento" : "movimientos"}${bonus ? ", con las columnas bonus" : ""}. Juega la cuadrícula de hoy.`
      : dict.meta.description;

  return {
    title,
    description: cardDescription,
    openGraph: {
      title,
      description: cardDescription,
      url: `/es?s=${buildShareSlug(parsed)}`,
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

export default function HomeEs() {
  return (
    <>
      <Script
        id="ld-json-tessera-es"
        type="application/ld+json"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(gameSchema) }}
      />
      <LocaleProvider locale="es">
        <TesseraGame />
      </LocaleProvider>
    </>
  );
}
