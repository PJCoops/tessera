import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Reverse-proxy PostHog through our own origin so tracking-blockers (uBlock,
  // Brave shields, etc.) don't preemptively block requests to eu.i.posthog.com.
  // Without this we lose 30-50% of events.
  async rewrites() {
    return [
      { source: "/ingest/static/:path*", destination: "https://eu-assets.i.posthog.com/static/:path*" },
      { source: "/ingest/:path*", destination: "https://eu.i.posthog.com/:path*" },
      { source: "/ingest/decide", destination: "https://eu.i.posthog.com/decide" },
      // Browsers and link-preview crawlers probe these legacy fixed paths
      // regardless of the <link rel> tags Next emits. In this Next version
      // file-based metadata serves icons at /icon.png (from app/icon.png) and
      // /apple-icon.png (from app/apple-icon.png) — NOT at these root paths —
      // so the probes 404 without these rewrites. Map them to the canonical
      // routes so the same branded assets are served.
      { source: "/favicon.ico", destination: "/icon.png" },
      { source: "/apple-touch-icon.png", destination: "/apple-icon.png" },
      { source: "/apple-touch-icon-precomposed.png", destination: "/apple-icon.png" },
    ];
  },
  // Required for the rewrites above so trailing-slash handling doesn't bounce
  // requests away from PostHog.
  skipTrailingSlashRedirect: true,

  // Service worker is served from `public/sw.js`. We need it to update
  // promptly when we redeploy (otherwise users keep an old worker until
  // they manually evict it), and to be served with the right MIME type
  // so browsers will register it. Per the Next 16 PWA guide.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
