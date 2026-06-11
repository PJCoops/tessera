"use client";

import { useEffect, useRef } from "react";
import posthog from "posthog-js";
import { accountsEnabled, useSupabaseUser } from "../lib/supabase-browser";
import { syncAll } from "../lib/sync";
import { track } from "../lib/analytics";

// Invisible orchestrator mounted once in the root layout. On sign-in (or
// any load while signed in) it identifies the user in PostHog and runs a
// two-way sync, once per browser session per user.
export function AccountSync() {
  const { user } = useSupabaseUser();
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!accountsEnabled()) return;

    if (!user) {
      // Sign-out: drop the PostHog identity so subsequent events are
      // anonymous again. Only fires on a real transition, not initial load.
      if (lastUserId.current !== null) {
        lastUserId.current = null;
        try {
          posthog.reset();
        } catch {}
      }
      return;
    }
    lastUserId.current = user.id;

    try {
      posthog.identify(user.id);
    } catch {}

    const guard = `tessera:synced:${user.id}`;
    try {
      if (window.sessionStorage.getItem(guard) === "1") return;
    } catch {}

    let cancelled = false;
    void (async () => {
      const counts = await syncAll();
      if (cancelled || !counts) return;
      try {
        window.sessionStorage.setItem(guard, "1");
      } catch {}
      track("sync_completed", { pushed: counts.pushed, pulled: counts.pulled });
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return null;
}
