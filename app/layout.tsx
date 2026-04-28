import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const description =
  "A daily word puzzle. Swap tiles on a 4×4 grid until every row spells a word, and every column too. Same puzzle for everyone, every day.";

export const metadata: Metadata = {
  metadataBase: new URL("https://tesserapuzzle.com"),
  title: { default: "Tessera", template: "%s · Tessera" },
  description,
  applicationName: "Tessera",
  authors: [{ name: "Paul Cooper", url: "https://pjcooper.design" }],
  creator: "Paul Cooper",
  openGraph: {
    title: "Tessera",
    description,
    url: "/",
    siteName: "Tessera",
    type: "website",
    locale: "en_GB",
  },
  twitter: { card: "summary_large_image", title: "Tessera", description },
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
