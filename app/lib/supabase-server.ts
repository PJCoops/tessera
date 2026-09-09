import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Supabase client bound to the request's auth cookies. Null when env is
// unset so callers can return the standard 503 not_configured.
export async function createServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const store = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            store.set(name, value, options);
          }
        } catch {
          // cookies() is read-only outside route handlers and server
          // actions. Reads still work; session refresh happens client-side.
        }
      },
    },
  });
}

/** Extracts a `Bearer <jwt>` access token from a request's Authorization
 *  header. Native clients (Flutter) send the Supabase access token this
 *  way; the web sends nothing and auth falls back to the SSR cookies. */
export function bearerToken(req?: Request): string | undefined {
  const header = req?.headers.get("authorization") ?? "";
  const m = header.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : undefined;
}

// Authenticated user id for API routes. getUser() validates the JWT with
// the auth server rather than trusting the cookie payload. Pass `req` to
// allow a `Bearer` access token (mobile) in addition to the SSR cookies.
export async function getUserId(req?: Request): Promise<string | null> {
  const supabase = await createServerSupabase();
  if (!supabase) return null;
  const token = bearerToken(req);
  try {
    const { data, error } = token
      ? await supabase.auth.getUser(token)
      : await supabase.auth.getUser();
    if (error) return null;
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}
