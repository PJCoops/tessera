"use client";

// X (Twitter) website tag, mounted via a client useEffect to guarantee a
// single execution. We previously used an inline <script> in <head>, but
// React/RSC hydration was re-executing the snippet, which X's Pixel Helper
// flagged as "activated more than once" even with a window-flag guard.
//
// Gated by consent.marketing — only loads when the user explicitly opts in.
// If consent is later withdrawn, we tear down window.twq (so analytics.ts
// stops firing X events) and clear _twq_* cookies. The script tag itself
// can't be cleanly unloaded once browsers have parsed it, but with twq()
// removed it's inert.
import { useEffect } from "react";
import { useConsent } from "./consent";

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

function clearTwqCookies() {
  if (typeof document === "undefined") return;
  const host = window.location.hostname;
  const parts = host.split(".");
  const parentDomain = parts.length > 1 ? "." + parts.slice(-2).join(".") : host;
  document.cookie.split(";").forEach((c) => {
    const name = c.trim().split("=")[0];
    if (name.startsWith("_twq") || name === "muc_ads" || name === "personalization_id") {
      document.cookie = `${name}=; Max-Age=0; Path=/`;
      document.cookie = `${name}=; Max-Age=0; Path=/; Domain=${parentDomain}`;
    }
  });
}

export function XPixel() {
  const { consent } = useConsent();

  useEffect(() => {
    if (!X_PIXEL_ID) return;

    if (!consent.marketing) {
      // Either never consented, or consent withdrawn after init. Tear down.
      if (window.__twqConfigured) {
        delete window.twq;
        window.__twqConfigured = false;
        clearTwqCookies();
      }
      return;
    }

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
  }, [consent.marketing]);

  return null;
}
