# WordFlow

Hands-free vocabulary review. A word appears on its own, pauses while you try to
remember it, then shows the meaning and moves on. Bring any dictionary or word
list; nothing leaves your device.

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

```bash
npm run check:parts
```

| Measure | Result |
| --- | --- |
| Words that should break down | 24/25 |
| Words that must stay quiet (plain English, false friends) | 26/26 |
| Built-in deck covered | 65/279 |

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
