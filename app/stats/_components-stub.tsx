// Tiny placeholder for sidenav routes that haven't been populated
// yet. Used by the Daily / Puzzles / Players / Cohorts /
// Notifications / Health stubs while the split continues. Lives
// outside the (authed) tree so it doesn't get a layout-level
// sidenav nested inside itself.

export function Stub({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h1 className="text-2xl font-light tracking-tight mb-4">{title}</h1>
      <div className="rounded-md border border-[color:var(--color-rule)] bg-[color:var(--color-cream)] p-6 text-sm text-[color:var(--color-muted)] max-w-prose">
        <p>{body}</p>
        <p className="mt-3">
          <a
            href="/stats"
            className="underline-offset-4 hover:underline text-[color:var(--color-ink)]"
          >
            Back to Overview
          </a>
        </p>
      </div>
    </div>
  );
}
