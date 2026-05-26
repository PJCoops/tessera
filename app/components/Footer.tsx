"use client";

// Always-visible footer with privacy, terms, and "Cookie preferences" entry
// point. The cookie link reopens the consent banner so users can change
// their choices after the initial decision. Suppressed until the user has
// dismissed the consent banner so the first visit stays uncluttered.

import Link from "next/link";
import { useConsent } from "../lib/consent";

export function Footer() {
  const { openBanner, hasDecided } = useConsent();

  if (!hasDecided) return null;

  return (
    <footer className="px-4 py-6 text-center text-[11px] text-[color:var(--color-muted)]">
      <Link href="/privacy" className="underline-offset-4 hover:underline">
        Privacy
      </Link>
      <span className="mx-2" aria-hidden>
        ·
      </span>
      <Link href="/terms" className="underline-offset-4 hover:underline">
        Terms
      </Link>
      <span className="mx-2" aria-hidden>
        ·
      </span>
      <button
        type="button"
        onClick={openBanner}
        className="underline-offset-4 hover:underline"
      >
        Cookie preferences
      </button>
    </footer>
  );
}
