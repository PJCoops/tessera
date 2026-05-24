import fs from "node:fs";

// Posts a photo to a Facebook Page via the Graph API.
// FB_PAGE_ACCESS_TOKEN must be a long-lived Page access token with
// pages_manage_posts + pages_read_engagement scopes.

const GRAPH_VERSION = "v21.0";

export async function postToFacebook({ imagePath, message }) {
  const { FB_PAGE_ID, FB_PAGE_ACCESS_TOKEN } = process.env;
  if (!FB_PAGE_ID || !FB_PAGE_ACCESS_TOKEN) {
    throw new Error("Missing Facebook Page credentials");
  }

  const form = new FormData();
  form.append("message", message);
  form.append("access_token", FB_PAGE_ACCESS_TOKEN);
  form.append(
    "source",
    new Blob([fs.readFileSync(imagePath)], { type: "image/png" }),
    "puzzle.png",
  );

  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${FB_PAGE_ID}/photos`,
    { method: "POST", body: form },
  );
  if (!res.ok) throw new Error(`Facebook post failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.post_id || json.id || null;
}
