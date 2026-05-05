// Regenerate solution-words.json for Tessera.
//
// Source: SOWPODS (already cached at words.json) intersected with the
// Wikipedia English word-frequency list. We keep the top-N most frequent
// 4-letter SOWPODS words so the gold-grid generator picks recognisable
// English words (LIFT, CAKE, BANE, GREY, NEAT...) rather than Scrabble
// fillers (ESES, PSST, TSKS, ESNE, EMES, ASEA...).
//
// Run: node app/catalogue/tessera/lib/build-solution-words.mjs

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

const FREQ_SOURCE =
  "https://raw.githubusercontent.com/IlyaSemenov/wikipedia-word-frequency/master/results/enwiki-2023-04-13.txt";

// Take roughly the top-N 4-letter words by frequency. Tuned so the
// generator still finds gold grids reliably across thousands of seeds
// while keeping the vocabulary common.
const TARGET_SIZE = 2000;

// Manual blocklist: explicit terms, slurs and stuff we don't want as
// solutions even if frequent on Wikipedia. Mirrors build-words.mjs and
// adds a few more obscure / unfriendly forms.
const BLOCK = new Set([
  // Mirrors build-words.mjs (slurs / explicit terms / hostile content)
  "arse", "cock", "cunt", "dick", "fuck", "jism", "paki", "piss",
  "rape", "shit", "spic", "tits", "twat", "wank", "wogs",
  // Proper nouns / brand names that ride high on Wikipedia frequency
  // but aren't really common English words.
  "abba", "agha", "aida", "ajax", "alan", "alba", "alec", "alma",
  "alva", "amin", "baal", "cain", "cobb", "cory", "cris", "dahl",
  "davy", "dore", "eger", "emmy", "etna", "gaby", "gama", "iago",
  "iban", "iggy", "jpeg", "kane", "keir", "knut", "kobe", "lang",
  "lars", "lear", "lego", "loki", "mali", "mick", "mike", "modi",
  "mura", "naga", "nero", "nick", "ovid", "pele", "phil", "pict",
  "pugh", "rama", "raya", "rees", "reis", "remy", "rene", "reno",
  "rick", "rico", "roma", "rosa", "ross", "rudi", "rudy", "russ",
  "sade", "saul", "sega", "siam", "tate", "tito", "todd", "togo",
  "tojo", "tony", "tora", "tung", "tyne", "vega", "vera", "vlad",
  "yale", "zion",
  // Foreign loanwords that read as non-English when isolated.
  "chao", "jeux", "mano", "quai", "shri", "sith", "vive",
  // A few archaic / obscure forms still slipping through
  "alef", "alfa", "amah", "anil",
  // Plural of regional Australian slang ("ute" → "utes"); fine in
  // SOWPODS but reads as a Scrabble filler in en_GB.
  "utes",
]);

// 1. Load SOWPODS list.
const sowpods = new Set(JSON.parse(readFileSync(join(here, "words.json"), "utf8")));

// 2. Load (or fetch) the Wikipedia frequency list.
const freqCache = join(here, ".freq-cache.txt");
let freqRaw;
if (existsSync(freqCache)) {
  freqRaw = readFileSync(freqCache, "utf8");
} else {
  const res = await fetch(FREQ_SOURCE);
  if (!res.ok) {
    console.error(`Fetch failed: ${res.status}`);
    process.exit(1);
  }
  freqRaw = await res.text();
  writeFileSync(freqCache, freqRaw);
}

// 3. Walk the frequency list (already sorted desc by count). Keep the
//    first TARGET_SIZE distinct 4-letter words that are also in SOWPODS
//    and not blocklisted.
const picked = [];
const seen = new Set();
for (const line of freqRaw.split(/\r?\n/)) {
  const word = line.split(/\s+/, 1)[0]?.toLowerCase();
  if (!word) continue;
  if (!/^[a-z]{4}$/.test(word)) continue;
  if (seen.has(word)) continue;
  if (!sowpods.has(word)) continue;
  if (BLOCK.has(word)) continue;
  seen.add(word);
  picked.push(word);
  if (picked.length >= TARGET_SIZE) break;
}

picked.sort();
writeFileSync(join(here, "solution-words.json"), JSON.stringify(picked));
console.log(`Wrote ${picked.length} curated solution words to solution-words.json`);
