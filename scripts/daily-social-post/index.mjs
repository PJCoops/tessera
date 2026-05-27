import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildCopy } from "./copy.mjs";

const DRY_RUN = process.env.DRY_RUN === "1";
const ONLY = (process.env.ONLY || "").split(",").map((s) => s.trim()).filter(Boolean);
const should = (name) => ONLY.length === 0 || ONLY.includes(name);

// Idempotency: the workflow has two triggers (Vercel Cron via
// workflow_dispatch and GH's own backup `schedule:`). The lock lives in
// Upstash KV behind the app's /api/internal/social-lock route. APP_URL
// and CRON_SECRET come from workflow env. If either is missing we skip
// the check (manual local runs).
const APP_URL = process.env.APP_URL;
const CRON_SECRET = process.env.CRON_SECRET;
const LOCK_URL = APP_URL ? `${APP_URL.replace(/\/$/, "")}/api/internal/social-lock` : null;
const FORCE = process.env.FORCE === "1";

async function isAlreadyPosted() {
  if (!LOCK_URL || !CRON_SECRET) return false;
  try {
    const res = await fetch(LOCK_URL, {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    if (!res.ok) {
      console.warn(`[tessera-daily] lock check non-ok: ${res.status}`);
      return false;
    }
    const { locked } = await res.json();
    return Boolean(locked);
  } catch (err) {
    console.warn("[tessera-daily] lock check failed:", err.message || err);
    return false;
  }
}

async function setPostedLock(payload) {
  if (!LOCK_URL || !CRON_SECRET) return;
  try {
    const res = await fetch(LOCK_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${CRON_SECRET}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.warn(`[tessera-daily] lock set non-ok: ${res.status}`);
    }
  } catch (err) {
    console.warn("[tessera-daily] lock set failed:", err.message || err);
  }
}

// Reddit + Facebook posts include the daily screenshot. X is text-only and
// relies on the homepage Open Graph card for its preview, so when only X is
// running we skip Puppeteer entirely — that lets CI run without installing it.
const needsImage = should("reddit") || should("facebook");

async function main() {
  const copy = buildCopy();
  console.log(`[tessera-daily] puzzle #${copy.num} (${copy.date}) — dryRun=${DRY_RUN}`);

  if (!DRY_RUN && !FORCE && (await isAlreadyPosted())) {
    console.log("[tessera-daily] already posted today, skipping");
    return;
  }

  let imagePath = null;
  if (needsImage) {
    const { captureScreenshot } = await import("./screenshot.mjs");
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "tessera-"));
    imagePath = path.join(outDir, `tessera-${copy.num}.png`);
    await captureScreenshot(imagePath);
    console.log(`[tessera-daily] screenshot: ${imagePath}`);
  }

  if (DRY_RUN) {
    console.log("[tessera-daily] DRY_RUN — copy preview:");
    console.log("--- X ---\n" + copy.x);
    console.log("--- Reddit ---\n" + copy.redditTitle + "\n" + copy.redditBody);
    console.log("--- Facebook ---\n" + copy.facebook);
    console.log("--- Instagram ---\n" + copy.instagram);
    console.log("    image: " + copy.instagramImageUrl);
    return;
  }

  const results = {};
  const errors = [];

  const run = async (name, fn) => {
    if (!should(name)) return;
    try {
      results[name] = await fn();
      console.log(`[tessera-daily] ${name} ok: ${results[name] ?? "(no id)"}`);
    } catch (err) {
      errors.push({ name, err });
      console.error(`[tessera-daily] ${name} failed:`, err.message || err);
    }
  };

  // Run sequentially so one platform's failure doesn't race the others' rate limits.
  // Dynamic imports so each platform's deps only load when actually used.
  await run("x", async () => {
    const { postToX } = await import("./post-x.mjs");
    return postToX({ text: copy.x });
  });
  await run("bluesky", async () => {
    const { postToBluesky } = await import("./post-bluesky.mjs");
    return postToBluesky({ text: copy.bluesky });
  });
  await run("reddit", async () => {
    const { postToReddit } = await import("./post-reddit.mjs");
    return postToReddit({ imagePath, title: copy.redditTitle, subreddit: "TesseraPuzzle" });
  });
  await run("facebook", async () => {
    const { postToFacebook } = await import("./post-facebook.mjs");
    return postToFacebook({ imagePath, message: copy.facebook });
  });
  await run("instagram", async () => {
    const { postToInstagram } = await import("./post-instagram.mjs");
    return postToInstagram({
      imageUrl: copy.instagramImageUrl,
      caption: copy.instagram,
    });
  });

  // Set the daily lock if at least one platform succeeded. We don't
  // gate on "all succeeded" because partial-success days shouldn't
  // re-trigger the backup schedule — we'd just double-post wherever
  // the first run already worked.
  const okPlatforms = Object.keys(results);
  if (okPlatforms.length > 0) {
    await setPostedLock({
      puzzle: copy.num,
      date: copy.date,
      results,
      errors: errors.map(({ name, err }) => ({ name, message: err?.message || String(err) })),
      lockedAt: new Date().toISOString(),
    });
  }

  if (errors.length) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("[tessera-daily] fatal:", err);
  process.exit(1);
});
