import { TwitterApi } from "twitter-api-v2";

// Text-only post. X unfurls the trailing tesserapuzzle.com URL into a card
// using the homepage Open Graph image, which already shows today's puzzle.
// Skipping media upload also avoids the per-call Pay Per Use media charge.

export async function postToX({ text }) {
  const {
    X_API_KEY,
    X_API_SECRET,
    X_ACCESS_TOKEN,
    X_ACCESS_SECRET,
  } = process.env;

  if (!X_API_KEY || !X_API_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_SECRET) {
    throw new Error("Missing X (Twitter) credentials");
  }

  const client = new TwitterApi({
    appKey: X_API_KEY,
    appSecret: X_API_SECRET,
    accessToken: X_ACCESS_TOKEN,
    accessSecret: X_ACCESS_SECRET,
  });

  const res = await client.v2.tweet({ text });
  return res.data?.id;
}
