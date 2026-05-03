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
  // {{impropia|TEXT}} → TEXT inline (the template wraps a usage note that
  // IS the definition for words like "hola" / "gran"). Run before generic
  // template stripping. May contain nested templates that get cleaned in
  // later passes.
  out = out.replace(/\{\{impropia\|([\s\S]+?)\}\}/g, "$1");
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

// Pull the first POSITIONAL argument out of a template body, ignoring
// `key=value` parameters that often precede it (e.g.
// "{{f.v|leng=es|amar|...}}" → "amar").
function firstPositionalArg(body) {
  for (const part of body.split("|")) {
    if (!part.includes("=")) return part.trim();
  }
  return null;
}

// Pull the LAST positional argument (some templates put the base word at
// the end, e.g. "{{comparativo|irreg=sí|malo}}" → "malo").
function lastPositionalArg(body) {
  const positional = body.split("|").filter((p) => !p.includes("="));
  return positional.length ? positional[positional.length - 1].trim() : null;
}

// Inflected-form templates: when a definition is just one of these, the
// page is a "plural of X" / "conjugation of X" / "see X" pointer. The
// caller follows the link to fetch a real definition for X.
//
// Returned `tag` is a short Spanish prefix shown alongside the followed
// definition so the player understands why the entry isn't a fresh
// definition (e.g. "Plural de ala: …"). Each regex captures the whole
// template body up to `}}`; the extractor runs `firstPositionalArg` on
// the body to skip past `key=value` params (e.g. `leng=es`).
const REDIRECT_TEMPLATES = [
  { re: /\{\{forma sustantivo[ \w]*\|([^}]+)\}\}/, tag: "Plural de" },
  { re: /\{\{forma adjetivo[ \w]*\|([^}]+)\}\}/, tag: "Forma de" },
  { re: /\{\{forma pronombre[ \w]*\|([^}]+)\}\}/, tag: "Forma de" },
  { re: /\{\{forma verbo[ \w]*\|([^}]+)\}\}/, tag: "Conjugación de" },
  { re: /\{\{forma participio[ \w]*\|([^}]+)\}\}/, tag: "Participio de" },
  { re: /\{\{f\.v\|([^}]+)\}\}/, tag: "Conjugación de" },
  { re: /\{\{f\.s\|([^}]+)\}\}/, tag: "Plural de" },
  { re: /\{\{f\.adj\|([^}]+)\}\}/, tag: "Forma de" },
  { re: /\{\{grafía obsoleta\|([^}]+)\}\}/, tag: "Forma antigua de" },
  { re: /\{\{grafía informal\|([^}]+)\}\}/, tag: "Forma informal de" },
  { re: /\{\{variante obsoleta\|([^}]+)\}\}/, tag: "Variante antigua de" },
  { re: /\{\{variante\|([^}]+)\}\}/, tag: "Variante de" },
];

// If the raw definition body is a redirect template ("plural of X",
// "conjugation of X", etc.), return the base word and a Spanish prefix
// telling the player what the relationship is. Returns null if the body
// is a real definition (caller cleans it normally).
function extractRedirect(rawBody) {
  for (const { re, tag } of REDIRECT_TEMPLATES) {
    const m = re.exec(rawBody);
    if (m) {
      const base = firstPositionalArg(m[1]);
      if (base) return { base, tag };
    }
  }
  // {{comparativo|irreg=sí|malo}} → "Comparativo de malo" (base is the
  // LAST positional arg, not the first).
  const compMatch = /\{\{comparativo\|([^}]+)\}\}/.exec(rawBody);
  if (compMatch) {
    const base = lastPositionalArg(compMatch[1]);
    if (base) return { base, tag: "Comparativo de" };
  }
  return null;
}

// Pull the first numbered definition from the {{lengua|es}} section.
// Returns either { kind: "def", text } or { kind: "redirect", base, tag }
// or null. Caller resolves redirects by re-fetching `base` and prepending
// `tag base: ` to the resolved definition.
function extractFirstDefinition(wikitext) {
  if (!wikitext) return null;
  // Match {{lengua|es}} or {{lengua|es|N}} (numbered for ambiguous
  // entries with multiple unrelated meanings, e.g. ACRE).
  const langMatch = /\{\{lengua\|es(?:\|\d+)?\}\}/.exec(wikitext);
  if (!langMatch) return null;
  const langStart = langMatch.index;
  const after = wikitext.slice(langStart);
  const nextLang = after.slice(langMatch[0].length).search(/\n==\s*\{\{lengua\|/);
  const section = nextLang === -1
    ? after
    : after.slice(0, langMatch[0].length + nextLang);
  // Walk every numbered definition; the first viable one wins. Pages
  // that are JUST a redirect template ("plural of X") return a redirect
  // hint so the caller can resolve to X. Pages whose first def is some
  // other useless template (e.g. {{impropia|...}}) skip to the next
  // numbered line. Single-word "synonym pointer" defs like {{plm|cenit}}
  // (clean to "Cenit.") are accepted at any length — they're real
  // definitions, just terse.
  const defRe = /^;\s*\d+[^:]*:\s*(.+)$/gm;
  let m;
  while ((m = defRe.exec(section)) !== null) {
    const raw = m[1];
    const redirect = extractRedirect(raw);
    if (redirect) return { kind: "redirect", ...redirect };
    const cleaned = cleanWikitext(raw);
    if (!cleaned) continue;
    // A pure synonym entry (just one word + period) is short but valid.
    const isSynonym = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+\.?$/.test(cleaned);
    if (!isSynonym && cleaned.length < 10) continue;
    const text = cleaned.length > 280 ? cleaned.slice(0, 277) + "…" : cleaned;
    return { kind: "def", text };
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

// Resolve a single page to a final string definition. Follows up to one
// redirect (e.g. "alas" → forma sustantivo of "ala" → real definition of
// "ala"). One-hop only: a chain of redirects is rare and not worth the
// extra request budget.
async function resolveDefinition(title, depth = 0) {
  const wt = await fetchWikitext(title);
  const result = extractFirstDefinition(wt);
  if (!result) return null;
  if (result.kind === "def") return result.text;
  if (depth >= 1) return null; // don't chase further
  // Resolve the base word (already accented, since it came out of the
  // wikitext as-typed).
  const baseWt = await fetchWikitext(result.base);
  const baseResult = extractFirstDefinition(baseWt);
  if (!baseResult || baseResult.kind !== "def") return null;
  // "Plural de ala: " + the resolved definition. Capped to the same
  // 280-char budget as a normal definition.
  const prefix = `${result.tag} ${result.base}: `;
  const combined = prefix + baseResult.text;
  return combined.length > 280 ? combined.slice(0, 277) + "…" : combined;
}

async function fetchDefinitionFor(word) {
  for (const variant of accentVariants(word)) {
    const def = await resolveDefinition(variant);
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

// Prune null entries from the shipped JSON, AND restrict to words still
// in the current solution list. After a blocklist tweak the cache may
// hold definitions for words that have since been removed — those
// shouldn't ride along in the bundle. Runtime treats absence as "no
// definition" and shows the placeholder.
const solutionSet = new Set(SOLUTION);
const shipped = {};
for (const [w, def] of Object.entries(cache)) {
  if (def && solutionSet.has(w)) shipped[w] = def;
}
writeFileSync(outPath, JSON.stringify(shipped));
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
console.log(
  `Wrote ${Object.keys(shipped).length} definitions to ${outPath} in ${elapsed}s`
);
