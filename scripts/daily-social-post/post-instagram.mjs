// Posts a single photo to Instagram via the Graph API.
//
// IG publishing is a two-step flow: create a media container (referencing a
// public image URL — Instagram fetches it server-side), then publish the
// container. The site's OG image route returns a stable PNG, so no extra
// hosting is needed.
//
// FB_PAGE_ACCESS_TOKEN must have instagram_basic + instagram_content_publish
// scopes (in addition to the existing pages_* scopes used for the FB post).

const GRAPH_VERSION = "v21.0";

export async function postToInstagram({ imageUrl, caption }) {
  const { IG_USER_ID, FB_PAGE_ACCESS_TOKEN } = process.env;
  if (!IG_USER_ID || !FB_PAGE_ACCESS_TOKEN) {
    throw new Error("Missing Instagram credentials");
  }

  const containerUrl = new URL(
    `https://graph.facebook.com/${GRAPH_VERSION}/${IG_USER_ID}/media`,
  );
  containerUrl.searchParams.set("image_url", imageUrl);
  containerUrl.searchParams.set("caption", caption);
  containerUrl.searchParams.set("access_token", FB_PAGE_ACCESS_TOKEN);

  const createRes = await fetch(containerUrl, { method: "POST" });
  if (!createRes.ok) {
    throw new Error(
      `IG container create failed: ${createRes.status} ${await createRes.text()}`,
    );
  }
  const { id: creationId } = await createRes.json();

  const publishUrl = new URL(
    `https://graph.facebook.com/${GRAPH_VERSION}/${IG_USER_ID}/media_publish`,
  );
  publishUrl.searchParams.set("creation_id", creationId);
  publishUrl.searchParams.set("access_token", FB_PAGE_ACCESS_TOKEN);

  const publishRes = await fetch(publishUrl, { method: "POST" });
  if (!publishRes.ok) {
    throw new Error(
      `IG publish failed: ${publishRes.status} ${await publishRes.text()}`,
    );
  }
  const { id } = await publishRes.json();
  return id;
}
