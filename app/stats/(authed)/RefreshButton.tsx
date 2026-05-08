"use client";

// Client bits for the header Refresh form. The <form> itself stays in
// the server layout (so it can wire up the server action without us
// importing _lib, which is marked 'server-only'). We just supply:
//
//   - the hidden `path` input, populated client-side via usePathname
//     so refreshStats revalidates the route the user is actually on,
//   - the submit button, which uses useFormStatus to show a visible
//     "Refreshing…" pending state. Without this, clicking Refresh on
//     a slow page leaves the UI looking unchanged for seconds.
//
// useFormStatus reads the parent <form>'s pending state — works
// regardless of whether the form is server- or client-rendered.

import { usePathname } from "next/navigation";
import { useFormStatus } from "react-dom";

export function HiddenPath() {
  const pathname = usePathname();
  return <input type="hidden" name="path" value={pathname} />;
}

const BASE = "text-xs underline-offset-4";

export function RefreshSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={
        pending
          ? `${BASE} text-[color:var(--color-muted)] opacity-70 cursor-wait`
          : `${BASE} text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)] hover:underline`
      }
    >
      {pending ? "Refreshing…" : "Refresh"}
    </button>
  );
}
