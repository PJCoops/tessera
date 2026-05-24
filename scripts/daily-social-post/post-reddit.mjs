import fs from "node:fs";

// Posts a single image to a subreddit using Reddit's public API.
// Auth: script-type app + the script owner's username/password (password grant).
// The script app must be created by u/coopstar230 so the bearer token acts as them.

const USER_AGENT = "tessera-daily-poster/1.0 by u/coopstar230";

async function getAccessToken() {
  const {
    REDDIT_CLIENT_ID,
    REDDIT_CLIENT_SECRET,
    REDDIT_USERNAME,
    REDDIT_PASSWORD,
  } = process.env;

  if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET || !REDDIT_USERNAME || !REDDIT_PASSWORD) {
    throw new Error("Missing Reddit credentials");
  }

  const basic = Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString("base64");
  const body = new URLSearchParams({
    grant_type: "password",
    username: REDDIT_USERNAME,
    password: REDDIT_PASSWORD,
  });

  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "User-Agent": USER_AGENT,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) throw new Error(`Reddit token failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.access_token;
}

// Reddit's image upload is a two-step dance: ask for a presigned S3 URL, PUT
// the bytes, then submit the post referencing the returned asset URL.
async function uploadImage(token, imagePath) {
  const filename = imagePath.split("/").pop() || "puzzle.png";

  const leaseRes = await fetch("https://oauth.reddit.com/api/media/asset.json", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": USER_AGENT,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ filepath: filename, mimetype: "image/png" }),
  });
  if (!leaseRes.ok) throw new Error(`Lease failed: ${leaseRes.status} ${await leaseRes.text()}`);
  const lease = await leaseRes.json();

  const action = `https:${lease.args.action}`;
  const form = new FormData();
  for (const f of lease.args.fields) form.append(f.name, f.value);
  form.append("file", new Blob([fs.readFileSync(imagePath)], { type: "image/png" }), filename);

  const upload = await fetch(action, { method: "POST", body: form });
  if (!upload.ok) throw new Error(`S3 upload failed: ${upload.status} ${await upload.text()}`);

  const assetId = lease.asset.asset_id;
  // The submitted URL is the S3 location of the uploaded object.
  const websocketUrl = lease.asset.websocket_url;
  return { assetId, websocketUrl, s3Url: `${action}/${lease.args.fields.find((f) => f.name === "key").value}` };
}

export async function postToReddit({ imagePath, title, subreddit = "TesseraPuzzle" }) {
  const token = await getAccessToken();
  const { s3Url } = await uploadImage(token, imagePath);

  const body = new URLSearchParams({
    sr: subreddit,
    title,
    kind: "image",
    url: s3Url,
    api_type: "json",
    resubmit: "true",
    sendreplies: "true",
  });

  const res = await fetch("https://oauth.reddit.com/api/submit", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": USER_AGENT,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) throw new Error(`Reddit submit failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  if (json?.json?.errors?.length) {
    throw new Error(`Reddit submit errors: ${JSON.stringify(json.json.errors)}`);
  }
  return json?.json?.data?.url || null;
}
