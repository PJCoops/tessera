import type { Metadata } from "next";
import Script from "next/script";
import { TesseraGame } from "../TesseraGame";
import { parseShareSlug } from "../lib/share";
import { buildShareMetadata } from "../lib/share-metadata";
import { LocaleProvider } from "../lib/locale-context";
import { InstallBanner } from "../components/InstallBanner";
import { getDictionary } from "../lib/i18n";
import { HARD } from "../lib/mode";

const dict = getDictionary("en");
const description = dict.meta.descriptionHard ?? dict.meta.description;

const gameSchema = {
  "@context": "https://schema.org",
  "@type": "VideoGame",
  name: "Tessera Puzzle (Hard)",
  url: "https://www.tesserapuzzle.com/hard",
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
      title: dict.meta.titleHard ?? `${dict.meta.title} · Hard`,
      description,
      alternates: { canonical: "/hard" },
    };
  }
  return buildShareMetadata({ ...parsed, mode: "hard" }, "en");
}

export default function HardHome() {
  return (
    <>
      <Script
        id="ld-json-tessera-hard"
        type="application/ld+json"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(gameSchema) }}
      />
      <LocaleProvider locale="en">
        <TesseraGame mode={HARD} />
        <InstallBanner />
      </LocaleProvider>
    </>
  );
}
