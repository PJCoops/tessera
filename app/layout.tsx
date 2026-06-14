import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { headers } from "next/headers";
import { Analytics } from "@vercel/analytics/next";
import { PHProvider } from "./lib/posthog-provider";
import { ConsentProvider } from "./lib/consent";
import { ConsentBanner } from "./components/ConsentBanner";
import { FloatingChrome } from "./components/FloatingChrome";
import { Footer } from "./components/Footer";
import { AccountSync } from "./components/AccountSync";
import { MetaPixel, MetaPixelNoScript } from "./lib/meta-pixel";
import { XPixel } from "./lib/x-pixel";
import "./globals.css";

const description =
  "A daily word puzzle. Swap tiles on a 4×4 grid until every row spells a word, and every column too. Same puzzle for everyone, every day.";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.tesserapuzzle.com"),
  title: { default: "Tessera Puzzle", template: "%s · Tessera Puzzle" },
  description,
  applicationName: "Tessera Puzzle",
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
    title: "Tessera Puzzle",
    description,
    url: "/",
    siteName: "Tessera Puzzle",
    type: "website",
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tessera Puzzle",
    description,
    creator: "@0xCoops",
  },
  manifest: "/manifest.webmanifest",
  // iOS doesn't read the web app manifest — it relies on these meta tags
  // to decide whether the home-screen launch is fullscreen, what colour
  // the status bar is, and what title shows under the icon. Without
  // `capable: true` the app opens in Safari with chrome instead of
  // standalone mode, and push (which requires standalone install on iOS)
  // never becomes available.
  appleWebApp: {
    capable: true,
    title: "Tessera",
    statusBarStyle: "default",
  },
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

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Hide marketing badges (Playlin) on the stats
  // subdomain — they're for the puzzle audience, not the dashboard.
  // Detect via host header rather than pathname so it works both
  // before and after the proxy.ts rewrite.
  //
  // The same flag also gates PostHog, Meta Pixel and the X Pixel: dashboard loads
  // are admin traffic, not players, so we don't want them firing
  // $pageview / PageView events that would inflate the very metrics
  // the dashboard renders. With the tags absent, no init runs, no
  // events fire, and STATS_EXCLUDE_IDS only needs to scrub gameplay
  // distinct_ids (not dashboard ones).
  const host = (await headers()).get("host")?.toLowerCase().split(":")[0] ?? "";
  const isStats = host === "stats.tesserapuzzle.com";

  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        {!isStats && <MetaPixelNoScript />}
        {isStats ? (
          <main className="flex-1 flex flex-col items-center px-4 pt-24 pb-12 sm:pt-16 sm:pb-16">
            <div className="my-auto w-full flex flex-col items-center">{children}</div>
          </main>
        ) : (
        <ConsentProvider>
          <MetaPixel />
          <XPixel />
          <PHProvider>
          <main className="flex-1 flex flex-col items-center px-4 pt-24 pb-12 sm:pt-16 sm:pb-16">
            <div className="my-auto w-full flex flex-col items-center">{children}</div>
          </main>
          <Analytics />
          <AccountSync />
          <FloatingChrome />
          <Footer />
          </PHProvider>
          <ConsentBanner />
        </ConsentProvider>
        )}
      </body>
    </html>
  );
}
