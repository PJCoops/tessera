"use client";

import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";

// Module-scope init runs once on the client. The `typeof window` guard keeps
// SSR happy; the missing-key guard keeps preview branches without env vars
// from crashing.
if (typeof window !== "undefined") {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (key) {
    posthog.init(key, {
      // Send ingestion through our own origin (proxied via next.config.ts
      // rewrites) so adblockers don't kill the requests. ui_host keeps
      // PostHog's UI links pointing at the real dashboard.
      api_host: "/ingest",
      ui_host: "https://eu.posthog.com",
      capture_pageview: true,
      // $pageleave doubles pageview volume without us using dwell-time
      // anywhere in the stats dashboard.
      capture_pageleave: false,
      // $web_vitals fires multiple events per pageview and was the bulk
      // of our PostHog bill. We have no perf-monitoring use case for it.
      capture_performance: false,
      // Belt-and-braces: we never enabled session recording, but this
      // keeps it from being toggled on accidentally from the dashboard.
      disable_session_recording: true,
      // Autocapture would log every tile tap and burn through the event
      // budget; we only want the explicit events declared in analytics.ts.
      autocapture: false,
      persistence: "localStorage",
    });
  }
}

export function PHProvider({ children }: { children: React.ReactNode }) {
  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}
