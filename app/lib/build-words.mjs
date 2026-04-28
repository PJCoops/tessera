// Regenerate words.json for Tessera.
// Source: SOWPODS (the canonical UK/international Scrabble word list).
// Run: node app/catalogue/tessera/lib/build-words.mjs

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SOURCE =
  "https://raw.githubusercontent.com/jonbcard/scrabble-bot/master/src/dictionary.txt";

// Blocklist: explicit terms and slurs the generator must never seed and the
// dictionary must never validate. Conservative; bias toward removing.
const BLOCK = new Set([
  "arse", "cock", "cunt", "dick", "fuck", "jism", "paki", "piss",
  "shit", "spic", "tits", "twat", "wank", "wogs",
]);

const res = await fetch(SOURCE);
if (!res.ok) {
  console.error(`Fetch failed: ${res.status}`);
  process.exit(1);
}
const raw = await res.text();

const words = Array.from(
  new Set(
    raw
      .split(/\r?\n/)
      .map((w) => w.trim().toLowerCase())
      .filter((w) => /^[a-z]{4}$/.test(w))
      .filter((w) => !BLOCK.has(w))
  )
).sort();

const here = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(here, "words.json"), JSON.stringify(words));
console.log(`Wrote ${words.length} four-letter words to words.json`);
