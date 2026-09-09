// GET /api/v1/app-config
//
// Client bootstrap: the lowest supported client version (forced-update
// gate, §16.2), an optional one-shot "what's new" card, and dark-launch
// feature flags (§21). No auth; edge-cached briefly so a flag flip
// propagates within minutes.
//
// Required env: none. Optional:
//   MIN_SUPPORTED_VERSION   default "1.0.0"
//   WHATS_NEW               JSON `{ "id", "title", "body" }` or unset
//   APP_FLAGS               JSON object of string -> boolean

import { appConfigResponseSchema } from "../../../lib/api/v1-schema";

const CACHE = "public, s-maxage=300, stale-while-revalidate=60";

function weakETag(body: string): string {
  let h = 5381;
  for (let i = 0; i < body.length; i++) h = (h * 33) ^ body.charCodeAt(i);
  return `W/"${(h >>> 0).toString(36)}"`;
}

function parseJsonEnv<T>(name: string, fallback: T): T {
  const raw = process.env[name];
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    console.error(`app-config: ${name} is not valid JSON, ignoring`);
    return fallback;
  }
}

export async function GET(req: Request): Promise<Response> {
  const whatsNewRaw = parseJsonEnv<{ id?: string; title?: string; body?: string } | null>(
    "WHATS_NEW",
    null,
  );
  const whatsNew =
    whatsNewRaw && whatsNewRaw.id && whatsNewRaw.title && whatsNewRaw.body
      ? { id: whatsNewRaw.id, title: whatsNewRaw.title, body: whatsNewRaw.body }
      : null;

  const payload = appConfigResponseSchema.parse({
    minSupportedVersion: process.env.MIN_SUPPORTED_VERSION ?? "1.0.0",
    whatsNew,
    flags: parseJsonEnv<Record<string, boolean>>("APP_FLAGS", {}),
  });

  const bodyText = JSON.stringify(payload);
  const etag = weakETag(bodyText);
  if (req.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag, "Cache-Control": CACHE } });
  }
  return new Response(bodyText, {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": CACHE, ETag: etag },
  });
}
