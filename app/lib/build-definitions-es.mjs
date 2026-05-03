// Build a static definitions cache for the Spanish solution wordlist.
//
// Source: es.wiktionary.org via the MediaWiki action API (api.php). The
// REST v1 endpoint isn't supported on the Spanish wiki, so we fetch raw
// wikitext and pull the first numbered definition under the "{{lengua|es}}"
// section with a small regex-based parser. Imperfect, but covers the
// common cases — words that don't parse get null and the UI shows the
// "Definition unavailable" placeholder.
//
// Run: node app/lib/build-definitions-es.mjs [batchSize=20]
//
// Bake-once: this writes app/locales/definitions-es.json, which ships
// with the bundle. Re-run only when you regenerate the wordlist or want
// to refresh definitions.

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, "../locales/definitions-es.json");
const cachePath = join(here, ".defs-cache-es.json");

const SOLUTION = JSON.parse(
  readFileSync(join(here, "solution-words-es.json"), "utf8")
);
// Wikimedia throttles unauthenticated bursts. Their documented friendly
// rate is ~1 request/sec for batch jobs; in practice 4 in flight with
// a small inter-batch pause works without 429s. Higher and you get
// banned for the rest of the run.
const BATCH = parseInt(process.argv[2] ?? "4", 10);
const BATCH_PAUSE_MS = 250;
const RETRY_429_DELAYS_MS = [1000, 3000, 8000];
const UA = "Tessera-Build/1.0 (https://www.tesserapuzzle.com; paul@pjcooper.design)";
const ENDPOINT = "https://es.wiktionary.org/w/api.php";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Strip MediaWiki markup down to plain prose. Pragmatic — handles the
// shapes that show up in es.wiktionary's `;1: definition` lines.
function cleanWikitext(s) {
  let out = s;
  // <ref>...</ref> with optional name attribute
  out = out.replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, "");
  out = out.replace(/<ref[^/]*\/>/g, "");
  // {{plm|X}} → capitalised X (capitalises first letter of the word)
  out = out.replace(/\{\{plm\|([^|}]+)\}\}/g, (_, w) => w.charAt(0).toUpperCase() + w.slice(1));
  // {{l|es|X}} → X (link to Spanish word)
  out = out.replace(/\{\{l\|[^|}]+\|([^|}]+)\}\}/g, "$1");
  // {{csem|...}} and {{uso|...}} drop entirely (semantic / usage tags)
  out = out.replace(/\{\{(?:csem|uso|ámbito|ambito|antiguo|coloq|despect|fam|gent|formal|literario|raro|técnico|tecnico)\|[^}]*\}\}/g, "");
  // Remaining templates {{...}} dropped. Multi-pass to handle nesting.
  for (let i = 0; i < 3; i++) {
    out = out.replace(/\{\{[^{}]*\}\}/g, "");
  }
  // [[link|text]] → text
  out = out.replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, "$1");
  // [[link]] → link
  out = out.replace(/\[\[([^\]]+)\]\]/g, "$1");
  // ''italic'' / '''bold''' markers — strip
  out = out.replace(/'{2,5}/g, "");
  // HTML entities and stray tags
  out = out.replace(/<[^>]+>/g, "");
  // Collapse whitespace, trim, drop trailing colons / semicolons
  out = out.replace(/\s+/g, " ").trim();
  out = out.replace(/[;:,\s]+$/, "");
  return out;
}

// Pull the first numbered definition from the {{lengua|es}} section.
// Definitions look like:
//   ;1 {{csem|vivienda}}: {{plm|edificación}} destinada a [[vivienda]].
//   ;2: {{plm|domicilio}}.
function extractFirstDefinition(wikitext) {
  if (!wikitext) return null;
  const langStart = wikitext.indexOf("{{lengua|es}}");
  if (langStart === -1) return null;
  // Stop before the next top-level language section so we don't bleed
  // into another language's definitions.
  const after = wikitext.slice(langStart);
  const nextLang = after.slice(13).search(/\n==\s*\{\{lengua\|/);
  const section = nextLang === -1 ? after : after.slice(0, 13 + nextLang);
  // Walk every numbered definition; return the first one that survives
  // the cleanup with usable prose. Pages like "arbol" that consist of
  // only `{{grafía obsoleta|árbol}}` strip down to "." — we skip those
  // so the caller's accent-variant fallback can find the real entry.
  const defRe = /^;\s*\d+[^:]*:\s*(.+)$/gm;
  let m;
  while ((m = defRe.exec(section)) !== null) {
    const cleaned = cleanWikitext(m[1]);
    if (!cleaned || cleaned.length < 10) continue;
    return cleaned.length > 280 ? cleaned.slice(0, 277) + "…" : cleaned;
  }
  return null;
}

async function fetchWikitext(title) {
  const url = `${ENDPOINT}?action=parse&page=${encodeURIComponent(title)}&prop=wikitext&format=json&formatversion=2&redirects=1`;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.status === 429 && attempt < RETRY_429_DELAYS_MS.length) {
      const ra = parseInt(res.headers.get("retry-after") ?? "0", 10);
      const waitMs = ra > 0 ? ra * 1000 : RETRY_429_DELAYS_MS[attempt];
      await sleep(waitMs);
      continue;
    }
    if (!res.ok) return null;
    const json = await res.json();
    return json?.parse?.wikitext ?? null;
  }
}

// Our wordlist is accent-stripped but Wiktionary pages live at the
// accented spellings ("acné" not "acne"). Generate the obvious accent
// variants and try them in turn until one returns a Spanish section.
const VOWELS = { a: "á", e: "é", i: "í", o: "ó", u: "ú" };
function* accentVariants(word) {
  yield word;
  for (let i = 0; i < word.length; i++) {
    const ch = word[i];
    const acc = VOWELS[ch];
    if (!acc) continue;
    yield word.slice(0, i) + acc + word.slice(i + 1);
  }
}

async function fetchDefinitionFor(word) {
  for (const variant of accentVariants(word)) {
    const wt = await fetchWikitext(variant);
    const def = extractFirstDefinition(wt);
    if (def) return def;
  }
  return null;
}

// Resume support — re-running picks up where it left off.
const cache = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, "utf8")) : {};

const todo = SOLUTION.filter((w) => !(w in cache));
console.log(
  `Solution words: ${SOLUTION.length}. Cached: ${Object.keys(cache).length}. To fetch: ${todo.length}.`
);

let okCount = 0;
let missCount = 0;
const t0 = Date.now();
for (let i = 0; i < todo.length; i += BATCH) {
  const slice = todo.slice(i, i + BATCH);
  const results = await Promise.all(
    slice.map(async (w) => {
      try {
        return [w, await fetchDefinitionFor(w)];
      } catch (e) {
        return [w, null];
      }
    })
  );
  for (const [w, def] of results) {
    cache[w] = def;
    if (def) okCount++;
    else missCount++;
  }
  // Persist after each batch so a long run survives interruption.
  writeFileSync(cachePath, JSON.stringify(cache));
  const done = i + slice.length;
  process.stdout.write(
    `\r  fetched ${done}/${todo.length}  (ok=${okCount} miss=${missCount})`
  );
  if (done < todo.length) await sleep(BATCH_PAUSE_MS);
}
console.log("");

// Prune null entries from the shipped JSON — runtime treats absence as
// "no definition" and shows the placeholder. Keeps the bundle small.
const shipped = {};
for (const [w, def] of Object.entries(cache)) {
  if (def) shipped[w] = def;
}
writeFileSync(outPath, JSON.stringify(shipped));
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
console.log(
  `Wrote ${Object.keys(shipped).length} definitions to ${outPath} in ${elapsed}s`
);
