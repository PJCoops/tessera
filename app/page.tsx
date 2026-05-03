import type { Metadata } from "next";
import Script from "next/script";
import { TesseraGame } from "./TesseraGame";
import { parseShareSlug } from "./lib/share";
import { buildShareMetadata } from "./lib/share-metadata";
import { LocaleProvider } from "./lib/locale-context";
import { getDictionary } from "./lib/i18n";

const dict = getDictionary("en");
const description = dict.meta.description;

const gameSchema = {
  "@context": "https://schema.org",
  "@type": "VideoGame",
  name: "Tessera",
  url: "https://www.tesserapuzzle.com",
  description,
  author: { "@type": "Person", name: "Paul Cooper", url: "https://pjcooper.design" },
  creator: { "@type": "Person", name: "Paul Cooper", url: "https://pjcooper.design" },
  genre: ["Casual", "Puzzle", "Word"],
  gamePlatform: ["Web browser"],
  applicationCategory: "Game",
  operatingSystem: "Any",
  inLanguage: "en-GB",
  datePublished: "2026-04-27",
  offers: { "@type": "Offer", price: "0", priceCurrency: "GBP" },
};

// Legacy `?s=N-M[-b|-r]` shares (pre-/s/[slug] route) still need to unfurl
// with a per-solve OG card. New shares use /s/[slug] directly.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const params = await searchParams;
  const raw = typeof params.s === "string" ? params.s : null;
  const parsed = raw ? parseShareSlug(raw) : null;
  if (!parsed) return {};
  return buildShareMetadata(parsed, "en");
}

export default function Home() {
  return (
    <>
      <Script
        id="ld-json-tessera"
        type="application/ld+json"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(gameSchema) }}
      />
      <LocaleProvider locale="en">
        <TesseraGame />
      </LocaleProvider>
    </>
  );
}
