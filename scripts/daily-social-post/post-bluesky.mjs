// Text + link-card post to Bluesky. atproto doesn't auto-unfurl links the way
// X does, so we resolve the homepage Open Graph card ourselves and attach it
// as an `app.bsky.embed.external` record. Free; no media-upload billing.
//
// We hit atproto over plain fetch to keep the runner install footprint small.

const PDS = "https://bsky.social";

async function createSession(handle, password) {
  const res = await fetch(`${PDS}/xrpc/com.atproto.server.createSession`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: handle, password }),
  });
  if (!res.ok) throw new Error(`Bluesky login failed: ${res.status} ${await res.text()}`);
  return res.json(); // { accessJwt, did, handle, ... }
}

// Pull og:title / og:description / og:image out of a page. Naive but adequate:
// we control the page so we know the tags are static + present.
async function fetchOgMeta(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`OG fetch failed: ${res.status}`);
  const html = await res.text();
  const pick = (prop) => {
    const re = new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i");
    const m = html.match(re);
    return m?.[1] ?? null;
  };
  const pickName = (name) => {
    const re = new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, "i");
    const m = html.match(re);
    return m?.[1] ?? null;
  };
  return {
    title: pick("og:title") ?? "Tessera Puzzle",
    description: pick("og:description") ?? pickName("description") ?? "",
    image: pick("og:image"),
  };
}

// Bluesky expects facets (rich text annotations) for links to render as
// clickable. The embed renders the visual card; the facet makes the URL itself
// tappable in the body.
function buildFacets(text) {
  const match = text.match(/https?:\/\/\S+/);
  if (!match) return [];
  const url = match[0];
  const enc = new TextEncoder();
  const byteStart = enc.encode(text.slice(0, match.index)).length;
  const byteEnd = byteStart + enc.encode(url).length;
  return [
    {
      index: { byteStart, byteEnd },
      features: [{ $type: "app.bsky.richtext.facet#link", uri: url }],
    },
  ];
}

async function uploadBlob({ accessJwt, bytes, mimeType }) {
  const res = await fetch(`${PDS}/xrpc/com.atproto.repo.uploadBlob`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessJwt}`,
      "Content-Type": mimeType,
    },
    body: bytes,
  });
  if (!res.ok) throw new Error(`uploadBlob failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.blob; // { $type: "blob", ref, mimeType, size }
}

export async function postToBluesky({ text }) {
  const { BSKY_HANDLE, BSKY_APP_PASSWORD } = process.env;
  if (!BSKY_HANDLE || !BSKY_APP_PASSWORD) {
    throw new Error("Missing Bluesky credentials");
  }

  const linkMatch = text.match(/https?:\/\/\S+/);
  const linkUrl = linkMatch?.[0];

  const session = await createSession(BSKY_HANDLE, BSKY_APP_PASSWORD);

  // Resolve the OG card. Best-effort: if any of this fails, we still post the
  // text — better a card-less post than no post at all.
  let embed = null;
  if (linkUrl) {
    try {
      const og = await fetchOgMeta(linkUrl);
      let thumb = null;
      if (og.image) {
        const imgRes = await fetch(og.image, { redirect: "follow" });
        if (imgRes.ok) {
          const bytes = new Uint8Array(await imgRes.arrayBuffer());
          // Bluesky's blob cap is 1MB; OG images are usually well under, but
          // bail rather than 400 if the page ever serves something huge.
          if (bytes.length <= 1_000_000) {
            const mime = imgRes.headers.get("content-type") || "image/png";
            thumb = await uploadBlob({ accessJwt: session.accessJwt, bytes, mimeType: mime });
          }
        }
      }
      embed = {
        $type: "app.bsky.embed.external",
        external: {
          uri: linkUrl,
          title: og.title,
          description: og.description,
          ...(thumb ? { thumb } : {}),
        },
      };
    } catch (err) {
      console.warn(`[bluesky] OG card unavailable, posting text-only: ${err.message}`);
    }
  }

  const record = {
    $type: "app.bsky.feed.post",
    text,
    createdAt: new Date().toISOString(),
    facets: buildFacets(text),
    langs: ["en"],
    ...(embed ? { embed } : {}),
  };

  const res = await fetch(`${PDS}/xrpc/com.atproto.repo.createRecord`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.accessJwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      repo: session.did,
      collection: "app.bsky.feed.post",
      record,
    }),
  });
  if (!res.ok) throw new Error(`Bluesky post failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.uri;
}
