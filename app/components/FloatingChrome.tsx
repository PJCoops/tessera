"use client";

// Playlin badge. Pulled out of layout.tsx so it can suppress itself
// until the consent banner has been dismissed.

import { useConsent } from "../lib/consent";

export function FloatingChrome() {
  const { hasDecided } = useConsent();
  if (!hasDecided) return null;

  return (
    <a
      href="https://playlin.io/game/tessera-daily-word-puzzle/"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Featured on Playlin"
      className="hidden md:block fixed top-4 right-4 z-40 opacity-70 hover:opacity-100 transition-opacity"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://cdn.playlin.io/creators/featured-dark.svg"
        alt="Tessera Puzzle featured on Playlin"
        width={140}
      />
    </a>
  );
}
