# Tessera

A daily word puzzle. Swap tiles on a 4×4 grid until every row spells a word, and every column too. Same puzzle for everyone, every day.

Play at [tesserapuzzle.com](https://tesserapuzzle.com). Community at [r/TesseraPuzzle](https://reddit.com/r/TesseraPuzzle).

## How it works

- Each day, a deterministic seed (derived from the UTC date) generates a 4×4 gold grid where every row and every column is a valid 4-letter English word.
- The grid is scrambled with 12 swaps. The player swaps tiles to recover the gold solution.
- A row turns green when it matches that day's gold word. The whole grid turns gold on completion.
- Strict matching: a row must exactly equal the gold word. Other accidental valid words don't count.

## Develop

```bash
npm install
npm run dev
```

URL params:

- `?day=YYYY-MM-DD` — replay a past puzzle (isolated: no result/progress writes, no streak update, no email signup, no `puzzle_solved` event). Today's date and any future date silently fall back to today's puzzle so the URL can't be used to peek at upcoming days. Linked from the History modal's "All puzzles" tab.
- `?solve` — show today pre-solved (does not record)
- `?demo` — load a fixed SHOW/HAVE/OVER/WERE grid for screen recordings (does not record)
- combine: `?demo&solve`

## Dictionary

Two word lists power the game:

- `app/lib/words.json` — full SOWPODS-derived list (~4000 four-letter words). Currently unused at runtime but kept for future "is this a real word?" needs.
- `app/lib/solution-words.json` — curated subset (~2000 common English words). Gold rows AND columns are drawn from this list to avoid Scrabble fillers like ESES or PSST.

Regenerate with:

```bash
node app/lib/build-words.mjs
node app/lib/build-solution-words.mjs
```

The solution-words script downloads a Wikipedia frequency list (~33MB) once and caches it at `app/lib/.freq-cache.txt` (gitignored).

## Definitions

The "Today's words" tab fetches definitions live from [dictionaryapi.dev](https://dictionaryapi.dev) (en_GB endpoint) with a lemma fallback for plurals. Definitions are cached in localStorage for 30 days.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind v4 · framer-motion. Deployed on Vercel.

## Credits

Made by [Paul Cooper](https://pjcooper.design).
