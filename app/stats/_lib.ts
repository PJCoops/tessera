// Shared plumbing for the /stats route tree. Cookie constants, server
// actions, and the EXCLUDE clause moved here so the multi-page split
// doesn't duplicate them across every route. The leading underscore
// keeps Next from treating this as a routable segment.

import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath, updateTag } from "next/cache";

export const COOKIE_NAME = "stats_auth";
// 1 year. Sign in once per device per year. Cookie domain is the
// apex so the same session works on tesserapuzzle.com and
// stats.tesserapuzzle.com — production only; locally we want
// host-only cookies so different ports don't share state.
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
export const COOKIE_DOMAIN =
  process.env.NODE_ENV === "production" ? ".tesserapuzzle.com" : undefined;

// Comma-separated PostHog distinct_ids to exclude from every query, so
// your own test sessions don't pollute the dashboard. Append new IDs
// as you test from new devices (PostHog → Activity → click any event).
function buildExcludeClause(): string {
  const raw = process.env.STATS_EXCLUDE_IDS;
  if (!raw) return "";
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    // HogQL strings are single-quoted; escape any embedded quotes.
    .map((id) => `'${id.replace(/'/g, "''")}'`);
  if (ids.length === 0) return "";
  return ` AND distinct_id NOT IN (${ids.join(",")})`;
}
export const EXCLUDE = buildExcludeClause();

// Returns true when the request has a valid sign-in cookie. Used by
// the (authed) layout to gate every authenticated route.
export async function isAuthenticated(): Promise<boolean> {
  const expected = process.env.STATS_TOKEN;
  if (!expected) return false;
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  return token === expected;
}

// Server action — accepts the form-submitted token, sets cookie, and
// redirects to the Overview. Wrong tokens redirect back to signin
// with `?e=1` so the form can show the error.
export async function signIn(formData: FormData): Promise<void> {
  "use server";
  const token = String(formData.get("t") ?? "");
  const expected = process.env.STATS_TOKEN;
  if (!expected || token !== expected) {
    redirect("/stats/signin?e=1");
  }
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
    domain: COOKIE_DOMAIN,
  });
  redirect("/stats");
}

export async function signOut(): Promise<void> {
  "use server";
  const jar = await cookies();
  jar.delete({ name: COOKIE_NAME, path: "/", domain: COOKIE_DOMAIN });
  redirect("/stats/signin");
}

// Forces a fresh server render AND invalidates every metric in the
// dictionary so unstable_cache entries don't keep serving stale 60s
// values after an explicit Refresh click. revalidatePath alone
// re-renders the page but doesn't touch unstable_cache (independent
// systems in Next 16). updateTag (Server Actions only, which this is)
// expires the tag immediately and the next request waits for fresh
// data — exactly what an explicit Refresh wants.
//
// Accepts the path of the page to revalidate so the same action can
// be reused from every route. Defaults to the route the action is
// mounted in, but the layout always passes the current pathname.
export async function refreshStats(formData?: FormData): Promise<void> {
  "use server";
  const path = (formData?.get("path") as string) ?? "/stats";
  revalidatePath(path, "page");
  updateTag("metrics");
}
