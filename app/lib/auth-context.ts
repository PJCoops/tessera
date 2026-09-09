// Authenticated request context with a "how recently did they prove who
// they are" signal, for sensitive operations like account deletion
// (docs/flutter-app-spec.md §6.3). Supabase access tokens carry an `amr`
// (authentication methods reference) claim: an array of
// `{ method, timestamp }`. The newest timestamp is the last time the user
// actually authenticated (OTP verify, OAuth), which survives silent token
// refreshes — unlike `iat`.

import { bearerToken, createServerSupabase } from "./supabase-server";

export type AuthContext = {
  userId: string;
  email: string | null;
  /** ms since epoch of the most recent real authentication, or null. */
  authTimeMs: number | null;
};

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const json = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function authTimeFromClaims(claims: Record<string, unknown> | null): number | null {
  if (!claims) return null;
  const amr = claims.amr;
  if (Array.isArray(amr)) {
    const stamps = amr
      .map((e) => (e && typeof e === "object" ? (e as { timestamp?: unknown }).timestamp : undefined))
      .filter((t): t is number => typeof t === "number");
    if (stamps.length) return Math.max(...stamps) * 1000;
  }
  // Fall back to the session's issued-at as a weak signal.
  return typeof claims.iat === "number" ? claims.iat * 1000 : null;
}

export async function getAuthContext(req?: Request): Promise<AuthContext | null> {
  const supabase = await createServerSupabase();
  if (!supabase) return null;
  const bearer = bearerToken(req);
  try {
    const { data: userData, error } = bearer
      ? await supabase.auth.getUser(bearer)
      : await supabase.auth.getUser();
    if (error || !userData.user) return null;
    let token = bearer;
    if (!token) {
      const { data: sessionData } = await supabase.auth.getSession();
      token = sessionData.session?.access_token;
    }
    return {
      userId: userData.user.id,
      email: userData.user.email ?? null,
      authTimeMs: token ? authTimeFromClaims(decodeJwtPayload(token)) : null,
    };
  } catch {
    return null;
  }
}

/** True when the user authenticated within the last `maxAgeMs` (default 5 min). */
export function isFreshAuth(ctx: AuthContext, maxAgeMs = 5 * 60_000): boolean {
  return ctx.authTimeMs != null && Date.now() - ctx.authTimeMs <= maxAgeMs;
}
