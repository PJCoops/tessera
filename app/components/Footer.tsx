"use client";

// Always-visible footer with social links, privacy, terms, and "Cookie
// preferences" entry point. The cookie link reopens the consent banner so
// users can change their choices after the initial decision. Suppressed
// until the user has dismissed the consent banner so the first visit
// stays uncluttered.

import Link from "next/link";
import type { ReactNode } from "react";
import { useConsent } from "../lib/consent";

type Social = { href: string; label: string; icon: ReactNode };

const iconProps = {
  viewBox: "0 0 24 24",
  width: 16,
  height: 16,
  "aria-hidden": true,
} as const;

const socials: Social[] = [
  {
    href: "https://www.reddit.com/r/TesseraPuzzle/",
    label: "r/TesseraPuzzle on Reddit",
    icon: (
      <svg {...iconProps} viewBox="-269 361 72 72" fill="currentColor">
        <path d="m-233 433c-19.9 0-36-16.1-36-36s16.1-36 36-36 36 16.1 36 36-16.1 36-36 36z" />
        <path
          fillRule="evenodd"
          d="m-224.8 404.5c-2.1 0-3.7-1.7-3.7-3.7 0-2.1 1.7-3.8 3.7-3.8s3.7 1.7 3.7 3.8c.1 2-1.6 3.7-3.7 3.7m.7 6.2c-2.6 2.6-7.5 2.8-8.9 2.8s-6.3-.2-8.9-2.8c-.4-.4-.4-1 0-1.4s1-.4 1.4 0c1.6 1.6 5.1 2.2 7.5 2.2 2.5 0 5.9-.6 7.5-2.2.4-.4 1-.4 1.4 0s.4 1 0 1.4m-20.9-9.9c0-2.1 1.7-3.8 3.8-3.8s3.7 1.7 3.7 3.8-1.7 3.7-3.7 3.7c-2.1 0-3.8-1.7-3.8-3.7m36-3.8c0-2.9-2.4-5.3-5.3-5.3-1.4 0-2.7.6-3.6 1.5-3.6-2.6-8.5-4.3-14-4.5l2.4-11.3 7.8 1.7c.1 2 1.7 3.6 3.7 3.6 2.1 0 3.7-1.7 3.7-3.7 0-2.1-1.7-3.7-3.7-3.7-1.5 0-2.7.9-3.3 2.1l-8.7-1.9c-.2-.1-.5 0-.7.1s-.4.3-.4.6l-2.6 12.3v.2c-5.6.1-10.6 1.8-14.3 4.4-.9-.9-2.2-1.5-3.6-1.5-2.9 0-5.3 2.4-5.3 5.3 0 2.1 1.3 4 3.1 4.8-.1.5-.1 1.1-.1 1.6 0 8.1 9.4 14.6 21 14.6s21-6.5 21-14.6c0-.5 0-1.1-.1-1.6 1.7-.7 3-2.6 3-4.7"
          fill="var(--color-paper)"
        />
      </svg>
    ),
  },
  {
    href: "https://x.com/tessera_puzzle",
    label: "Tessera on X",
    icon: (
      <svg {...iconProps} fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    href: "https://www.facebook.com/profile.php?id=61589313921815",
    label: "Tessera on Facebook",
    icon: (
      <svg {...iconProps} fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  {
    href: "https://www.instagram.com/tesserapuzzle/",
    label: "Tessera on Instagram",
    icon: (
      <svg {...iconProps} fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    ),
  },
];

export function Footer() {
  const { openBanner, hasDecided } = useConsent();

  if (!hasDecided) return null;

  return (
    <footer className="px-4 py-6 flex flex-col items-center gap-3 text-[11px] text-[color:var(--color-muted)]">
      <ul className="flex items-center gap-4">
        {socials.map((s) => (
          <li key={s.href}>
            <a
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={s.label}
              className="block opacity-60 hover:opacity-100 transition-opacity"
            >
              {s.icon}
            </a>
          </li>
        ))}
      </ul>
      <div>
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
      </div>
    </footer>
  );
}
