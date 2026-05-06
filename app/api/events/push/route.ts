// Server-side analytics relay for push events fired from the service
// worker. SWs can't use posthog-js (no DOM, no localStorage for the
// distinct_id), so they POST a small body here and we forward it to
// PostHog's capture endpoint.
//
// We don't try to attribute these events to a known PostHog user —
// the SW has no distinct_id. We pass an `endpoint_hash` derived from
// the push subscription endpoint instead, which is stable per device
// per origin. That's enough to answer "how many sends turned into
// clicks?" without needing user identity.
//
// Public endpoint (no auth) — the worst-case abuse is someone fires
// push_received events to inflate counts. Low-impact, not worth
// gating; we can rate-limit later if it becomes a problem.

import { NextRequest, NextResponse } from "next/server";

const ALLOWED_EVENTS = ["push_received", "push_clicked"] as const;
type PushEventName = (typeof ALLOWED_EVENTS)[number];

type Body = {
  event?: string;
  endpoint_hash?: string;
  tag?: string;
  url?: string;
};

export async function POST(req: NextRequest) {
  const phHost = (process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com").trim();
  const phKey = (process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "").trim();
  if (!phKey) {
    return NextResponse.json({ ok: false, reason: "posthog_not_configured" }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, reason: "bad_json" }, { status: 400 });
  }

  const event = body.event ?? "";
  if (!ALLOWED_EVENTS.includes(event as PushEventName)) {
    return NextResponse.json({ ok: false, reason: "bad_event" }, { status: 400 });
  }

  // Build a distinct_id that's stable per push subscription. The SW
  // sends us the endpoint_hash already; if missing we fall back to
  // a request-derived shadow so the event still lands but with
  // weaker attribution.
  const distinct_id = body.endpoint_hash || `sw-${req.headers.get("x-forwarded-for") ?? "anon"}`;

  // PostHog's /capture/ accepts an unauthenticated POST with the
  // public project key. Properties carry context for the funnel.
  const properties: Record<string, string | undefined> = {
    $current_url: body.url,
    push_tag: body.tag,
    push_endpoint_hash: body.endpoint_hash,
    distinct_id,
  };

  try {
    await fetch(`${phHost}/capture/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: phKey,
        event,
        distinct_id,
        properties,
        timestamp: new Date().toISOString(),
      }),
      // keepalive helps if the SW's request is racing the click handler
      // (Cloudflare/Safari can otherwise abort short-lived fetches).
      keepalive: true,
    });
  } catch (e) {
    console.error("[push-events]", e);
    return NextResponse.json({ ok: false, reason: "upstream" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
