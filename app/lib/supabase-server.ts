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

// Authenticated user id for API routes. getUser() validates the JWT with
// the auth server rather than trusting the cookie payload.
export async function getUserId(): Promise<string | null> {
  const supabase = await createServerSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}
