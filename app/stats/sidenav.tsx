"use client";

// Sidenav for the (authed) stats tree. Two layouts:
//
//   - Desktop (md+): vertical rail with grouped sections (Today /
//     Players / System). Lots of room, group headings help scanning.
//   - Mobile (<md): horizontal pill scroller, flat — group headings
//     would eat too much vertical space and you can't show all 7
//     items at once on a phone anyway. Pills wrap to a single
//     scrollable row that sits just below the page header.
//
// One component, both layouts, controlled by Tailwind responsive
// classes. App Router prefetches Link hrefs on hover, so navigation
// between pages is instant once the data layer warms up.

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string };
type Group = { label: string; items: Item[] };

const GROUPS: Group[] = [
  {
    label: "Today",
    items: [
      { href: "/stats", label: "Overview" },
      { href: "/stats/daily", label: "Daily" },
      { href: "/stats/puzzles", label: "Puzzles" },
    ],
  },
  {
    label: "Players",
    items: [
      { href: "/stats/players", label: "Players" },
      { href: "/stats/cohorts", label: "Cohorts" },
      { href: "/stats/notifications", label: "Notifications" },
    ],
  },
  {
    label: "System",
    items: [{ href: "/stats/health", label: "Health" }],
  },
];

const FLAT_ITEMS: Item[] = GROUPS.flatMap((g) => g.items);

function isActive(pathname: string, href: string): boolean {
  // Active when the path matches exactly (Overview at /stats) or
  // starts with the item's path + "/" (sub-pages we may add later).
  return pathname === href || (href !== "/stats" && pathname.startsWith(href + "/"));
}

export function Sidenav() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop: vertical rail with groups */}
      <nav className="hidden md:block text-sm">
        {GROUPS.map((group) => (
          <div key={group.label} className="mb-6">
            <p className="text-[10px] uppercase tracking-wider text-[color:var(--color-muted)] mb-2">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={
                        active
                          ? "block px-2 py-1 rounded text-[color:var(--color-ink)] bg-[color:var(--color-cream)]"
                          : "block px-2 py-1 rounded text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)] hover:bg-[color:var(--color-cream)]/50"
                      }
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Mobile: horizontal pill scroller. Negative margin pulls the
         scroll edges to the page padding so the first / last pill
         can flush with the screen edge as it scrolls in. */}
      <nav className="md:hidden -mx-4">
        <div className="overflow-x-auto px-4 pb-1 scroll-px-4 [-webkit-overflow-scrolling:touch]">
          <ul className="flex gap-2 whitespace-nowrap">
            {FLAT_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href} className="flex-shrink-0">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={
                      active
                        ? "inline-flex items-center px-3.5 py-2 rounded-full text-sm bg-[color:var(--color-ink)] text-[color:var(--color-paper)]"
                        : "inline-flex items-center px-3.5 py-2 rounded-full text-sm text-[color:var(--color-muted)] border border-[color:var(--color-rule)] hover:text-[color:var(--color-ink)]"
                    }
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
    </>
  );
}
