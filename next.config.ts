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
