import { NextResponse, type NextRequest } from "next/server";
import { LOCALES, LOCALE_COOKIE, isLocale } from "./app/lib/i18n";

// Two responsibilities:
//
// 1. Host-based routing for stats.tesserapuzzle.com — rewrites all
//    paths to /stats/* so the existing app/stats/* routes serve the
//    subdomain's UI. Also redirects /stats/* on the apex to the
//    subdomain so old bookmarks keep working.
//
// 2. Locale routing on the apex — redirect first-time visitors to
//    /es when their browser prefers Spanish, with a cookie override.

const STATS_HOST = "stats.tesserapuzzle.com";
const APEX_HOSTS = new Set(["tesserapuzzle.com", "www.tesserapuzzle.com"]);

// Detect the user's preferred locale and route them on first visit. English
// stays at /, other locales live at /<code>. Cookie set by the app overrides
// the browser hint so a manual choice sticks.

function pickLocaleFromAcceptLanguage(header: string | null): string | null {
  if (!header) return null;
  // Header format: "es-ES,es;q=0.9,en;q=0.8". We only care about the primary
  // language tag of the highest-quality entry.
  const parts = header
    .split(",")
    .map((s) => {
      const [tag, ...params] = s.trim().split(";");
      const qParam = params.find((p) => p.trim().startsWith("q="));
      const q = qParam ? parseFloat(qParam.split("=")[1]) : 1;
      return { tag: tag.toLowerCase(), q: isNaN(q) ? 1 : q };
    })
    .sort((a, b) => b.q - a.q);
  for (const { tag } of parts) {
    const primary = tag.split("-")[0];
    if ((LOCALES as readonly string[]).includes(primary)) return primary;
  }
  return null;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Vercel hostnames include the port in dev. Normalise.
  const host = (request.headers.get("host") ?? "").toLowerCase().split(":")[0];

  // ---- Stats subdomain ----
  // Rewrite every request on stats.tesserapuzzle.com to /stats/* so
  // the existing dashboard routes serve the subdomain. We return
  // immediately so locale redirects don't fire on the dashboard.
  if (host === STATS_HOST) {
    if (!pathname.startsWith("/stats")) {
      const url = request.nextUrl.clone();
      url.pathname = pathname === "/" ? "/stats" : `/stats${pathname}`;
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // ---- Apex /stats redirect ----
  // Old bookmarks like tesserapuzzle.com/stats now live on the
  // subdomain. 308 keeps the method intact (sign-in form posts).
  if (
    APEX_HOSTS.has(host) &&
    (pathname === "/stats" || pathname.startsWith("/stats/"))
  ) {
    const dest = request.nextUrl.clone();
    dest.host = STATS_HOST;
    dest.pathname = pathname === "/stats" ? "/" : pathname.slice("/stats".length);
    return NextResponse.redirect(dest, 308);
  }

  // Already on a locale-prefixed path: pass through.
  for (const loc of LOCALES) {
    if (loc === "en") continue;
    if (pathname === `/${loc}` || pathname.startsWith(`/${loc}/`)) {
      return NextResponse.next();
    }
  }

  // Cookie wins over Accept-Language. If the user has chosen a locale, honour
  // it on every visit to the bare root.
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieLocale)) {
    if (cookieLocale === "en") return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = `/${cookieLocale}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }

  // No cookie: only redirect on the bare landing page so we don't surprise
  // users coming in on a deep link.
  if (pathname !== "/") return NextResponse.next();

  const browserLocale = pickLocaleFromAcceptLanguage(
    request.headers.get("accept-language")
  );
  if (browserLocale && browserLocale !== "en") {
    const url = request.nextUrl.clone();
    url.pathname = `/${browserLocale}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Skip Next internals, the api routes, and any static asset request.
  matcher: ["/((?!_next|api|ingest|.*\\.[\\w]+$).*)"],
};
