/**
 * Builds a glossary for the related words shown on each card.
 *
 *   node scripts/fetch-glossary.mjs
 *
 * Tapping "abattoir" under "abate" should open its meaning, and "abattoir" is
 * not in the deck. Looking it up over the network would fail exactly when the
 * app is most used - on a commute, offline - so the definitions ship with the
 * app, in a chunk loaded only when a card is actually opened.
 *
 * Wiktionary text is CC BY-SA 3.0.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const CACHE = join(HERE, '.cache')
const WORD_CACHE = join(CACHE, 'kaikki')
const DECKS = ['core.ts', 'webster.ts', 'roget.ts'].map((f) => join(HERE, '..', 'src', 'data', f))
const MORPHEMES = join(HERE, '..', 'src', 'data', 'morphemes.ts')
const OUT = join(HERE, '..', 'src', 'data', 'glossary.ts')

const CONCURRENCY = 6

async function fetchWord(word) {
  const file = join(WORD_CACHE, `${word}.jsonl`)
  if (existsSync(file)) return readFileSync(file, 'utf8')
  const url = `https://kaikki.org/dictionary/English/meaning/${word[0]}/${word.slice(0, 2)}/${word}.jsonl`
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url)
      if (res.status === 404) {
        writeFileSync(file, '')
        return ''
      }
      if (!res.ok) throw new Error(`status ${res.status}`)
      const text = await res.text()
      writeFileSync(file, text)
      return text
    } catch {
      if (attempt === 2) return ''
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
    }
  }
  return ''
}

const POS_NAME = {
  adj: 'adjective',
  adv: 'adverb',
  noun: 'noun',
  verb: 'verb',
  intj: 'interjection',
  prep: 'preposition',
  conj: 'conjunction',
  pron: 'pronoun',
}

/** Senses nobody wants to meet on a flashcard. */
const NARROW = ['rare', 'dated', 'poetic', 'dialectal', 'slang', 'humorous', 'nonstandard', 'proscribed']

/**
 * The most ordinary usable sense, trimmed to something that fits a small card.
 *
 * Picking simply the shortest was a mistake worth remembering: it gave "agile"
 * the gloss "Agile software development" and "fragile" the gloss "Something
 * that is fragile", because a specialist or circular sense is nearly always
 * briefer than the plain one. Length now only breaks a tie between senses that
 * are equally ordinary.
 */
function readGloss(text, word) {
  let best = null
  let entryIndex = -1
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    let entry
    try {
      entry = JSON.parse(line)
    } catch {
      continue
    }
    if (entry.lang_code !== 'en') continue
    entryIndex++
    for (const sense of entry.senses ?? []) {
      // Skip "obsolete", "archaic" and inflection-only entries.
      if (sense.tags?.some((t) => ['obsolete', 'archaic', 'form-of', 'alt-of'].includes(t))) continue
      const gloss = (sense.glosses ?? [])[0]
      if (!gloss || gloss.length < 12) continue
      const cleaned = gloss
        .replace(/[“”]/g, '"')
        .replace(/\s*\([^)]*\)\s*$/, '')
        .replace(/\s+/g, ' ')
        .trim()
      if (cleaned.length < 12) continue
      const short = cleaned.length > 120 ? cleaned.slice(0, 120).replace(/[\s,]+\S*$/, '') + '…' : cleaned
      // A definition that leans on the word it is defining teaches nothing.
      const circular = new RegExp(`\\b${word.replace(/[^a-z]/gi, '')}\\w*\\b`, 'i').test(short)
      const narrow = sense.tags?.some((t) => NARROW.includes(t))
      const score =
        short.length + (circular ? 400 : 0) + (sense.topics?.length ? 300 : 0) + (narrow ? 250 : 0) + entryIndex * 60
      const candidate = { pos: POS_NAME[entry.pos] ?? entry.pos ?? '', gloss: short, score }
      if (!best || candidate.score < best.score) best = candidate
      break
    }
  }
  return best
}

async function main() {
  mkdirSync(WORD_CACHE, { recursive: true })
  const wanted = new Set()
  const add = (word) => {
    const w = word.trim().toLowerCase()
    if (/^[a-z][a-z-]{2,19}$/.test(w)) wanted.add(w)
  }

  // Every dictionary's own cross-references: relatives, synonyms, opposites.
  let any = false
  for (const path of DECKS) {
    if (!existsSync(path)) continue
    const block = /const TSV = `\n([\s\S]*?)\n`/.exec(readFileSync(path, 'utf8'))
    if (!block) continue
    any = true
    for (const line of block[1].trim().split('\n')) {
      const columns = line.split('\t')
      for (const column of [columns[5], columns[6], columns[7]]) {
        if (column) for (const w of column.split(' ')) add(w)
      }
    }
  }
  if (!any) throw new Error('no deck found; run build-deck.mjs first')

  // And the examples listed against each root in the morpheme table. Leaving
  // these out was the reason most chips opened an empty card: a card's "also
  // from act" row is drawn from here, not from the dictionary, so agent,
  // agenda and react were all offered with nothing behind them.
  for (const line of readFileSync(MORPHEMES, 'utf8').split('\n')) {
    const fields = line.trim().split('|')
    // Roots are listed under every spelling they take - "act/ag", "frag/fract"
    // - and those are the ones carrying the most examples, so the slash has to
    // be allowed through here.
    if (fields.length < 4 || !/^[a-z/-]+$/.test(fields[0])) continue
    for (const w of fields[3].split(',')) add(w)
  }

  const words = [...wanted].sort()
  console.log(`${words.length} related words to look up\n`)

  const glossary = {}
  let done = 0
  const queue = [...words]
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const word = queue.shift()
      const text = await fetchWord(word)
      const gloss = text ? readGloss(text, word) : null
      if (gloss) glossary[word] = gloss
      done++
      if (done % 100 === 0) {
        process.stdout.write(`\r  ${done}/${words.length} fetched, ${Object.keys(glossary).length} defined`)
      }
    }
  })
  await Promise.all(workers)

  const tsv = Object.entries(glossary)
    .map(([word, g]) => `${word}\t${g.pos}\t${g.gloss}`)
    .join('\n')
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${')

  writeFileSync(
    OUT,
    `/**
 * Generated by scripts/fetch-glossary.mjs - do not edit by hand.
 *
 * Meanings for the related words shown under a card, so tapping one works
 * offline. ${Object.keys(glossary).length} words, from Wiktionary (CC BY-SA 3.0) via kaikki.org.
 */
const TSV = \`
${tsv}
\`

export interface Gloss {
  pos?: string
  meaning: string
}

export const GLOSSARY: Record<string, Gloss> = Object.fromEntries(
  TSV.trim()
    .split('\\n')
    .map((line) => {
      const [word, pos, meaning] = line.split('\\t')
      return [word, { pos: pos || undefined, meaning }]
    }),
)
`,
    'utf8',
  )
  console.log(`\n\n${Object.keys(glossary).length} definitions -> ${OUT}`)
}

await main()
