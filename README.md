# WordFlow

Hands-free vocabulary review. A word appears on its own, pauses while you try to
remember it, then shows the meaning and moves on. Bring any dictionary or word
list; nothing leaves your device.

## On a phone

Pushing to `main` builds and deploys to GitHub Pages
(`.github/workflows/deploy.yml`), then the app installs to the home screen from
the browser: Android and desktop Chrome get an **Install** button in the app
itself, and iOS Safari gets the Share → Add to Home Screen instruction, since
Safari has no install API. Installed, it opens full screen and works offline -
decks, progress and settings are all on the device.

One-time setup: **Settings → Pages → Source: GitHub Actions** in the repository.

The first load is 118 KB gzipped. The 1,000-word deck is a separate 41 KB chunk
fetched only when the deck is actually added, and PDF support (pdf.js and
Tesseract, together far larger than the app) only when a PDF is opened.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:5173. `npm run build` produces a deployable `dist/`
(typechecks first), and `npm run preview` serves that build.

## How it works

- **Installable PWA.** React + TypeScript + Vite, with a service worker, so it
  installs on a phone and runs offline. No server, no accounts, no costs.
- **All local.** Decks, entries, progress and settings live in IndexedDB via
  Dexie (`src/db.ts`). Nothing is uploaded anywhere.
- **Length-aware timing** (`src/lib/timing.ts`). The pause before the meaning is
  a fixed setting; how long the meaning *stays* is computed from its length at a
  words-per-minute setting, so short and long definitions both get fair time.
  One speed slider (0.5x-2.5x) scales everything, including the voice.
- **Voiceover** uses the browser's built-in speech (`src/lib/speech.ts`). Cards
  wait for the voice to finish before advancing, so nothing gets cut off.
  On phones, speech stops when the screen locks - that needs a native shell.
- **Screen wake lock** while playing, so a session doesn't get interrupted.
- **Word parts** under the meaning, where they are known: `anachronism` shows
  *Greek · ana- up, back + chron time + -ism doctrine*. See below.

## Word parts

A table of Latin and Greek morphemes (`src/data/morphemes.ts`) plus an analyzer
(`src/lib/morphology.ts`), rather than hand-written etymology per word. A table
works on whatever you import; per-word notes only ever cover the words someone
thought to write them for.

It is tuned for precision, because a missing breakdown costs a hint while a
wrong one teaches a false etymology. So a root must sit exactly where a root
belongs - right after the prefix - the parts must account for 75% of the word,
and both halves of a compound must be at least four letters. That last rule is
what stops `mother` becoming *mot + her*.

Coincidences that survive all of that are listed explicitly, with the real
derivation in a comment: `mitigate` is *mitis* "mild", not *mittere* "send";
`volatile` is *volare* "fly", not *velle* "wish". `OVERRIDES` goes the other
way, giving the true story where an analyzer could never find it - `ephemeral`
is *epi-* + *hemera*, lasting but a day.

### Where the word came from

Origins and related words come from **Wiktionary**, read through kaikki.org's
machine-readable extracts (`scripts/fetch-wiktionary.mjs`, cached per word so a
re-run costs nothing).

| | with an origin | with related words |
| --- | --- | --- |
| Webster 1913 (GCIDE) | 586 / 1000 | — |
| Wiktionary | **856 / 1000** | **689 / 1000** |

Webster was the earlier source and it caps out, for a simple reason: it is a
book from 1913 and has no entry for `absenteeism`, `acculturation` or anything
coined since. Wiktionary is current, names the language in plain English, and
already lists the related and derived forms the family row wants. It replaced
GCIDE outright, which also retires the GPL dependency - Wiktionary text is
CC BY-SA 3.0.

Three things took the work. Some entries lead with a reconstruction tree
(`Proto-Indo-European *h₂erk-…`) and put the readable prose last. Greek etymons
are in Greek script with the romanization in parentheses - `ἐφήμερος
(ephḗmeros)` - so the parenthetical is parsed and the romanization preferred,
since `ἐφήμερος` on a card helps nobody. And Wiktionary files loose
associations under "related terms", so `ephemeral` sits beside `unstable`;
a relative now has to share word stock with the headword or its etymon.

Where there is no language at all, a compound etymology still names the parts,
which is the breakdown by another route: `acculturation` shows *ad- "toward" +
culture + -ation "a process"*.

### What the morpheme table adds on top

A morpheme table can only explain words built from roots it knows. `taciturn`
is Latin *taciturnus*, and an analyzer that knows `tac` still cannot account
for `-iturn`, so the strict rules throw the whole thing away and the card says
nothing. That is the single biggest reason words show no derivation, and no
amount of extra roots fixes it.

So where there is no breakdown, the card shows the origin instead - *LATIN ·
taciturnus* - taken from the dictionary's own etymology. Coverage goes from
**211 of 1,000** words with a breakdown to **586** that show where the word
came from.

`scripts/etymology.mjs` parses GCIDE (the GNU edition of Webster's 1913) and
expands its abbreviations into English: `[L. taciturnus: cf. F. taciturne]`
becomes *Latin taciturnus*. Cross references, cognates and literary notes are
dropped. Words whose etymology lives on their base form are followed there,
because Webster gives it once - `ephemeral` has none of its own, `ephemera`
has it.

> **Licence note:** GCIDE is distributed under the **GPL**, so the origin
> strings in `src/data/core.ts` carry that licence, unlike the WordNet
> definitions and the public-domain 1913 text underneath. If this project ever
> takes a permissive licence, re-derive the origins from the Project Gutenberg
> edition of Webster 1913, which is pure public domain.

### Word families

Under the breakdown, the card prints the cross-reference a dictionary would:
*also from **spect**: perspicacious · specious · inspect · spectacle*. Words
from your own deck come first and are tappable - following one jumps to that
card, and `←` comes back - while the rest are shown for the pattern.

Those example words are carried in the morpheme table and are the reason the
feature exists at all. Indexing only the current deck gave families to 15 of
279 words, because a few hundred words rarely hold two relatives of the same
root; with examples it is 50, and every one of them teaches the pattern rather
than the coincidence of what you happen to own.

Root families are stored per entry and indexed (`*roots` in Dexie), so this
works on an imported dictionary too, and existing decks are backfilled by a
schema migration rather than needing a re-import.

Tapping any related word opens a small card with its meaning, and pages through
the rest of the set. Words in the deck come from the deck; the others come from
a bundled glossary of 1,845 definitions (`npm run build:glossary`), loaded the
first time a card is opened. Looking them up over the network would fail
exactly when the app is most used - offline, on a commute.

Words can be marked important with the star in the top bar, or `S`. Starred
words are listed in "Start from…", so they can be found again.

```bash
npm run check:parts
```

| Measure | Result |
| --- | --- |
| Words that should break down | 24/25 |
| Words that must stay quiet (plain English, false friends) | 26/26 |
| Built-in deck covered | 211/1000 |

Coverage is a fifth of the deck, and the reason is measurable: of the words with
no breakdown, 625 contain no root the table knows, while only 88 fail on the
thresholds. So coverage is bounded by how many roots are written down, not by
how strict the rules are - each batch of ~40 roots has been worth about two
points. The rest are Germanic (`thwart`, `wary`) and have nothing Latin or Greek
to show.

Known errors are handled by auditing the output and excluding by name. The last
pass over 43 sampled breakdowns found four wrong - `satiric` is *satura*
"medley" not *satis* "enough", `ventilate` is *ventus* "wind" not *venire*
"come" - which is roughly a 9% error rate before exclusions. That hand audit is
the real cost of this feature, and it is the right cost: the alternative is
confidently teaching a false derivation.

## Where the words come from

```bash
npm run build:deck     # regenerates src/data/core.ts
```

1,000 words: 279 written by hand, the rest built by `scripts/build-deck.mjs`
from open data.

- **Definitions: WordNet 3.0** (Princeton, permissive licence). Its glosses are
  short and modern, which is what a card needs.
- **Word choice: frequency rank** over the Google Web Trillion Word Corpus.
  Rank is the difficulty signal - everyday English runs out around 20,000, and
  the useful band runs to about 150,000 (`ubiquitous` 19k, `lucid` 25k, `abate`
  41k, `laconic` 104k). Picks are spread across that band rather than taken from
  its easy end, so the deck holds both.
- **WordNet's own categories** separate vocabulary from inventory: abstract
  nouns are kept, `noun.artifact` and `noun.animal` are not, and synsets tagged
  with a topical domain are dropped as jargon. Compounds of two common words
  (`workbook`, `workload`) and participles of common verbs (`abused`) go too.

### Webster 1913 was tried first, and rejected

It is the obvious public-domain dictionary, and it does not work for this. Its
first sense is usually obsolete - *abate: "To beat down; to overthrow. [Obs.]"*,
*candid: "White. [Obs.]"* - definitions are circular (*accessibility: "the
quality of being accessible"*), literary citations run into the text (*"Judg.
v"*), and the prose is a century old. Even after writing the cleaner, the deck
it produced was full of `workshop`, `writer` and `zero`. WordNet gives
`acrimonious: "marked by strong resentment or cynicism"` instead.

Roget's Thesaurus has the same problem for definitions - it has none - though it
would suit a future "similar words" feature.

A quarter of the deck is the honest number: `thwart`, `wary` and `staunch` are
Germanic and have no Latin or Greek parts to show, so the app says nothing.

## Importing text

`src/lib/parse.ts` turns pasted text or a dropped file into entries:

| Input | Handled |
| --- | --- |
| CSV / TSV | Quoted fields, embedded commas and newlines, header detection |
| Any delimited text | Delimiter guessed from the first 40 lines |
| `word - meaning` lines | Tab, en/em dash, hyphen, colon, or 2+ spaces; numbered lists |
| JSON | Arrays of objects, or a plain `{ "word": "meaning" }` map |

Columns are guessed (by header name, else by shape: shortest column is the word,
longest is the meaning) and a leading part of speech is pulled out of the
meaning, so `v. to lessen` becomes *verb* + "to lessen". The import screen always
shows the guess as a live preview with column dropdowns, because detection is a
guess and the user is the one who can see it's wrong.

## Importing PDFs

Drop a PDF and it goes through its own flow: choose pages, read, then check the
result. Everything runs in the browser - the file is never uploaded.

**Two sources, one pipeline.** pdf.js (text layer) and Tesseract (OCR) both
produce positioned words, so they are normalized into the same shape and share
all the logic downstream. OCR is only used for pages that have no text layer,
because extracting real text is both exact and instant, while recognising an
image is neither.

```
PDF ─┬─ pdf.js text layer ──┐
     └─ render → OCR ───────┴─→ words → lines → columns → strip running heads
                                      → de-hyphenate → entries → validate
```

What the preprocessing does, and why:

- **Columns** are found as vertical bands almost no word crosses. Narrow strips
  are merged back in, because a numbered list's "1. 2. 3." column looks exactly
  like a gutter otherwise.
- **Running heads** are dropped by shape, not text: guide words change on every
  page, so what identifies them is being the topmost row, far short of the
  column width, repeating across pages.
- **Hyphenation** across line breaks is rejoined (`delib-` + `erate`).
- **Entries** are detected by one strategy chosen for the whole document - bold
  headwords, hanging indent, numbered list, or word-then-separator - because a
  dictionary is typeset consistently. The review screen names the strategy it
  picked and lets you override it, which is far easier to correct than a blend
  of weak per-line signals.
- **Images are deskewed and binarized** before OCR (`src/lib/ocr.ts`). Skew
  matters for more than legibility: entry detection reads each column's left
  margin, and a tilted page smears those margins.
- **Validation** flags what to look at: out of alphabetical order (dictionaries
  are sorted, so this is a free correctness check), suspiciously short or long
  meanings, odd headwords, and OCR noise where a part of speech should be.

### Measured on the fixtures

`fixtures/` holds generated PDFs and ground truth built from the starter pack,
so expectations can't drift from the content.

```bash
npm run fixtures    # regenerate the PDFs (needs Python, reportlab, Pillow)
npm run check:pdf   # text-layer pipeline vs expected.json
npm run check:ocr   # OCR pipeline, crooked vs deskewed
```

| Fixture | Result |
| --- | --- |
| 3-page two-column dictionary, bold headwords, guide words, hyphenation | 100/100 headwords, 100/100 meanings |
| 2-page numbered word list | 34/34 headwords, 34/34 meanings |
| Scanned page: skewed 0.4°, blurred, speckled (OCR) | 16/16 entries, 14/16 headwords, 12/16 meanings exact, 4 flagged |

The scanned numbers are what honest OCR looks like on a degraded page: a few
characters are misread (`acumen` → `acume`, a lost space in `of praise`). That
is the reason the review step exists, and why the flags point at the rows most
likely to be wrong.

## Keyboard

`Space` play/pause · `←` `→` previous/next · `↓` reveal now · `Esc` back

## Where this is going

1. **Dictionary packs** - Open English WordNet (CC-BY) as a downloadable pack,
   plus a word-frequency filter so "common words only" is possible. Starting at
   "A" in a full dictionary otherwise means hours of obscure entries.
2. **Known / starred words** so learned words can be skipped.
3. **Faster OCR** - Tesseract is the free, private option but costs seconds per
   page, so a long book is imported in ranges. A better open model behind an
   optional server would suit someone importing a whole dictionary.
4. **Native shell** (Capacitor) for screen-off audio playback.

## Layout

```
src/
  db.ts              Dexie schema, deck creation, search
  types.ts           Deck, Entry, Progress, Settings
  data/starter.ts    built-in deck
  lib/
    timing.ts        phase durations
    speech.ts        text-to-speech wrapper
    parse.ts         text import detection and parsing
    pdf.ts           pdf.js: open, extract text layer, rasterize
    pdfsource.ts     text-item mapping (no pdf.js import, so Node can test it)
    ocr.ts           Tesseract, deskew, contrast, binarize
    layout.ts        lines, columns, running heads, hyphenation
    dict.ts          entry detection, cleanup, validation
    useEscape.ts     close-on-Escape for sheets
  components/
    Library.tsx      deck list, empty state
    Player.tsx       the card loop
    ImportPanel.tsx  text import, preview, column mapping
    PdfImport.tsx    PDF flow: pages, reading, review
    StartPicker.tsx  resume / A-Z / search
    SettingsSheet.tsx
fixtures/            generated test PDFs, ground truth, and the two checks
```

PDF support is code-split: the app loads at ~112 KB gzipped, and pdf.js and
Tesseract arrive only when someone actually opens a PDF.

The 100 definitions in the starter pack were written for this project and are
free to use. Imported content stays on the user's device, which matters because
most dictionary files people already have are copyrighted.
