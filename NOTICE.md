# Third-party assets and data sources

Tessera is proprietary software (see [LICENSE](./LICENSE)). The following
third-party data sets, libraries, and media files are incorporated into
the build or the runtime experience. Each is listed with its source and
the licence under which it is used.

If anything below looks wrong or out of date, please open an issue.

---

## Wordlists

### Validation list (`app/lib/words.json`)

All four-letter words accepted as valid by the puzzle generator and
checker.

- **Source:** SOWPODS (Standardised Official Word-list for Permissive
  Online Dictionary Scrabble), the canonical UK / international Scrabble
  word list.
- **Distribution used:** the public copy hosted at
  [github.com/jonbcard/scrabble-bot](https://github.com/jonbcard/scrabble-bot/blob/master/src/dictionary.txt).
- **Licence:** SOWPODS itself is in the public domain in the United
  Kingdom and the United States; it is widely redistributed without
  restriction. The mirror used here imposes no additional licence terms.
- **Build script:** [`app/lib/build-words.mjs`](./app/lib/build-words.mjs).
  Filters to four-letter words and removes a manual blocklist of slurs
  and explicit terms.

### Solution list (`app/lib/solution-words.json`)

The roughly two thousand four-letter words from which the daily puzzle
solutions are drawn. Chosen so the solution grid is always built from
recognisable English words rather than obscure Scrabble fillers.

- **Source A (membership):** the validation list above (SOWPODS).
- **Source B (frequency ranking):** the Wikipedia 2023 English word
  frequency list at
  [github.com/IlyaSemenov/wikipedia-word-frequency](https://github.com/IlyaSemenov/wikipedia-word-frequency)
  (file `enwiki-2023-04-13.txt`).
- **Licence (frequency list):** the upstream repository is published
  under the MIT licence; the underlying Wikipedia text is released under
  CC BY-SA 3.0. Tessera redistributes neither the raw Wikipedia text nor
  the frequency list itself; only the derived ranking of words that
  already appear in SOWPODS is bundled.
- **Build script:** [`app/lib/build-solution-words.mjs`](./app/lib/build-solution-words.mjs).
  Intersects the two sources, takes the top ~2,000 by frequency, and
  removes a manual blocklist of slurs, explicit terms, and proper nouns.

---

## Definitions

The "Today's words" tab in the help menu fetches definitions live from
[dictionaryapi.dev](https://dictionaryapi.dev) (`/api/v2/entries/en_GB`).

- **Licence:** the upstream API is itself a wrapper around Wiktionary
  data, redistributed under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
- **Distribution:** definitions are fetched at runtime and cached in the
  visitor's browser. They are not bundled with the build.

---

## Sound effects

The win jingle (`public/win.mp3`) is composed from the following
freesound.org submissions. Attribution is also surfaced to end users in
the in-app Credits tab.

| Title                                       | Author                  | URL                                       | Licence              |
| ------------------------------------------- | ----------------------- | ----------------------------------------- | -------------------- |
| Ice Cream Truck at Park Playground          | fudgealtoid             | https://freesound.org/s/808180/           | CC BY 4.0            |
| Magic Game Win Success 2                    | MLaudio                 | https://freesound.org/s/615100/           | CC0 1.0              |
| Jingle Win Synth 04                         | LittleRobotSoundFactory | https://freesound.org/s/274183/           | CC BY 4.0            |

---

## Fonts

Local copies of Inter and a serif display face are bundled under
`app/_fonts/`. Both are distributed under the SIL Open Font License 1.1.

---

## JavaScript / TypeScript dependencies

All runtime and build-time npm dependencies are declared in
[`package.json`](./package.json) and resolved by the lockfile. Their
licences (predominantly MIT, ISC, Apache-2.0, and BSD-2/3-Clause) are
recorded in `node_modules/<pkg>/LICENSE` for each installed package and
can be enumerated with a tool such as `npx license-checker`.
