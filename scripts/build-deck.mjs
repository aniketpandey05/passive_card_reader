/**
 * Builds the built-in vocabulary deck from open data.
 *
 *   node scripts/build-deck.mjs [count]
 *
 * Definitions come from WordNet 3.0 (Princeton, permissive licence), whose
 * glosses are written to be short and modern - the opposite of Webster 1913,
 * whose first sense is usually archaic ("abate: to beat down; to overthrow.
 * [Obs.]") and whose prose rarely fits on a card.
 *
 * Word choice comes from frequency ranks over the Google Web Trillion Word
 * Corpus. Rank is the difficulty signal: everyday words sit above 15,000
 * ("ubiquitous" 19k, "lucid" 25k, "abate" 41k, "laconic" 104k), so the band
 * picks words a reader meets but may not know.
 *
 * The hand-written definitions in starter.ts win wherever they exist; WordNet
 * fills the rest.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { originFor, readEtymologies } from './etymology.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const CACHE = join(HERE, '.cache')
const DICT = join(HERE, '..', 'node_modules', 'wordnet-db', 'dict')
const STARTER = join(HERE, '..', 'src', 'data', 'starter.ts')
const OUT = join(HERE, '..', 'src', 'data', 'core.ts')

const FREQUENCY_URL = 'https://norvig.com/ngrams/count_1w.txt'
// Everyday English runs out around 20,000. Beyond 150,000 words stop being
// worth the card. Known anchors: ubiquitous 19k, lucid 25k, meticulous 35k,
// ephemeral 39k, abate 41k, austere 53k, quixotic 79k, laconic 104k.
const MIN_RANK = 20_000
const MAX_RANK = 150_000
/** Nouns make weaker cards than adjectives and verbs, so cap their share. */
const MAX_NOUN_SHARE = 0.3

/**
 * WordNet groups nouns and verbs into lexicographer files. Keeping the
 * abstract ones is what separates vocabulary from inventory: "paucity" and
 * "antipathy" are worth a card, "tractor" and "spaniel" are not.
 */
const KEEP_NOUN_FILES = new Set([
  4, // noun.act
  7, // noun.attribute
  9, // noun.cognition
  10, // noun.communication
  11, // noun.event
  12, // noun.feeling
  16, // noun.motive
  22, // noun.process
  24, // noun.relation
  26, // noun.state
])

const POS_NAME = { a: 'adjective', s: 'adjective', v: 'verb', n: 'noun', r: 'adverb' }

async function frequencyRanks() {
  mkdirSync(CACHE, { recursive: true })
  const file = join(CACHE, 'count_1w.txt')
  if (!existsSync(file)) {
    process.stdout.write('downloading frequency list… ')
    const res = await fetch(FREQUENCY_URL)
    if (!res.ok) throw new Error(`${FREQUENCY_URL} -> ${res.status}`)
    writeFileSync(file, Buffer.from(await res.arrayBuffer()))
    console.log('done')
  }
  const ranks = new Map()
  readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .forEach((line, i) => {
      const word = line.split('\t')[0]
      if (word && !ranks.has(word)) ranks.set(word, i + 1)
    })
  return ranks
}

/** offset -> { lexFile, gloss } for one part of speech. */
function readData(pos) {
  const byOffset = new Map()
  for (const line of readFileSync(join(DICT, `data.${pos}`), 'utf8').split('\n')) {
    if (!line || line.startsWith('  ')) continue // licence header
    const bar = line.indexOf('|')
    if (bar === -1) continue
    const head = line.slice(0, bar)
    const fields = head.trim().split(/\s+/)
    byOffset.set(fields[0], {
      lexFile: Number(fields[1]),
      gloss: line.slice(bar + 1).trim(),
      // ";c" marks a topical domain - anatomy, grammar, religion and the like.
      // Those are jargon rather than vocabulary, however rare the word is.
      domainSpecific: /\s;c\s/.test(head),
    })
  }
  return byOffset
}

/** lemma -> first (most common) synset offset for one part of speech. */
function readIndex(pos) {
  const bySense = new Map()
  for (const line of readFileSync(join(DICT, `index.${pos}`), 'utf8').split('\n')) {
    if (!line || line.startsWith('  ')) continue
    const f = line.trim().split(/\s+/)
    const pointerCount = Number(f[3])
    const firstOffset = f[4 + pointerCount + 2]
    if (f[0] && firstOffset) bySense.set(f[0], firstOffset)
  }
  return bySense
}

/** WordNet glosses read "definition; "an example"; "another"". */
function cleanGloss(gloss) {
  const definition = gloss
    .split(';')
    .filter((part) => !part.includes('"'))
    .join(';')
    .trim()
  return definition
    .replace(/^\(([^)]*)\)\s*/, '') // "(usually followed by `to')"
    .replace(/\s*\([^)]*\)\s*$/, '')
    .replace(/\s+/g, ' ')
    .replace(/[;,]\s*$/, '')
    .trim()
}

const BAD_GLOSS = /^(of or |relating to|a native|an inhabitant|the act of being|used of|being |characteristic of a)/i
/** Glosses that describe an object rather than an idea. */
const CONCRETE_GLOSS =
  /^(a|an|any)\s+(device|tool|instrument|machine|container|vehicle|building|room|garment|fabric|book|sheet|piece|plant|tree|shrub|animal|bird|fish|insect|drug|chemical|compound|metal|food|dish|drink|weapon|game|unit|coin|boat|ship)\b/i

/**
 * Compounds of two ordinary words ("workbook", "workload") teach nothing a
 * reader cannot already work out, however rare the compound itself is.
 */
function isCompoundOfCommonWords(word, ranks) {
  for (let i = 3; i <= word.length - 3; i++) {
    const left = ranks.get(word.slice(0, i))
    const right = ranks.get(word.slice(i))
    if (left && right && left < 8000 && right < 8000) return true
  }
  return false
}

/** Participles of common verbs: "abused", "winding". */
function isParticipleOfCommonWord(word, ranks) {
  const stems = []
  if (word.endsWith('ed')) stems.push(word.slice(0, -2), word.slice(0, -1))
  if (word.endsWith('ing')) stems.push(word.slice(0, -3), word.slice(0, -3) + 'e')
  return stems.some((stem) => stem.length > 2 && (ranks.get(stem) ?? Infinity) < 12_000)
}

function readStarter() {
  const text = readFileSync(STARTER, 'utf8')
  const block = /const TSV = `\n([\s\S]*?)\n`/.exec(text)
  if (!block) throw new Error('could not read the curated deck out of starter.ts')
  return block[1]
    .trim()
    .split('\n')
    .map((line) => {
      const [word, pos, meaning] = line.split('\t')
      return { word, pos, meaning }
    })
}

async function main() {
  const wanted = Number(process.argv[2] ?? 1000)
  const ranks = await frequencyRanks()

  const data = { a: readData('adj'), v: readData('verb'), n: readData('noun'), r: readData('adv') }
  const index = { a: readIndex('adj'), v: readIndex('verb'), n: readIndex('noun'), r: readIndex('adv') }

  const curated = readStarter()
  const entries = [...curated]
  const have = new Set(curated.map((e) => e.word.toLowerCase()))

  // Everything in the band that survives the filters, in rank order.
  const candidates = []
  for (const [word, rank] of ranks) {
    if (rank < MIN_RANK || rank > MAX_RANK) continue
    if (!/^[a-z]{5,15}$/.test(word) || have.has(word)) continue
    if (isCompoundOfCommonWords(word, ranks) || isParticipleOfCommonWord(word, ranks)) continue

    for (const pos of ['a', 'v', 'n', 'r']) {
      const offset = index[pos].get(word)
      if (!offset) continue
      const synset = data[pos].get(offset)
      if (!synset || synset.domainSpecific) continue
      if (pos === 'n' && !KEEP_NOUN_FILES.has(synset.lexFile)) continue
      if (pos === 'r' && word.endsWith('ly')) continue // just the adjective again

      const meaning = cleanGloss(synset.gloss)
      if (meaning.length < 20 || meaning.length > 120) continue
      if (BAD_GLOSS.test(meaning) || CONCRETE_GLOSS.test(meaning)) continue
      // A definition that uses the word teaches nothing.
      if (meaning.toLowerCase().includes(word.slice(0, Math.max(5, word.length - 3)))) continue

      candidates.push({ word, rank, pos: POS_NAME[pos], meaning, isNoun: pos === 'n' })
      break
    }
  }
  candidates.sort((a, b) => a.rank - b.rank)

  // Spread the picks across the whole band rather than taking the easiest end,
  // so the deck holds "lucid" and "laconic" alike.
  const need = wanted - entries.length
  const step = Math.max(1, candidates.length / need)
  const nounLimit = Math.round(wanted * MAX_NOUN_SHARE)
  let nouns = 0
  const picked = new Set()
  for (let pass = 0; pass < 2 && entries.length < wanted; pass++) {
    for (let i = 0; entries.length < wanted; i++) {
      const at = pass === 0 ? Math.floor(i * step) : i
      if (at >= candidates.length) break
      const candidate = candidates[at]
      if (picked.has(at) || have.has(candidate.word)) continue
      if (candidate.isNoun && nouns >= nounLimit) continue
      picked.add(at)
      have.add(candidate.word)
      if (candidate.isNoun) nouns++
      entries.push({ word: candidate.word, pos: candidate.pos, meaning: candidate.meaning })
    }
  }

  entries.sort((a, b) => a.word.localeCompare(b.word))

  // Where the word came from, for the many words no morpheme table can explain.
  // Optional: without the GCIDE files the deck simply ships without origins.
  let origins = new Map()
  try {
    origins = readEtymologies(CACHE)
  } catch {
    console.log('no GCIDE in scripts/.cache - building without word origins.')
    console.log('to include them: download https://ftp.gnu.org/gnu/gcide/gcide-0.53.tar.xz')
    console.log('into scripts/.cache and run: python scripts/extract_gcide.py\n')
  }
  let withOrigin = 0
  for (const entry of entries) {
    const origin = originFor(entry.word.toLowerCase(), origins)
    if (!origin) continue
    entry.originLang = origin.language
    entry.origin = origin.text
    withOrigin++
  }

  const tsv = entries
    .map((e) => `${e.word}\t${e.pos ?? ''}\t${e.meaning}\t${e.originLang ?? ''}\t${e.origin ?? ''}`)
    .join('\n')
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${')

  writeFileSync(
    OUT,
    `import type { RawEntry } from '../db'

/**
 * Generated by scripts/build-deck.mjs - do not edit by hand.
 *
 * ${curated.length} hand-written entries, then ${entries.length - curated.length} drawn from WordNet 3.0.
 *
 * WordNet 3.0 Copyright 2006 by Princeton University. All rights reserved.
 * Used under the WordNet licence, which permits use, copying, modification and
 * distribution provided this notice travels with it.
 *
 * Word choice uses frequency ranks over the Google Web Trillion Word Corpus
 * (ranks ${MIN_RANK.toLocaleString()}-${MAX_RANK.toLocaleString()}): common enough to meet, uncommon enough to be worth learning.
 *
 * Origins (${withOrigin} of ${entries.length}) come from GCIDE, the GNU edition of Webster's
 * Revised Unabridged Dictionary (1913), which is distributed under the GPL.
 */
const TSV = \`
${tsv}
\`

export const CORE_PACK: RawEntry[] = TSV.trim()
  .split('\\n')
  .map((line) => {
    const [word, pos, meaning, originLang, origin] = line.split('\\t')
    return {
      word,
      pos: pos || undefined,
      meaning,
      originLang: originLang || undefined,
      origin: origin || undefined,
    }
  })
  .filter((e) => e.word && e.meaning)

export const CORE_NAME = 'Core vocabulary (${entries.length} words)'
`,
    'utf8',
  )

  console.log(`\n${entries.length} entries (${curated.length} hand-written, ${entries.length - curated.length} from WordNet)`)
  console.log(`-> ${OUT}\n`)
  const fromWordnet = entries.filter((e) => !curated.some((c) => c.word === e.word))
  for (const e of fromWordnet.slice(0, 10)) console.log(`  ${e.word.padEnd(16)}${(e.pos ?? '').padEnd(11)}${e.meaning}`)
  console.log('  …')
  for (const e of fromWordnet.slice(-6)) console.log(`  ${e.word.padEnd(16)}${(e.pos ?? '').padEnd(11)}${e.meaning}`)
}

await main()
