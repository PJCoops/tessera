"use client";

// Bottom-bar consent UI. Shows on first visit (or when CONSENT_VERSION
// bumps) and via the footer "Cookie preferences" link. Three CTAs of equal
// prominence: Accept all / Customise / Keep it minimal. Customise expands
// the panel inline so users don't get bounced into a modal mid-decision.
//
// z-60 sits above everything else — InstallBanner, modals, Playlin badge
// — so we never need to negotiate stacking with those. The page-level
// chrome (Playlin, InstallBanner, footer) is also suppressed until
// `hasDecided` is true to keep the bottom of the screen calm.

import { useState } from "react";
import { useConsent } from "../lib/consent";

export function ConsentBanner() {
  const { bannerOpen, acceptAll, rejectAll, setConsent, consent, closeBanner } =
    useConsent();
  const [showCustomise, setShowCustomise] = useState(false);
  const [draft, setDraft] = useState(consent);

  if (!bannerOpen) return null;

  const handleSave = () => {
    setConsent(draft);
    setShowCustomise(false);
    closeBanner();
  };

  const handleAcceptAll = () => {
    acceptAll();
    setShowCustomise(false);
  };

  const handleReject = () => {
    rejectAll();
    setShowCustomise(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Choose your cookie preferences"
      className="fixed inset-x-2 bottom-2 z-[60] mx-auto max-w-sm rounded-lg border border-[color:var(--color-rule)] bg-[color:var(--color-paper)] p-4 shadow-lg pb-[calc(1rem+env(safe-area-inset-bottom))] md:inset-x-auto md:right-4 md:bottom-4 md:mx-0 md:max-w-sm"
    >
      <p className="text-sm font-medium text-[color:var(--color-ink)]">
        Choose your cookie preferences
      </p>

      {!showCustomise ? (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleAcceptAll}
              className="inline-flex items-center justify-center rounded-full border border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-3.5 py-1.5 text-xs font-medium text-[color:var(--color-paper)] transition-opacity hover:opacity-80"
            >
              Accept all
            </button>
            <button
              type="button"
              onClick={() => setShowCustomise(true)}
              className="inline-flex items-center justify-center rounded-full border border-[color:var(--color-rule)] bg-transparent px-3.5 py-1.5 text-xs font-medium text-[color:var(--color-ink)] transition-colors hover:bg-[color:var(--color-cream)]"
            >
              Customise
            </button>
            <button
              type="button"
              onClick={handleReject}
              className="inline-flex items-center justify-center rounded-full border border-[color:var(--color-rule)] bg-transparent px-3.5 py-1.5 text-xs font-medium text-[color:var(--color-ink)] transition-colors hover:bg-[color:var(--color-cream)]"
            >
              Keep it minimal
            </button>
          </div>
          <div className="mt-3">
            <a
              href="/cookies"
              className="text-[11px] text-[color:var(--color-muted)] underline-offset-4 hover:underline"
            >
              About cookies
            </a>
          </div>
        </>
      ) : (
        <div className="mt-3 space-y-3">
          <CategoryRow
            label="Analytics"
            description="Lets us see if players return day after day, where they get stuck, and what to fix next. Uses PostHog, hosted in the EU."
            checked={draft.analytics}
            onChange={(v) => setDraft((d) => ({ ...d, analytics: v }))}
          />
          <CategoryRow
            label="Marketing"
            description="Lets us measure whether our ads on X and Reddit actually bring people to the game."
            checked={draft.marketing}
            onChange={(v) => setDraft((d) => ({ ...d, marketing: v }))}
          />

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center justify-center rounded-full border border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-3.5 py-1.5 text-xs font-medium text-[color:var(--color-paper)] transition-opacity hover:opacity-80"
            >
              Save preferences
            </button>
            <button
              type="button"
              onClick={handleAcceptAll}
              className="inline-flex items-center justify-center rounded-full border border-[color:var(--color-rule)] bg-transparent px-3.5 py-1.5 text-xs font-medium text-[color:var(--color-ink)] transition-colors hover:bg-[color:var(--color-cream)]"
            >
              Accept all
            </button>
          </div>

          <p className="pt-1 text-[11px] leading-snug text-[color:var(--color-muted)]">
            We always store your streak, theme, and the fact you closed this
            banner. Without these, Tessera can&apos;t function.
          </p>
        </div>
      )}
    </div>
  );
}

function CategoryRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <span className="relative inline-flex items-center w-9 h-5 flex-shrink-0 mt-0.5">
        <input
          type="checkbox"
          className="sr-only peer"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="absolute inset-0 rounded-full bg-[color:var(--color-cream)] border border-[color:var(--color-rule)] peer-checked:bg-[color:var(--color-ink)] peer-checked:border-[color:var(--color-ink)] transition-colors" />
        <span className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-[color:var(--color-paper)] shadow transition-transform peer-checked:translate-x-4" />
      </span>
      <span className="flex-1">
        <span className="block text-xs font-medium text-[color:var(--color-ink)]">
          {label}
        </span>
        <span className="mt-0.5 block text-[11px] leading-snug text-[color:var(--color-muted)]">
          {description}
        </span>
      </span>
    </label>
  );
}
