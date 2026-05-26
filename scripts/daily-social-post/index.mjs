import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildCopy } from "./copy.mjs";

const DRY_RUN = process.env.DRY_RUN === "1";
const ONLY = (process.env.ONLY || "").split(",").map((s) => s.trim()).filter(Boolean);
const should = (name) => ONLY.length === 0 || ONLY.includes(name);

// Reddit + Facebook posts include the daily screenshot. X is text-only and
// relies on the homepage Open Graph card for its preview, so when only X is
// running we skip Puppeteer entirely — that lets CI run without installing it.
const needsImage = should("reddit") || should("facebook");

async function main() {
  const copy = buildCopy();
  console.log(`[tessera-daily] puzzle #${copy.num} (${copy.date}) — dryRun=${DRY_RUN}`);

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

  if (errors.length) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("[tessera-daily] fatal:", err);
  process.exit(1);
});
