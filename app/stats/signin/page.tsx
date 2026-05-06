// Sign-in page for /stats. Lives outside the (authed) route group so
// the layout's auth gate doesn't redirect the user away from the
// thing they're trying to authenticate against.
//
// On successful POST the signIn server action redirects to /stats
// (the Overview), which is inside (authed) and will then have a valid
// cookie. On failure, redirects back here with ?e=1.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAuthenticated, signIn } from "../_lib";
import { LoginSubmit } from "../login-submit";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StatsSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string }>;
}) {
  // If you're already signed in, no point showing the form.
  if (await isAuthenticated()) {
    redirect("/stats");
  }

  const params = await searchParams;
  const error = params.e === "1";

  return (
    <div className="self-start w-full max-w-3xl">
      <form className="self-start w-full max-w-xs flex flex-col gap-3" action={signIn}>
        <p className="text-[var(--text-kicker)] uppercase tracking-[var(--tracking-kicker)] text-[color:var(--color-muted)]">
          Tessera · stats
        </p>
        <input
          type="password"
          name="t"
          autoFocus
          placeholder="Token"
          className="px-3 py-2 text-sm border border-[color:var(--color-rule)] rounded-md bg-[color:var(--color-paper)]"
        />
        {error && <p className="text-xs text-red-700">Wrong token.</p>}
        <LoginSubmit />
      </form>
    </div>
  );
}
