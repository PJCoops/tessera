// Server-side Conversions API endpoint. The browser fires fbq() AND POSTs
// here with the same event_id; Meta dedupes via that id so we don't
// double-count. CAPI catches users with adblockers (the entire point) and
// improves match quality by sending IP / UA / fbp / fbc cookies that the
// browser-side Pixel may not have access to in cross-site contexts.
//
// Token never leaves the server. Failures are swallowed and logged; analytics
// must never break gameplay.
import { NextRequest, NextResponse } from "next/server";

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const CAPI_TOKEN = process.env.META_CAPI_TOKEN;
const GRAPH_VERSION = "v21.0";

type EventBody = {
  event_name?: string;
  event_id?: string;
  event_source_url?: string;
  custom_data?: Record<string, unknown>;
};

export async function POST(req: NextRequest) {
  if (!PIXEL_ID || !CAPI_TOKEN) {
    return NextResponse.json({ ok: false, reason: "not configured" });
  }

  let body: EventBody;
  try {
    body = (await req.json()) as EventBody;
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid json" }, { status: 400 });
  }
  const { event_name, event_id, event_source_url, custom_data } = body;
  if (!event_name || !event_id) {
    return NextResponse.json({ ok: false, reason: "missing fields" }, { status: 400 });
  }

  // Pull the matching signals Meta uses to tie this event back to a user.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    undefined;
  const ua = req.headers.get("user-agent") ?? undefined;
  const fbp = req.cookies.get("_fbp")?.value;
  const fbc = req.cookies.get("_fbc")?.value;

  const payload = {
    data: [
      {
        event_name,
        event_time: Math.floor(Date.now() / 1000),
        event_id,
        action_source: "website",
        event_source_url: event_source_url ?? undefined,
        user_data: {
          client_ip_address: ip,
          client_user_agent: ua,
          fbp: fbp ?? undefined,
          fbc: fbc ?? undefined,
        },
        custom_data: custom_data ?? undefined,
      },
    ],
  };

  try {
    const url = `https://graph.facebook.com/${GRAPH_VERSION}/${PIXEL_ID}/events?access_token=${encodeURIComponent(CAPI_TOKEN)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("[meta-capi]", res.status, text);
      return NextResponse.json({ ok: false, status: res.status });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[meta-capi] fetch failed", err);
    return NextResponse.json({ ok: false });
  }
}
