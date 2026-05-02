"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "./lib/analytics";

const DISMISSED_KEY = "tessera:email-dismissed";
const SUBSCRIBED_KEY = "tessera:email-subscribed";

type Status = "idle" | "submitting" | "ok" | "error";

export function hasSubscribed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SUBSCRIBED_KEY) === "1";
  } catch {
    return false;
  }
}
export function hasDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

// Compact inline signup. Dropped into the result panel after a solve,
// and into the History modal as a low-priority CTA. Hidden once the
// player either subscribes or dismisses.
export function EmailSignup({
  source,
  onDismiss,
  compact = false,
}: {
  source: string;
  onDismiss?: () => void;
  compact?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [hidden, setHidden] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (hasSubscribed() || hasDismissed()) setHidden(true);
  }, []);

  if (hidden) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source }),
      });
      if (!res.ok) {
        setStatus("error");
        return;
      }
      try {
        window.localStorage.setItem(SUBSCRIBED_KEY, "1");
      } catch {}
      track("email_subscribed", { source });
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  };

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {}
    setHidden(true);
    onDismiss?.();
  };

  if (status === "ok") {
    return (
      <p
        className={`text-[color:var(--color-muted)] ${
          compact ? "text-[11px]" : "text-xs"
        }`}
      >
        Subscribed. We&rsquo;ll send tomorrow&rsquo;s grid at 09:00 UTC.
      </p>
    );
  }

  return (
    <div
      className={`border border-[color:var(--color-rule)] rounded-md bg-[color:var(--color-cream)] ${
        compact ? "p-3" : "p-4"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className={`font-medium ${compact ? "text-xs" : "text-sm"}`}>
          Daily reminder
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="text-[10px] text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)] underline-offset-4 hover:underline"
        >
          No thanks
        </button>
      </div>
      <p
        className={`text-[color:var(--color-muted)] mt-1 ${
          compact ? "text-[11px]" : "text-xs"
        }`}
      >
        One email at 09:00 UTC with today&rsquo;s puzzle. Unsubscribe whenever.
      </p>
      <form onSubmit={submit} className="mt-3 flex gap-2">
        <input
          ref={inputRef}
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          spellCheck={false}
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={status === "submitting"}
          className="flex-1 min-w-0 rounded-md border border-[color:var(--color-rule)] bg-[color:var(--color-paper)] px-3 py-2 text-sm placeholder:text-[color:var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ink)]/20"
        />
        <button
          type="submit"
          disabled={status === "submitting"}
          className="px-3 py-2 text-xs bg-[color:var(--color-ink)] text-[color:var(--color-paper)] rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {status === "submitting" ? "Sending…" : "Remind me"}
        </button>
      </form>
      {status === "error" && (
        <p className="mt-2 text-[11px] text-red-700">
          Something went wrong. Check the address and try again.
        </p>
      )}
    </div>
  );
}
