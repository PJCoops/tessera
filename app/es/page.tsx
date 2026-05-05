import type { Metadata } from "next";
import Script from "next/script";
import { TesseraGame } from "../TesseraGame";
import { parseShareSlug } from "../lib/share";
import { buildShareMetadata } from "../lib/share-metadata";
import { LocaleProvider } from "../lib/locale-context";
import { InstallBanner } from "../components/InstallBanner";
import { getDictionary } from "../lib/i18n";

const dict = getDictionary("es");

const gameSchema = {
  "@context": "https://schema.org",
  "@type": "VideoGame",
  name: "Tessera Puzzle",
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
  return buildShareMetadata(parsed, "es");
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
        <InstallBanner />
      </LocaleProvider>
    </>
  );
}
