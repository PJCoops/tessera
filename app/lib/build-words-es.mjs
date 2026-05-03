// Regenerate words-es.json and solution-words-es.json for Tessera.
//
// Two-source pipeline:
//   1. Spanish dictionary from `an-array-of-spanish-words` (MIT, ~636k
//      entries derived from RAE-adjacent corpora). Filters out the
//      proper-noun pollution that contaminates Wikipedia frequency
//      data (METS, INAH, JOHN, MATT, etc).
//   2. Spanish Wikipedia word frequency, used only to ORDER the
//      dictionary intersection. The most frequent words make it into
//      the curated solution list.
//
// Normalisation: strip accents (á→a, é→e, í→i, ó→o, ú→u, ü→u) and drop
// any word containing ñ. Keeps the tile grid in the same 26-letter
// alphabet as English so the existing UI works unchanged. After
// stripping, multiple source words can collapse onto the same key
// (e.g. "ano"+"año"); de-duplication keeps the first.
//
// Run: node app/lib/build-words-es.mjs

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

const FREQ_SOURCE =
  "https://raw.githubusercontent.com/IlyaSemenov/wikipedia-word-frequency/master/results/eswiki-2022-08-29.txt";
const DICT_SOURCE =
  "https://raw.githubusercontent.com/words/an-array-of-spanish-words/HEAD/index.json";

const SOLUTION_TARGET = 2000;
const WORDS_TARGET = 5000; // upper bound; will be capped by dictionary size

function normalise(word) {
  const stripped = word
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  if (/ñ/.test(stripped)) return null;
  if (!/^[a-z]+$/.test(stripped)) return null;
  return stripped;
}

// Manual blocklist: profanity, slurs, and a few specific tokens that
// slip through the dictionary cross-reference (archaic interjections,
// regional words that aren't fair puzzle answers). Conservative — bias
// toward removing.
const BLOCK = new Set([
  // Profanity / explicit anatomy
  "puta", "puto", "coño", "cono", "joder", "mier", "caca", "culo",
  "teta", "tetas", "polla", "pija",
  // Words derived from accent-stripping ñ words that change meaning
  // unfavourably (anos = años without the tilde, but reads as the
  // anatomical term).
  "anos",
  // Politically sensitive / historical terms.
  "nazi", "inri",
  // Personal names that ride high in Wikipedia frequency and slip
  // through the Spanish-words dictionary because they're also valid
  // common nouns somewhere. Conservative — only obvious ones.
  "luis", "lena", "paco", "pepe", "pepa", "ines", "amir", "amis",
  "bibi", "dina", "dine", "dino", "jaen", "jana", "jane", "jano",
  "josa", "juba", "lina", "loli", "lulu", "paul", "rita", "rite",
  "rene", "romi", "rose", "sofi", "tana", "vito", "yoda", "yale",
  // English loanwords that aren't integrated into everyday Spanish.
  "body", "deal", "dean", "home", "hope", "hall", "open", "opus",
  "rail", "rain", "sexy", "sets", "tops", "lite", "mace", "grog",
  "tory", "tony", "java", "zune", "lady", "barn", "bits", "cent",
  "gray", "toad",
  // Archaic / niche conjugations of obscure verbs that look weird as
  // puzzle answers (osar — to dare). Common Spanish speakers would not
  // use these in casual conversation.
  "osan", "osas", "osen", "oses",
  // Highly regional or archaic terms that don't read well as a daily
  // puzzle answer.
  "rola", "naos", "ichu", "icho",
]);

async function loadCachedOrFetch(cachePath, url) {
  if (existsSync(cachePath)) {
    return readFileSync(cachePath, "utf8");
  }
  console.log(`Fetching ${url} ...`);
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`Fetch failed: ${res.status}`);
    process.exit(1);
  }
  const text = await res.text();
  writeFileSync(cachePath, text);
  console.log(`Cached ${text.length} bytes to ${cachePath}`);
  return text;
}

// 1. Load Spanish dictionary, filter to normalised 4-letter words. Track
//    the original accented form alongside each normalised key so
//    downstream tools (definitions cache, future Spanish dictionary
//    lookups) can hit Wiktionary at the right URL — "acné" not "acne".
const dictRaw = await loadCachedOrFetch(
  join(here, ".dict-cache-es.json"),
  DICT_SOURCE
);
const dictArr = JSON.parse(dictRaw);
const SPANISH = new Set();
const ACCENTED = new Map(); // normalised key → first-seen accented original
for (const w of dictArr) {
  const n = normalise(w);
  if (n && n.length === 4) {
    SPANISH.add(n);
    if (!ACCENTED.has(n)) ACCENTED.set(n, w.toLowerCase());
  }
}
console.log(
  `Spanish dictionary: ${dictArr.length} entries, ${SPANISH.size} normalised 4-letter words`
);

// 2. Load frequency list (drives ordering).
const freqRaw = await loadCachedOrFetch(
  join(here, ".freq-cache-es.txt"),
  FREQ_SOURCE
);

// 3. Walk the frequency list. Keep distinct normalised 4-letter words
//    that ALSO appear in the Spanish dictionary and aren't blocklisted.
const ordered = [];
const seen = new Set();
for (const line of freqRaw.split(/\r?\n/)) {
  const raw = line.split(/\s+/, 1)[0];
  if (!raw) continue;
  const w = normalise(raw);
  if (!w) continue;
  if (w.length !== 4) continue;
  if (seen.has(w)) continue;
  if (BLOCK.has(w)) continue;
  if (!SPANISH.has(w)) continue;
  seen.add(w);
  ordered.push(w);
}
console.log(`Intersection: ${ordered.length} frequency-ranked Spanish words`);

// 4. Top-N for solutions; broader pool for validation. If the
//    intersection is smaller than the target, take everything.
const solution = ordered.slice(0, SOLUTION_TARGET).sort();
const words = ordered.slice(0, Math.min(WORDS_TARGET, ordered.length)).sort();

writeFileSync(join(here, "solution-words-es.json"), JSON.stringify(solution));
writeFileSync(join(here, "words-es.json"), JSON.stringify(words));
console.log(`Wrote ${solution.length} solution words → solution-words-es.json`);
console.log(`Wrote ${words.length} validation words → words-es.json`);

// Sidecar map: normalised → accented form. Used only by the definitions
// builder (and any future Spanish dictionary integration); not loaded at
// runtime.
const accentedMap = {};
for (const w of words) {
  if (ACCENTED.has(w)) accentedMap[w] = ACCENTED.get(w);
}
writeFileSync(
  join(here, "accented-map-es.json"),
  JSON.stringify(accentedMap)
);
console.log(
  `Wrote ${Object.keys(accentedMap).length} accented-form entries → accented-map-es.json`
);
