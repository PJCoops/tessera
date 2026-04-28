import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const description =
  "A daily word puzzle. Swap tiles on a 4×4 grid until every row spells a word, and every column too. Same puzzle for everyone, every day.";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.tesserapuzzle.com"),
  title: { default: "Tessera", template: "%s · Tessera" },
  description,
  applicationName: "Tessera",
  authors: [{ name: "Paul Cooper", url: "https://pjcooper.design" }],
  creator: "Paul Cooper",
  publisher: "Paul Cooper",
  keywords: ["daily word puzzle", "word game", "tessera", "puzzle", "4x4", "anagram"],
  category: "game",
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  openGraph: {
    title: "Tessera",
    description,
    url: "/",
    siteName: "Tessera",
    type: "website",
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tessera",
    description,
    creator: "@0xCoops",
  },
  manifest: "/manifest.webmanifest",
  other: {
    "copyright": "© 2026 Paul Cooper",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <main className="flex-1 flex items-center justify-center px-4 py-12 sm:py-16">
          {children}
        </main>
        <footer className="py-6 text-center text-xs text-[color:var(--color-muted)]">
          Made by{" "}
          <a
            href="https://pjcooper.design"
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-4 hover:underline hover:text-[color:var(--color-ink)] transition-colors"
          >
            Paul Cooper
          </a>
          {" · "}
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
      </body>
    </html>
  );
}
