"use client";

// Sidenav for the (authed) stats tree. Highlights the current path so
// you always know where you are. Single component so changing the
// nav order is a one-file edit. Pages live as plain links — App
// Router prefetches on hover, so navigation feels instant once the
// other pages are populated.
//
// Sections grouped:
//   - Today: Overview, Daily, Puzzles
//   - Players: Players, Cohorts, Notifications
//   - System: Health (cron manifest, audit)

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

export function Sidenav() {
  const pathname = usePathname();
  return (
    <nav className="text-sm">
      {GROUPS.map((group) => (
        <div key={group.label} className="mb-6">
          <p className="text-[10px] uppercase tracking-wider text-[color:var(--color-muted)] mb-2">
            {group.label}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              // Active when the path matches exactly (Overview at /stats)
              // or starts with the item's path + "/" (sub-pages).
              const active =
                pathname === item.href ||
                (item.href !== "/stats" && pathname.startsWith(item.href + "/"));
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
  );
}
