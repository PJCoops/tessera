import type { Metadata } from "next";
import Script from "next/script";
import { TesseraGame } from "./TesseraGame";
import { parseShareSlug, buildShareSlug } from "./lib/share";
import { getTier } from "./lib/tier";

const description =
  "A daily word puzzle. Swap tiles on a 4×4 grid until every row spells a word, and every column too. Same puzzle for everyone, every day.";

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

// When the URL carries a `?s=N-M[-b|-r]` slug (set by buildShareString),
// override the page metadata to point at a per-solve OG image. This is
// what makes pasted Tessera links unfurl as a graphic in iMessage /
// WhatsApp / Twitter / Discord.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const params = await searchParams;
  const raw = typeof params.s === "string" ? params.s : null;
  const parsed = raw ? parseShareSlug(raw) : null;
  if (!parsed) return {};

  const { num, moves, bonus, revealed } = parsed;
  const ogParams = new URLSearchParams({ n: String(num) });
  if (moves !== null) ogParams.set("m", String(moves));
  if (bonus) ogParams.set("b", "1");
  if (revealed) ogParams.set("r", "1");
  const ogUrl = `/api/og?${ogParams.toString()}`;

  const title = revealed
    ? `Tessera #${num} · revealed`
    : moves !== null
    ? `Tessera #${num} · solved in ${moves} ${moves === 1 ? "swap" : "swaps"}${bonus ? " · bonus" : ""}`
    : `Tessera #${num}`;
  const cardDescription =
    revealed
      ? "I revealed today's solution. Try the puzzle yourself."
      : moves !== null
      ? `${getTier(moves).name} · solved in ${moves} ${moves === 1 ? "swap" : "swaps"}${bonus ? ", with the bonus columns" : ""}. Play today's grid.`
      : description;

  return {
    title,
    description: cardDescription,
    openGraph: {
      title,
      description: cardDescription,
      url: `/?s=${buildShareSlug(parsed)}`,
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

export default function Home() {
  return (
    <>
      <Script
        id="ld-json-tessera"
        type="application/ld+json"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(gameSchema) }}
      />
      <TesseraGame />
    </>
  );
}
