// Layout for every authenticated stats page. Three responsibilities:
//
//   1. Auth gate — redirect to /stats/signin if the cookie is missing
//      or invalid, so individual pages don't repeat the check.
//   2. Sidenav — sticky on desktop, collapses to a top tab strip on
//      mobile. The Sidenav component reads the current pathname so
//      the active item is always highlighted.
//   3. Header — shows when this server render happened, plus Refresh
//      and Sign out buttons. Refresh calls the shared refreshStats
//      action which revalidates the current path AND invalidates
//      every metric in the dictionary cache (updateTag('metrics')),
//      so a click actually pulls fresh data, not stale.
//
// Children render in the main content area. Each child page only
// fetches the data it needs — that's the perf benefit of the split.

import { redirect } from "next/navigation";
import { isAuthenticated, refreshStats, signOut } from "../_lib";
import { Sidenav } from "../sidenav";

export const dynamic = "force-dynamic";

export default async function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isAuthenticated())) {
    redirect("/stats/signin");
  }

  // Page-relative timestamp. Each child page renders independently so
  // this stamps when the layout last rendered — close enough to "when
  // the user opened this view" for our purposes.
  const fetchedAt = new Date().toISOString().slice(11, 19);

  return (
    <div className="self-start w-full max-w-6xl">
      <header className="mb-6 flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[var(--text-kicker)] uppercase tracking-[var(--tracking-kicker)] text-[color:var(--color-muted)]">
            Tessera · stats
          </p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-[color:var(--color-muted)] tabular-nums">
            Fetched {fetchedAt} UTC
          </p>
          <form action={refreshStats}>
            <button
              type="submit"
              className="text-xs text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)] underline-offset-4 hover:underline"
            >
              Refresh
            </button>
          </form>
          <form action={signOut}>
            <button
              type="submit"
              className="text-xs text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)] underline-offset-4 hover:underline"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="flex flex-col md:flex-row gap-8">
        <aside className="md:w-44 md:flex-shrink-0 md:sticky md:top-6 md:self-start">
          <Sidenav />
        </aside>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
