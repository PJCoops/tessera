"use client";

import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { useEffect } from "react";
import { useConsent } from "./consent";

// PostHog runs in two modes:
//
//   Cookieless (default, no consent required)
//     - persistence: "memory" — distinct_id resets each page session
//     - $ip dropped via property_blacklist — no IP-based geolocation stored
//     - aggregate stats only: DAU, completion rates, event counts
//     - no retention cohorts, no multi-session funnels
//
//   Full (after explicit consent.analytics opt-in)
//     - persistence: "localStorage" — distinct_id stable across sessions
//     - $ip included — geographic distribution
//     - retention, cohorts, multi-session funnels
//
// The cookieless default lets us run analytics under legitimate interest
// without a consent gate, which is the position PostHog and the ICO both
// support for truly anonymous aggregate analytics. The upgrade requires
// explicit opt-in (consent.analytics === true).
//
// We init in cookieless mode on mount, then upgrade or downgrade in response
// to consent changes. Init runs at most once per page session.

const COMMON_CONFIG = {
  api_host: "/ingest",
  ui_host: "https://eu.posthog.com",
  capture_pageview: true,
  capture_pageleave: false,
  capture_performance: false,
  disable_session_recording: true,
  autocapture: false,
};

// Module-scope init so PostHog is ready before any child component effect
// can fire a track() call. Defaulting to cookieless mode keeps the
// no-consent posture; PHProvider upgrades or re-downgrades in response to
// consent changes below.
if (typeof window !== "undefined") {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (key) {
    posthog.init(key, {
      ...COMMON_CONFIG,
      persistence: "memory",
      property_blacklist: ["$ip"],
    });
  }
}

function reconfigure(analyticsConsent: boolean) {
  if (typeof window === "undefined") return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

  if (analyticsConsent) {
    posthog.set_config({
      persistence: "localStorage",
      property_blacklist: [],
    });
    posthog.opt_in_capturing();
  } else {
    // Drop any persisted ID before switching to memory, otherwise the old
    // ID would linger in localStorage even though the SDK is no longer
    // writing to it.
    posthog.reset();
    posthog.set_config({
      persistence: "memory",
      property_blacklist: ["$ip"],
    });
  }
}

// Init already put us in cookieless mode, so only diverge from that on a
// real consent change. Skipping the no-op reconfigure avoids an early
// posthog.reset() that would split the initial $pageview and the first
// puzzle_started across two distinct_ids.
let lastApplied: boolean | null = null;

export function PHProvider({ children }: { children: React.ReactNode }) {
  const { consent } = useConsent();

  useEffect(() => {
    if (lastApplied === null && consent.analytics === false) {
      lastApplied = false;
      return;
    }
    if (lastApplied === consent.analytics) return;
    lastApplied = consent.analytics;
    reconfigure(consent.analytics);
  }, [consent.analytics]);

  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}
