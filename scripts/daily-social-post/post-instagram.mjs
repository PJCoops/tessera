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

  // Instagram processes the uploaded image asynchronously. Publishing
  // before the container reaches FINISHED returns 400 "Media ID is not
  // available". Poll the container's status_code every 2s up to ~30s,
  // which is well above the empirically-observed processing time (~5s).
  // status_code values: IN_PROGRESS, FINISHED, ERROR, EXPIRED, PUBLISHED.
  const POLL_INTERVAL_MS = 2000;
  const POLL_TIMEOUT_MS = 30_000;
  const start = Date.now();
  while (true) {
    const statusUrl = new URL(
      `https://graph.facebook.com/${GRAPH_VERSION}/${creationId}`,
    );
    statusUrl.searchParams.set("fields", "status_code");
    statusUrl.searchParams.set("access_token", FB_PAGE_ACCESS_TOKEN);
    const statusRes = await fetch(statusUrl);
    if (!statusRes.ok) {
      throw new Error(
        `IG status check failed: ${statusRes.status} ${await statusRes.text()}`,
      );
    }
    const { status_code: statusCode } = await statusRes.json();
    if (statusCode === "FINISHED") break;
    if (statusCode === "ERROR" || statusCode === "EXPIRED") {
      throw new Error(`IG container ${statusCode} during processing`);
    }
    if (Date.now() - start > POLL_TIMEOUT_MS) {
      throw new Error(`IG container still ${statusCode} after ${POLL_TIMEOUT_MS}ms`);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

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
