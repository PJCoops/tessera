"use client";

// X (Twitter) website tag, mounted via a client useEffect to guarantee a
// single execution. We previously used an inline <script> in <head>, but
// React/RSC hydration was re-executing the snippet, which X's Pixel Helper
// flagged as "activated more than once" even with a window-flag guard.
//
// Imperative injection from a useEffect cleanly sidesteps that — the effect
// only fires after mount, only once per page load, and only on the client.
import { useEffect } from "react";

const X_PIXEL_ID = process.env.NEXT_PUBLIC_X_PIXEL_ID;

declare global {
  interface Window {
    twq?: ((...args: unknown[]) => void) & {
      version?: string;
      queue?: unknown[];
      exe?: (...args: unknown[]) => void;
    };
    __twqConfigured?: boolean;
  }
}

export function XPixel() {
  useEffect(() => {
    if (!X_PIXEL_ID) return;
    if (window.__twqConfigured) return;
    window.__twqConfigured = true;

    if (!window.twq) {
      const stub: Window["twq"] = function (...args: unknown[]) {
        if (stub!.exe) stub!.exe.apply(stub, args);
        else stub!.queue!.push(args);
      } as Window["twq"];
      stub!.version = "1.1";
      stub!.queue = [];
      window.twq = stub;

      const s = document.createElement("script");
      s.async = true;
      s.src = "https://static.ads-twitter.com/uwt.js";
      const first = document.getElementsByTagName("script")[0];
      first?.parentNode?.insertBefore(s, first);
    }

    window.twq!("config", X_PIXEL_ID);
  }, []);

  return null;
}
