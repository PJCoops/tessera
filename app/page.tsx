import type { Metadata } from "next";
import Script from "next/script";
import { TesseraGame } from "./TesseraGame";
import { parseShareSlug } from "./lib/share";
import { buildShareMetadata } from "./lib/share-metadata";
import { LocaleProvider } from "./lib/locale-context";
import { InstallBanner } from "./components/InstallBanner";
import { getDictionary } from "./lib/i18n";

const dict = getDictionary("en");
const description = dict.meta.description;

const gameSchema = {
  "@context": "https://schema.org",
  "@type": "VideoGame",
  name: "Tessera Puzzle",
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
  if (parsed) return buildShareMetadata(parsed, "en");

  // Daily-rolling OG image. Twitter (and other aggressive OG cachers)
  // key their preview cache on the image URL inside the HTML, not the
  // share URL. Without a daily-varying image URL, X's first scrape of
  // /?v=32 returns whatever image was cached for /?v=31 the day before,
  // because the page still advertises the same /opengraph-image hash.
  // Adding the UTC date as a query param produces a fresh image URL
  // every 24h so X re-fetches and stays in sync with the actual puzzle.
  const today = new Date().toISOString().slice(0, 10);
  return {
    openGraph: { images: [{ url: `/opengraph-image?d=${today}`, width: 1200, height: 630 }] },
    twitter: { images: [`/opengraph-image?d=${today}`] },
  };
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
        <InstallBanner />
      </LocaleProvider>
    </>
  );
}
