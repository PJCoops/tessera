"use client";

// Meta Pixel install. Mounted via a client useEffect so the inline
// script only renders client-side — sidesteps the hydration mismatch
// that an inline <script dangerouslySetInnerHTML={...}> in <head>
// triggers when a browser extension (Phantom/etc) modifies the HTML
// before React hydrates, and avoids any chance of double-firing.
//
// Same pattern as x-pixel.tsx; see that file for prior art.
//
// Currently env-disabled (NEXT_PUBLIC_META_PIXEL_ID unset). When re-enabled,
// gating by consent.marketing applies automatically.
//
// No reverse proxy here on purpose: Meta's fbevents.js hardcodes its
// event endpoint, so a URL rewrite doesn't help much. The right
// bypass for adblocker losses is the Conversions API (server-side),
// which dedupes against this Pixel via a shared event_id.

import { useEffect } from "react";
import { useConsent } from "./consent";

const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

type FbqStub = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[][];
  push?: (...args: unknown[]) => void;
  loaded?: boolean;
  version?: string;
};

declare global {
  interface Window {
    fbq?: FbqStub;
    _fbq?: FbqStub;
    __metaPixelConfigured?: boolean;
  }
}

function clearFbpFbcCookies() {
  if (typeof document === "undefined") return;
  const host = window.location.hostname;
  const parts = host.split(".");
  const parentDomain = parts.length > 1 ? "." + parts.slice(-2).join(".") : host;
  ["_fbp", "_fbc"].forEach((name) => {
    document.cookie = `${name}=; Max-Age=0; Path=/`;
    document.cookie = `${name}=; Max-Age=0; Path=/; Domain=${parentDomain}`;
  });
}

export function MetaPixel() {
  const { consent } = useConsent();

  useEffect(() => {
    if (!META_PIXEL_ID) return;

    if (!consent.marketing) {
      if (window.__metaPixelConfigured) {
        delete window.fbq;
        delete window._fbq;
        window.__metaPixelConfigured = false;
        clearFbpFbcCookies();
      }
      return;
    }

    if (window.__metaPixelConfigured) return;
    window.__metaPixelConfigured = true;

    if (!window.fbq) {
      const stub: FbqStub = function (...args: unknown[]) {
        if (stub.callMethod) stub.callMethod.apply(stub, args);
        else stub.queue!.push(args);
      } as FbqStub;
      if (!window._fbq) window._fbq = stub;
      stub.push = stub as unknown as FbqStub["push"];
      stub.loaded = true;
      stub.version = "2.0";
      stub.queue = [];
      window.fbq = stub;

      const t = document.createElement("script");
      t.async = true;
      t.src = "https://connect.facebook.net/en_US/fbevents.js";
      const first = document.getElementsByTagName("script")[0];
      first?.parentNode?.insertBefore(t, first);
    }

    window.fbq!("init", META_PIXEL_ID);
    window.fbq!("track", "PageView");
  }, [consent.marketing]);

  return null;
}

export function MetaPixelNoScript() {
  // No-op when consent is not granted. Rendered server-side, so we use a
  // sibling client component to gate it; for now since the pixel is
  // env-disabled the function returns null and the gating is moot. When
  // re-enabled, switch this to read consent via a client wrapper.
  if (!META_PIXEL_ID) return null;
  return (
    <noscript>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        height="1"
        width="1"
        style={{ display: "none" }}
        src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
        alt=""
      />
    </noscript>
  );
}
