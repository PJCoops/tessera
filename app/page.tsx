import Script from "next/script";
import { TesseraGame } from "./TesseraGame";

const description =
  "A daily word puzzle. Swap tiles on a 4×4 grid until every row spells a word, and every column too. Same puzzle for everyone, every day.";

const gameSchema = {
  "@context": "https://schema.org",
  "@type": "VideoGame",
  name: "Tessera",
  url: "https://tesserapuzzle.com",
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
