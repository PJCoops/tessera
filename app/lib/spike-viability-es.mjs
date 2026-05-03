// Generator-viability spike for the Spanish wordlist.
//
// Runs the existing column-prefix backtracking generator (same algorithm
// as findGoldGrid in puzzle.ts) over N pseudo-random seeds and reports:
//   - hit rate (fraction of seeds that produce a 4×4 grid in budget)
//   - average grid + a sample
//   - rough timing
//
// Run: node app/lib/spike-viability-es.mjs [seedCount]

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const SEEDS = parseInt(process.argv[2] ?? "200", 10);

const SOLUTION = JSON.parse(
  readFileSync(join(here, "solution-words-es.json"), "utf8")
);
const ALL = SOLUTION;
const PREFIX = (() => {
  const s = new Set();
  for (const w of ALL) {
    s.add(w[0]);
    s.add(w.slice(0, 2));
    s.add(w.slice(0, 3));
  }
  return s;
})();
const SOL_SET = new Set(ALL);

function mulberry32(seed) {
  let a = seed | 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffled(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function colsArePrefixes(rows) {
  const k = rows.length;
  for (let c = 0; c < 4; c++) {
    let p = "";
    for (let r = 0; r < k; r++) p += rows[r][c];
    if (!PREFIX.has(p)) return false;
  }
  return true;
}
function findGoldGrid(rng, { row0Tries = 200, nodeBudget = 5_000_000 } = {}) {
  const order = shuffled(ALL, rng);
  let nodes = 0;
  for (let i = 0; i < Math.min(row0Tries, order.length); i++) {
    const r0 = order[i];
    const r1Cands = shuffled(ALL.filter((w) => colsArePrefixes([r0, w])), rng);
    for (const r1 of r1Cands) {
      if (++nodes > nodeBudget) return null;
      const r2Cands = shuffled(ALL.filter((w) => colsArePrefixes([r0, r1, w])), rng);
      for (const r2 of r2Cands) {
        if (++nodes > nodeBudget) return null;
        const validChars = [];
        let dead = false;
        for (let c = 0; c < 4; c++) {
          const stem = r0[c] + r1[c] + r2[c];
          const set = new Set();
          for (let cc = 97; cc <= 122; cc++) {
            const ch = String.fromCharCode(cc);
            if (SOL_SET.has(stem + ch)) set.add(ch);
          }
          if (set.size === 0) { dead = true; break; }
          validChars.push(set);
        }
        if (dead) continue;
        const r3Cands = ALL.filter(
          (w) =>
            validChars[0].has(w[0]) &&
            validChars[1].has(w[1]) &&
            validChars[2].has(w[2]) &&
            validChars[3].has(w[3])
        );
        if (r3Cands.length > 0) {
          return [r0, r1, r2, shuffled(r3Cands, rng)[0]];
        }
      }
    }
  }
  return null;
}

console.log(
  `Wordlist: ${ALL.length} solution words, ${PREFIX.size} distinct prefixes`
);
console.log(`Running ${SEEDS} seeds...\n`);

const samples = [];
let hits = 0;
const t0 = Date.now();
for (let s = 1; s <= SEEDS; s++) {
  const grid = findGoldGrid(mulberry32(s));
  if (grid) {
    hits++;
    if (samples.length < 5) samples.push({ seed: s, grid });
  }
}
const elapsed = Date.now() - t0;

console.log(
  `Hit rate: ${hits}/${SEEDS} = ${((hits / SEEDS) * 100).toFixed(1)}%`
);
console.log(
  `Avg time/seed: ${(elapsed / SEEDS).toFixed(0)}ms (total ${(elapsed / 1000).toFixed(1)}s)\n`
);
if (samples.length) {
  console.log("Sample grids:");
  for (const { seed, grid } of samples) {
    console.log(`  seed ${seed}:`);
    for (const row of grid) console.log(`    ${row.toUpperCase()}`);
    console.log();
  }
}
