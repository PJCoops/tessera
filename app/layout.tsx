import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { PHProvider } from "./lib/posthog-provider";
import { MetaPixelHead, MetaPixelNoScript } from "./lib/meta-pixel";
import "./globals.css";

const description =
  "A daily word puzzle. Swap tiles on a 4×4 grid until every row spells a word, and every column too. Same puzzle for everyone, every day.";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.tesserapuzzle.com"),
  title: { default: "Tessera: Daily Word Puzzle", template: "%s · Tessera" },
  description,
  applicationName: "Tessera",
  authors: [{ name: "Paul Cooper", url: "https://pjcooper.design" }],
  creator: "Paul Cooper",
  publisher: "Paul Cooper",
  keywords: ["daily word puzzle", "word game", "tessera", "puzzle", "4x4", "anagram"],
  category: "game",
  alternates: {
    canonical: "/",
    languages: { en: "/", es: "/es" },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  openGraph: {
    title: "Tessera: Daily Word Puzzle",
    description,
    url: "/",
    siteName: "Tessera",
    type: "website",
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tessera: Daily Word Puzzle",
    description,
    creator: "@0xCoops",
  },
  manifest: "/manifest.webmanifest",
  verification: {
    other: {
      "facebook-domain-verification": "b7ev056dvv1igdi829y8b4kj7t2ob3",
    },
  },
  other: {
    "copyright": "© 2026 Paul Cooper",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0e0e" },
  ],
  colorScheme: "light dark",
};

// Runs before React hydration to set the theme class synchronously and avoid a
// flash of the wrong palette. Must stay tiny and side-effect-free.
const themeInitScript = `(function(){try{var t=localStorage.getItem('tessera:theme');if(t==='dark'||t==='light'){document.documentElement.classList.add(t);}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
        <MetaPixelHead />
      </head>
      <body className="min-h-full flex flex-col">
        <MetaPixelNoScript />
        <PHProvider>
          <main className="flex-1 flex items-center justify-center px-4 py-12 sm:py-16">
            {children}
          </main>
          <footer className="py-6 text-center text-xs text-[color:var(--color-muted)]">
            <a
              href="https://www.reddit.com/r/TesseraPuzzle/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-4 hover:underline hover:text-[color:var(--color-ink)] transition-colors"
            >
              r/TesseraPuzzle
            </a>
          </footer>
          <Analytics />
          {/* External directory badges. Fixed to viewport corners so they
             stay visible without intruding on the puzzle. Hidden on small
             screens where they'd overlap the grid. */}
          <a
            href="https://www.producthunt.com/products/tessera-5?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-tessera-5"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Featured on Product Hunt"
            className="ph-badge ph-badge-light hidden md:block fixed bottom-4 left-4 z-40 opacity-70 hover:opacity-100 transition-opacity"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="Tessera - A 4x4 word puzzle where rows and columns have to spell words | Product Hunt"
              width={180}
              height={39}
              src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1134416&theme=neutral&t=1777651610297"
            />
          </a>
          <a
            href="https://www.producthunt.com/products/tessera-5?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-tessera-5"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Featured on Product Hunt"
            className="ph-badge ph-badge-dark hidden md:block fixed bottom-4 left-4 z-40 opacity-70 hover:opacity-100 transition-opacity"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="Tessera - A 4x4 word puzzle where rows and columns have to spell words | Product Hunt"
              width={180}
              height={39}
              src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1134416&theme=dark&t=1777805167587"
            />
          </a>
          <a
            href="https://playlin.io/game/tessera-daily-word-puzzle/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Featured on Playlin"
            className="hidden md:block fixed bottom-4 right-4 z-40 opacity-70 hover:opacity-100 transition-opacity"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://cdn.playlin.io/creators/featured-dark.svg"
              alt="Tessera: Daily Word Puzzle featured on Playlin"
              width={140}
            />
          </a>
        </PHProvider>
      </body>
    </html>
  );
}
