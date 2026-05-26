// Shared wrapper for /privacy, /cookies, /terms. Restrained typography,
// matches the rest of Tessera's aesthetic. No em dashes anywhere in the
// rendered content — house style.

import Link from "next/link";

export function LegalPage({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:py-16">
      <Link
        href="/"
        className="text-xs text-[color:var(--color-muted)] underline-offset-4 hover:underline"
      >
        ← Back to puzzle
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-[color:var(--color-ink)]">
        {title}
      </h1>
      <p className="mt-1 text-xs text-[color:var(--color-muted)]">
        Last updated {lastUpdated}
      </p>
      <div className="legal-prose mt-8 text-[14px] leading-relaxed text-[color:var(--color-ink)]">
        {children}
      </div>
    </div>
  );
}
