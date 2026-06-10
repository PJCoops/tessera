import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createServerSupabase } from "../../../lib/supabase-server";

// Lands magic-link clicks and sets the session cookies. Lives under /api
// so the locale proxy never touches it (a tessera:locale=es cookie
// redirects bare paths to /es/*). The Supabase email templates must point
// here instead of the default verify URL:
//   {{ .SiteURL }}/api/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const next = params.get("next") ?? "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  const redirect = (path: string) =>
    NextResponse.redirect(new URL(path, req.nextUrl.origin));

  if (!tokenHash || !type) return redirect("/?auth=invalid");
  const supabase = await createServerSupabase();
  if (!supabase) return redirect("/?auth=unconfigured");
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) return redirect("/?auth=expired");
  return redirect(safeNext);
}
