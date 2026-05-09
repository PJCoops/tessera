// Regenerate the curated solution-words list for Tessera (English).
//
// Source: SOWPODS (already cached at words.json) intersected with the
// Wikipedia English word-frequency list. We keep the top-N most frequent
// SOWPODS words at the chosen length so the gold-grid generator picks
// recognisable English words (LIFT, CAKE, BANE, GREY, NEAT...) rather
// than Scrabble fillers (ESES, PSST, TSKS, ESNE, EMES, ASEA...).
//
// Two filters run on top of the frequency rank:
//   1. A manual BLOCK list catches proper nouns, brand names, and
//      coopted loanwords that ride high on Wikipedia frequency but
//      shouldn't be answers (RIEL, CINE, PARIS, ENTREE...).
//   2. A plural filter drops `*S`/`*ES`/`*IES` words whose stem is also
//      a SOWPODS word, since those forms widen the answer space without
//      adding interesting puzzles. Words that *look* like plurals but
//      aren't (BOSS, MASS, OPUS, IRIS...) are explicitly kept via the
//      NOT_REALLY_PLURALS allowlist.
//
// Run:
//   node app/lib/build-solution-words.mjs            (length 4, default)
//   LENGTH=5 node app/lib/build-solution-words.mjs   (length 5)

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

const FREQ_SOURCE =
  "https://raw.githubusercontent.com/IlyaSemenov/wikipedia-word-frequency/master/results/enwiki-2023-04-13.txt";
const SOWPODS_SOURCE =
  "https://raw.githubusercontent.com/jonbcard/scrabble-bot/master/src/dictionary.txt";

const LENGTH = Number(process.env.LENGTH ?? "4");
if (LENGTH !== 4 && LENGTH !== 5) {
  console.error(`Unsupported LENGTH=${LENGTH}; pass LENGTH=4 or LENGTH=5`);
  process.exit(1);
}

const TARGET_SIZE = 2000;
const OUT_FILE = LENGTH === 4 ? "solution-words.json" : `solution-words-${LENGTH}.json`;
const LENGTH_RE = new RegExp(`^[a-z]{${LENGTH}}$`);

// Manual blocklist: profanity, slurs, proper nouns, brand names, and
// coopted loanwords that the frequency rank surfaces but readers
// rightly call out as cheating. Bias toward removing.
const BLOCK = new Set([
  // Profanity / slurs
  "arse", "cock", "cunt", "dick", "fuck", "jism", "paki", "piss",
  "rape", "shit", "spic", "tits", "twat", "wank", "wogs",
  // 4-letter proper nouns / brand names
  "abba", "agha", "aida", "ajax", "alan", "alba", "alec", "alma",
  "alva", "amin", "baal", "cain", "carl", "cobb", "cory", "cris",
  "dahl", "davy", "dore", "eger", "emmy", "etna", "gaby", "gama",
  "iago", "iban", "iggy", "ilia", "jpeg", "kane", "keir", "knut",
  "kobe", "lang", "lars", "lear", "lego", "loki", "mali", "mick",
  "mike", "modi", "mura", "naga", "nero", "nick", "ovid", "pele",
  "phil", "pict", "pugh", "rama", "raya", "rees", "reis", "remy",
  "rene", "reno", "rick", "rico", "riel", "roma", "rosa", "ross",
  "rudi", "rudy", "russ", "sade", "saul", "sega", "siam", "tate",
  "tess", "tito", "todd", "togo", "tojo", "tony", "tora", "tung",
  "tyne", "vega", "vera", "vlad", "yale", "zion",
  // 4-letter foreign loanwords that read as non-English when isolated
  "chao", "cine", "deja", "deux", "jeux", "mano", "quai", "shri",
  "sith", "vive",
  // 4-letter archaic / obscure
  "alef", "alfa", "amah", "anil",
  // 4-letter slang / regional plurals
  "utes",
  // 4-letter US spellings (Tessera is en-GB; we use UK forms only).
  // Some have UK equivalents already in the list (GREY, TYRE, DISC) so
  // dropping the US variant just removes the duplicate. Others (COZY,
  // MOLD, ODOR, PLOW) have no fitting 4-letter UK equivalent and drop
  // out entirely; UK forms (cosy, mould, odour, plough) are 5–6 letters.
  "cozy", "disk", "gray", "mold", "odor", "plow", "tire",
  // 5-letter proper nouns / brand names
  "abbas", "argus", "atlas", "audi", "bates", "bosch",
  "denis", "dukes", "dumas", "earls",
  "honda", "irons", "jesse", "jesus", "joans", "johns",
  "jones", "judas", "judah", "lewis", "linda", "louis", "mayas",
  "miles", "minas", "obama", "paris", "pesos",
  "santa", "scots", "shahs", "swiss", "syria", "sykes", "texas",
  "trump", "turks", "venus", "wigan",
  // 5-letter loanwords / coopted non-English
  "adieu", "ciao", "entree", "haute", "henri", "jefe", "outre",
  "regis", "salam",
  // 5-letter US spellings — Tessera is en-GB. Most -or → -our pairs
  // (COLOUR, HONOUR, etc.) are 6 letters and don't fit a 5×5 grid, so
  // dropping the US form removes the word entirely from the answer
  // pool. The -er → -re pairs (METER/METRE, FIBER/FIBRE) have both
  // forms in our list; blocking the US form leaves the UK alone.
  "armor", "arbor", "color", "favor", "fiber", "honor", "humor",
  "labor", "liter", "meter", "rumor", "saber", "tumor", "valor",
  "vapor", "vigor",
]);

// Words that end in -s or -es but aren't plurals — keep them even when
// the simple plural filter would otherwise flag them. Mostly Greek/Latin
// singular forms, hisses/buzzes, and a couple of pronouns.
const NOT_REALLY_PLURALS = new Set([
  // 4-letter
  "alas", "alms", "anus", "axis", "bass", "bias", "boss", "fess",
  "foss", "fuss", "hiss", "ibis", "iris", "jess", "joss", "kiss",
  "kris", "less", "mass", "mess", "miss", "moss", "ness", "news",
  "ones", "opus", "pass", "plus", "puss", "this", "thus", "toss",
  // 5-letter
  "abyss", "alias", "basis", "bless", "bliss", "bonus", "brass",
  "chaos", "chess", "class", "cross", "dress", "fetus", "focus",
  "genus", "glass", "grass", "gross", "guess", "locus", "lotus",
  "minus", "oasis", "pious", "press", "sinus", "truss", "virus",
]);

// 1. Load the full SOWPODS dictionary, then derive the length-N word
//    set used to decide membership when scanning the frequency list.
//    `words.json` only carries the 4-letter slice, so for LENGTH=5 we
//    have to go back to the full source.
const sowpodsCache = "/tmp/sowpods-test.txt";
const fullSowpodsRaw = existsSync(sowpodsCache)
  ? readFileSync(sowpodsCache, "utf8")
  : await (await fetch(SOWPODS_SOURCE)).text();
if (!existsSync(sowpodsCache)) writeFileSync(sowpodsCache, fullSowpodsRaw);
const sowpods = new Set();
for (const line of fullSowpodsRaw.split(/\r?\n/)) {
  const w = line.trim().toLowerCase();
  if (LENGTH_RE.test(w)) sowpods.add(w);
}

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

// 3. Build a "common stems" set from the frequency list at the
//    plural-stem lengths (LENGTH-1 for `*S`, and LENGTH-2 for `*ES`/`*IES`).
//    Words above this rank-cutoff are common enough that their plural
//    feels cheap. Words below it (e.g. DART → DARTS) are rarer, so
//    even though they technically pluralise, the plural form reads
//    as its own word. This is the threshold that lets PALS get
//    dropped while leaving DARTS in.
// Wikipedia frequency under-counts conversational words (PAL, KID, PUB
// etc), so a cutoff of 5000 misses common-feeling stems. 15000 covers
// most of the cheap-feeling plurals while still leaving DART (rank
// ~13800) and similar rarer-as-noun stems alone.
const STEM_RANK_CUTOFF = 15000;
const commonStems = new Set();
{
  const seenStem = new Set();
  let count = 0;
  for (const line of freqRaw.split(/\r?\n/)) {
    const word = line.split(/\s+/, 1)[0]?.toLowerCase();
    if (!word || !/^[a-z]+$/.test(word)) continue;
    if (seenStem.has(word)) continue;
    seenStem.add(word);
    if (word.length === LENGTH - 1 || word.length === LENGTH - 2) {
      commonStems.add(word);
    }
    count++;
    if (count >= STEM_RANK_CUTOFF) break;
  }
}

// 4. Walk the frequency list. Drop blocked words, drop plurals whose
//    stem is in the common-stems set, take the first TARGET_SIZE.
function isLikelyPlural(word) {
  if (NOT_REALLY_PLURALS.has(word)) return false;
  if (!word.endsWith("s")) return false;
  const stem1 = word.slice(0, -1);
  if (commonStems.has(stem1)) return true;
  if (word.endsWith("ies")) {
    const yStem = word.slice(0, -3) + "y";
    if (commonStems.has(yStem)) return true;
  }
  if (word.endsWith("es")) {
    const eStem = word.slice(0, -2);
    if (commonStems.has(eStem)) return true;
  }
  return false;
}

const picked = [];
const seen = new Set();
let droppedBlocked = 0;
let droppedPlurals = 0;
for (const line of freqRaw.split(/\r?\n/)) {
  const word = line.split(/\s+/, 1)[0]?.toLowerCase();
  if (!word) continue;
  if (!LENGTH_RE.test(word)) continue;
  if (seen.has(word)) continue;
  if (!sowpods.has(word)) continue;
  if (BLOCK.has(word)) { droppedBlocked++; continue; }
  if (isLikelyPlural(word)) { droppedPlurals++; continue; }
  seen.add(word);
  picked.push(word);
  if (picked.length >= TARGET_SIZE) break;
}

picked.sort();
writeFileSync(join(here, OUT_FILE), JSON.stringify(picked));
console.log(
  `Wrote ${picked.length} curated solution words to ${OUT_FILE} ` +
    `(length=${LENGTH}, dropped ${droppedBlocked} blocked, ${droppedPlurals} plurals)`
);
