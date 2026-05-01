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
};

export default nextConfig;
