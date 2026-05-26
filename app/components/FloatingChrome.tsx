"use client";

// Subreddit pill and Playlin badge. Pulled out of layout.tsx so they can
// suppress themselves until the consent banner has been dismissed —
// otherwise three floating elements compete for the same mobile real
// estate on first visit.

import { useConsent } from "../lib/consent";

export function FloatingChrome() {
  const { hasDecided } = useConsent();
  if (!hasDecided) return null;

  return (
    <>
      <a
        href="https://www.reddit.com/r/TesseraPuzzle/"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="r/TesseraPuzzle on Reddit"
        className="fixed bottom-4 left-1/2 -translate-x-1/2 md:left-4 md:translate-x-0 z-20 inline-flex items-center px-4 py-1.5 rounded-full bg-[#1A1A1A] text-white text-[11px] tracking-wide opacity-70 hover:opacity-100 transition-opacity"
      >
        r/TesseraPuzzle
      </a>
      <a
        href="https://playlin.io/game/tessera-daily-word-puzzle/"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Featured on Playlin"
        className="hidden md:block fixed bottom-4 right-4 z-40 opacity-70 hover:opacity-100 transition-opacity"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://cdn.playlin.io/creators/featured-dark.svg"
          alt="Tessera Puzzle featured on Playlin"
          width={140}
        />
      </a>
    </>
  );
}
