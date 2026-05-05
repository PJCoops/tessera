// Web App Manifest. Drives the home-screen icon, splash colour, and
// install prompt across browsers. Spelled out as TS (not the older
// `manifest.webmanifest` static file) so we can keep it typed and edit
// without remembering JSON quirks.
//
// Icons:
//   /icon-192.png            — Android launcher
//   /icon-512.png            — high-DPI Android, splash
//   /icon-512-maskable.png   — adaptive icon (10% safe-area inset)
//
// The 1024×1024 master at app/icon.png stays as the source of truth
// for any future regeneration via scripts/build-pwa-icons.mjs.

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tessera Puzzle",
    short_name: "Tessera",
    description:
      "A daily word puzzle. Swap tiles on a 4×4 grid until every row spells a word.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fafaf7",
    theme_color: "#fafaf7",
    lang: "en-GB",
    categories: ["games", "puzzle"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
