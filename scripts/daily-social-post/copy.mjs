// Puzzle number/date helpers + post copy template.
// EPOCH is duplicated from app/lib/epoch.ts to keep this script free of the
// Next build graph. If you ever change the epoch in the app, change it here too.
const EPOCH = "2026-04-27";

export function todayUtc(now = new Date()) {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function puzzleNumber(today = todayUtc(), epoch = EPOCH) {
  const t = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10));
  const e = Date.UTC(+epoch.slice(0, 4), +epoch.slice(5, 7) - 1, +epoch.slice(8, 10));
  return Math.floor((t - e) / 86400000) + 1;
}

export function humanDate(today = todayUtc()) {
  const d = new Date(`${today}T00:00:00Z`);
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function buildCopy({ num = puzzleNumber(), date = humanDate() } = {}) {
  // Append a per-day version param so X (and other aggressive OG cachers)
  // treat each day's link as a new URL and re-fetch the card. The page
  // ignores the param entirely (the homepage always shows today's puzzle,
  // not whichever puzzle the param suggests) — using `v` rather than `d`
  // also avoids hinting at a tamperable date.
  // Per-platform UTM-tagged URL so PostHog attributes clicks to the
  // right source. utm_source matches the platform name so HogQL groups
  // stay clean. Instagram captions aren't clickable, so its URL stays
  // bare — UTM in the caption text would just look ugly without
  // producing trackable clicks.
  const taggedUrl = (source) =>
    `https://tesserapuzzle.com/?v=${num}&utm_source=${source}&utm_medium=social&utm_campaign=daily-post`;
  const url = `https://tesserapuzzle.com/?v=${num}`;
  // IG fetches image_url server-side; use www to avoid the apex→www 307.
  // The homepage OG image renders today's puzzle with letters (cream tiles);
  // the /api/og share route is for post-solve cards (sage, no letters).
  // Append the puzzle number as a cache-bust hint — the route ignores
  // unknown params but it nudges Instagram's fetcher to bypass any
  // stale edge cache from a previous day.
  const instagramImageUrl = `https://www.tesserapuzzle.com/opengraph-image?v=${num}`;
  return {
    num,
    date,
    x: `Tessera #${num}, ${date}.\n\nToday's puzzle is live. Can you solve it?\n\n${taggedUrl("x")}`,
    bluesky: `Tessera #${num}, ${date}.\n\nToday's puzzle is live. Can you solve it?\n\n${taggedUrl("bluesky")}`,
    redditTitle: `Tessera #${num}: ${date}`,
    redditBody: `Today's puzzle is live at ${taggedUrl("reddit")}. Share your solve in the comments.`,
    facebook: `Tessera #${num}, ${date}.\n\nToday's puzzle is live. Play at ${taggedUrl("facebook")}`,
    instagram: `Tessera #${num}, ${date}.\n\nToday's puzzle is live. Play at ${url}\n\n#wordpuzzle #wordgame #dailypuzzle #puzzle #wordgames #tessera`,
    instagramImageUrl,
  };
}
