"use client";

// Daily push reminder opt-in for Settings. Mirrors the visual shape of
// the other SettingRow entries in HowToPlay.tsx so it slots in cleanly
// without exposing SettingRow itself. Self-contained: holds its own
// async state, runs the service-worker registration on mount, and
// handles the full subscribe/unsubscribe flow against /api/push/*.
//
// State machine (matches `Status` below):
//   - loading      first paint, while we figure out what's possible
//   - unsupported  no PushManager (e.g. desktop Safari pre-16, Firefox
//                  in private mode, ancient browsers) — toggle hidden
//   - iosNotInstalled  on iPhone Safari but not yet added to Home Screen.
//                  iOS only allows web push in standalone PWAs.
//   - denied       user previously blocked notifications. Toggle hidden;
//                  hint tells them to fix it in browser settings.
//   - idle         supported, allowed, no subscription yet (toggle off)
//   - subscribed   active subscription stored server-side (toggle on)
//   - busy         async work in progress (subscribing/unsubscribing)
//
// Once a subscription exists we keep the local PushSubscription handle
// in state so unsubscribing doesn't require another round-trip to the
// browser to look it up.

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "../lib/locale-context";

type Status =
  | "loading"
  | "unsupported"
  | "iosNotInstalled"
  | "denied"
  | "idle"
  | "subscribed"
  | "busy";

// Convert the URL-safe base64 VAPID public key (which is what the
// browser surfaces in env vars) into the Uint8Array shape the Push API
// requires. We back the view with a fresh ArrayBuffer (not the default
// ArrayBufferLike inferred from `new Uint8Array(n)`) so the narrowed
// `BufferSource` type pushManager.subscribe() expects accepts it.
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i++) view[i] = rawData.charCodeAt(i);
  return view;
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  // iOS Safari uses a non-standard property here.
  const navAny = navigator as Navigator & { standalone?: boolean };
  return navAny.standalone === true;
}

export function PushReminderToggle() {
  const { locale, t } = useLocale();
  const [status, setStatus] = useState<Status>("loading");
  const [previousStatus, setPreviousStatus] = useState<Status>("loading");
  // Cache the active subscription so unsubscribe doesn't have to re-fetch.
  const subRef = useRef<PushSubscription | null>(null);

  // Initial probe: figure out which state we're in. Runs on mount and
  // never again — the user toggling away from this view doesn't change
  // browser support, and a permission grant always goes through our
  // own flow which updates state directly.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supported =
        typeof navigator !== "undefined" &&
        "serviceWorker" in navigator &&
        typeof window !== "undefined" &&
        "PushManager" in window;
      if (!supported) {
        if (!cancelled) setStatus("unsupported");
        return;
      }
      if (isIOS() && !isStandalone()) {
        if (!cancelled) setStatus("iosNotInstalled");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setStatus("denied");
        return;
      }

      // Register (or re-use) the service worker. updateViaCache: 'none'
      // ensures the browser doesn't serve a stale sw.js after a deploy.
      try {
        await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (cancelled) return;
        if (existing) {
          subRef.current = existing;
          setStatus("subscribed");
        } else {
          setStatus("idle");
        }
      } catch (e) {
        // Failed to register the SW (sandboxed iframe, devtools blocking
        // SW, etc). Treat as unsupported rather than showing a misleading
        // toggle.
        console.error("SW register failed:", e);
        if (!cancelled) setStatus("unsupported");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const subscribe = useCallback(async () => {
    setPreviousStatus(status);
    setStatus("busy");
    try {
      // Permission must be requested in direct response to a user
      // gesture. We're inside a click handler so this is fine.
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setStatus(perm === "denied" ? "denied" : "idle");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapid) {
        // Misconfigured deploy — keys missing. Let the user retry but
        // surface an unsubscribed state.
        console.error("NEXT_PUBLIC_VAPID_PUBLIC_KEY missing");
        setStatus("idle");
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid),
      });
      subRef.current = sub;

      // Send to the server. PushSubscription serialises via toJSON();
      // we forward both endpoint and the encryption keys.
      const json = sub.toJSON() as {
        endpoint?: string;
        keys?: { p256dh?: string; auth?: string };
      };
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subscription: { endpoint: json.endpoint, keys: json.keys },
          locale,
        }),
      });
      if (!res.ok) throw new Error(`subscribe API ${res.status}`);

      setStatus("subscribed");
    } catch (e) {
      console.error("push subscribe failed:", e);
      // Best guess: roll back to where we were before the click.
      setStatus(previousStatus === "subscribed" ? "subscribed" : "idle");
    }
  }, [locale, status, previousStatus]);

  const unsubscribe = useCallback(async () => {
    setPreviousStatus(status);
    setStatus("busy");
    try {
      const sub = subRef.current ?? (await (await navigator.serviceWorker.ready).pushManager.getSubscription());
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        subRef.current = null;
        // Best-effort server cleanup; failure here is not user-visible.
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint, locale }),
        }).catch(() => {});
      }
      setStatus("idle");
    } catch (e) {
      console.error("push unsubscribe failed:", e);
      setStatus("subscribed");
    }
  }, [locale, status]);

  // ----- Render -----

  const title = t("settings.reminder.title");
  let description = t("settings.reminder.description");
  let control: React.ReactNode = null;

  if (status === "unsupported") {
    description = t("settings.reminder.unsupported");
  } else if (status === "iosNotInstalled") {
    description = t("settings.reminder.iosNotInstalled");
  } else if (status === "denied") {
    description = t("settings.reminder.denied");
  } else if (status === "loading") {
    // First paint: show description but no control yet to avoid the
    // toggle visibly flicking from off → on after the SW probe.
    control = null;
  } else {
    const checked = status === "subscribed";
    const busy = status === "busy";
    const onChange = (next: boolean) => (next ? subscribe() : unsubscribe());
    control = (
      <label
        className={`relative inline-flex items-center w-10 h-6 ${busy ? "cursor-wait opacity-60" : "cursor-pointer"}`}
      >
        <input
          type="checkbox"
          className="sr-only peer"
          checked={checked}
          disabled={busy}
          onChange={(e) => onChange(e.target.checked)}
          aria-label={title}
        />
        <span className="absolute inset-0 rounded-full bg-[color:var(--color-cream)] border border-[color:var(--color-rule)] peer-checked:bg-[color:var(--color-ink)] peer-checked:border-[color:var(--color-ink)] transition-colors" />
        <span className="absolute left-0.5 top-0.5 w-5 h-5 rounded-full bg-[color:var(--color-paper)] shadow transition-transform peer-checked:translate-x-4" />
      </label>
    );
  }

  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-4">
        <p className="font-medium">{title}</p>
        {control && <div className="flex-shrink-0">{control}</div>}
      </div>
      <p className="text-[color:var(--color-muted)] mt-0.5 text-xs leading-snug">{description}</p>
    </div>
  );
}
