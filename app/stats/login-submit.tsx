"use client";

// Submit button for the stats sign-in form. Server actions don't show
// any pending state by default, so the button felt frozen between
// click and the redirect — which can be several seconds on a Vercel
// cold start. useFormStatus reads the parent <form>'s pending flag
// without needing prop-drilling, so this stays a drop-in.

import { useFormStatus } from "react-dom";

export function LoginSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-4 py-2 text-sm bg-[color:var(--color-ink)] text-[color:var(--color-paper)] rounded-md hover:opacity-90 disabled:opacity-60 disabled:cursor-wait transition-opacity"
    >
      {pending ? "Signing in…" : "Open"}
    </button>
  );
}
