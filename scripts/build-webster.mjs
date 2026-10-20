/**
 * Builds a deck from Webster's Revised Unabridged Dictionary (1913).
 *
 *   node scripts/build-webster.mjs [words]
 *
 * This is the public-domain ancestor of today's Merriam-Webster, and its
 * period prose is the reason to have it rather than a flaw to be fixed: a
 * definition written in 1913 reads differently from WordNet's, and that is the
 * point of offering more than one dictionary.
 *
 * It does need handling. Webster's first sense is often obsolete ("abate: To
 * beat down; to overthrow. [Obs.]"), literary citations run into the text, and
 * some definitions are circular. Most of this file is the sifting that keeps
 * only the entries that still read well.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const CACHE = join(HERE, '.cache')
const DICT = join(HERE, '..', 'node_modules', 'wordnet-db', 'dict')
const OUT = join(HERE, '..', 'src', 'data', 'webster.ts')

const MIN_RANK = 18_000
const MAX_RANK = 160_000

/** Senses are numbered "1. ... 2. ..." inside one long string. */
function splitSenses(text) {
  const parts = text.split(/(?:^|\s)(\d{1,2})\.\s+/).filter(Boolean)
  const senses = []
  for (let i = 0; i < parts.length; i++) {
    if (/^\d{1,2}$/.test(parts[i]) && parts[i + 1]) {
      senses.push(parts[i + 1])
      i++
    } else if (!senses.length) senses.push(parts[i])
  }
  return senses.length ? senses : [text]
}

const DEAD = /\[(Obs|Archaic|R|Poetic|Scot|Prov\. Eng|Colloq|Slang|Low|Rare)\b[^\]]*\]/i
const CROSS_REFERENCE = /^(see |same as |a |an )?\b(same as|see|cf\.|akin to|contr\. of|variant of|of or pertaining)\b/i

function cleanSense(sense) {
  // "(Gr. Myth.)", "(Bot.)", "(Chem.)" mark a technical or encyclopedic entry
  // rather than a word in general use.
  if (/^\s*\([A-Z][^)]{1,24}\)/.test(sense)) return ''

  // Webster gives the definition as one sentence and then illustrates it:
  // "...formerly called fixed air. His sparkling sallies bubbled up. Carlyle."
  // Everything after the first sentence is the illustration.
  let out = sense.split(/(?<=\.)\s+(?=[A-Z])/)[0]
  out = out.replace(/"[^"]*"/g, ' ') // quoted illustrations
  // A trailing proper name is the author being cited, not part of the sense.
  out = out.replace(/\s+[A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){0,3}\.\s*$/, ' ')
  out = out.replace(/\[[^\]]*\]/g, ' ')
  out = out.replace(/\([^)]*\)/g, ' ')
  out = out.replace(/;?\s*as,[^.;]*/gi, '') // "as, the lucid orbs of heaven"
  out = out.replace(/\s+/g, ' ').trim()
  out = out.replace(/^[-–—,;:.\s]+/, '')

  const clauses = out.split(/;\s*/)
  let kept = clauses[0] ?? ''
  if (kept.length < 45 && clauses[1]) kept += '; ' + clauses[1]
  return kept.replace(/\s*\.\s*$/, '').replace(/\s+/g, ' ').trim()
}

function definitionFor(raw, word) {
  for (const sense of splitSenses(raw)) {
    if (DEAD.test(sense)) continue
    const cleaned = cleanSense(sense)
    if (cleaned.length < 22 || cleaned.length > 150) continue
    if (CROSS_REFERENCE.test(cleaned)) continue
    if (/[A-Z]{2,}/.test(cleaned)) continue // leftover abbreviations
    if (!/^[A-Za-z]/.test(cleaned)) continue
    // Stripping a parenthetical can leave the sentence hanging: "a univalve
    // mollusk of the genus". A definition that stops mid-phrase is no use.
    if (/\b(of|the|a|an|to|in|on|with|for|and|or|genus|family|called|named|as)\s*$/i.test(cleaned)) continue
    // A definition built from the word teaches nothing.
    if (cleaned.toLowerCase().includes(word.slice(0, Math.max(5, word.length - 3)))) continue
    return cleaned.charAt(0).toLowerCase() + cleaned.slice(1)
  }
  return null
}

function guessPos(definition) {
  if (/^to\s/.test(definition)) return 'verb'
  if (/^(one who|a person|the act|the state|the quality|a |an |the )/.test(definition)) return 'noun'
  return undefined
}

/** WordNet again, purely for synonyms and opposites. */
function readSynsets() {
  const data = {}
  const index = {}
  for (const [key, file] of [
    ['a', 'adj'],
    ['v', 'verb'],
    ['n', 'noun'],
  ]) {
    const byOffset = new Map()
    for (const line of readFileSync(join(DICT, `data.${file}`), 'utf8').split('\n')) {
      if (!line || line.startsWith('  ')) continue
      const bar = line.indexOf('|')
      if (bar === -1) continue
      const f = line.slice(0, bar).trim().split(/\s+/)
      const count = parseInt(f[3], 16)
      const words = []
      for (let i = 0; i < count; i++) words.push(f[4 + i * 2].replace(/_/g, ' ').toLowerCase())
      const rest = f.slice(4 + count * 2)
      const pointers = Number(rest[0])
      const antonyms = []
      for (let i = 0; i < pointers; i++) {
        const at = 1 + i * 4
        if (rest[at] === '!') antonyms.push({ offset: rest[at + 1], pos: rest[at + 2] })
      }
      byOffset.set(f[0], { words, antonyms })
    }
    data[key] = byOffset

    const map = new Map()
    for (const line of readFileSync(join(DICT, `index.${file}`), 'utf8').split('\n')) {
      if (!line || line.startsWith('  ')) continue
      const f = line.trim().split(/\s+/)
      map.set(f[0], f[4 + Number(f[3]) + 2])
    }
    index[key] = map
  }
  return { data, index }
}

async function main() {
  const wanted = Number(process.argv[2] ?? 1000)
  const webster = JSON.parse(readFileSync(join(CACHE, 'webster.json'), 'utf8'))
  const lookup = new Map()
  for (const [word, definition] of Object.entries(webster)) lookup.set(word.toLowerCase(), definition)

  const ranks = new Map()
  readFileSync(join(CACHE, 'count_1w.txt'), 'utf8')
    .split(/\r?\n/)
    .forEach((line, i) => {
      const word = line.split('\t')[0]
      if (word && !ranks.has(word)) ranks.set(word, i + 1)
    })

  const origins = existsSync(join(CACHE, 'wiktionary.json'))
    ? JSON.parse(readFileSync(join(CACHE, 'wiktionary.json'), 'utf8'))
    : {}

  const { data, index } = readSynsets()
  const related = (word) => {
    for (const pos of ['a', 'v', 'n']) {
      const offset = index[pos].get(word)
      if (!offset) continue
      const synset = data[pos].get(offset)
      if (!synset) continue
      return {
        synonyms: synset.words.filter((w) => w !== word && /^[a-z][a-z' -]{2,20}$/.test(w)).slice(0, 5),
        antonyms: synset.antonyms
          .map((a) => data[a.pos === 's' ? 'a' : a.pos]?.get(a.offset)?.words?.[0])
          .filter((w) => w && /^[a-z][a-z' -]{2,20}$/.test(w))
          .slice(0, 3),
      }
    }
    return { synonyms: [], antonyms: [] }
  }

  const candidates = []
  for (const [word, rank] of ranks) {
    if (rank < MIN_RANK || rank > MAX_RANK) continue
    if (!/^[a-z]{4,15}$/.test(word)) continue
    const raw = lookup.get(word)
    if (!raw) continue
    const meaning = definitionFor(raw, word)
    if (!meaning) continue
    candidates.push({ word, rank, pos: guessPos(meaning), meaning })
  }
  candidates.sort((a, b) => a.rank - b.rank)

  // Spread across the band rather than taking the easiest end of it.
  const step = Math.max(1, candidates.length / wanted)
  const entries = []
  const taken = new Set()
  for (let i = 0; entries.length < wanted && Math.floor(i * step) < candidates.length; i++) {
    const candidate = candidates[Math.floor(i * step)]
    if (!candidate || taken.has(candidate.word)) continue
    taken.add(candidate.word)
    const extra = related(candidate.word)
    const origin = origins[candidate.word]
    entries.push({
      ...candidate,
      originLang: origin?.language,
      origin: origin?.origin,
      relatedWords: origin?.related,
      synonyms: extra.synonyms,
      antonyms: extra.antonyms,
    })
  }
  entries.sort((a, b) => a.word.localeCompare(b.word))

  const tsv = entries
    .map((e) =>
      [
        e.word,
        e.pos ?? '',
        e.meaning,
        e.originLang ?? '',
        e.origin ?? '',
        (e.relatedWords ?? []).join(' '),
        (e.synonyms ?? []).join(' '),
        (e.antonyms ?? []).join(' '),
      ].join('\t'),
    )
    .join('\n')
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${')

  writeFileSync(
    OUT,
    `import type { RawEntry } from '../db'

/**
 * Generated by scripts/build-webster.mjs - do not edit by hand.
 *
 * ${entries.length} entries from Webster's Revised Unabridged Dictionary (1913), public
 * domain, in its own words. Obsolete senses, literary citations and circular
 * definitions are sifted out; the period voice that remains is the point.
 *
 * Synonyms and opposites are WordNet 3.0 (Princeton).
 */
const TSV = \`
${tsv}
\`

export const WEBSTER_PACK: RawEntry[] = TSV.trim()
  .split('\\n')
  .map((line) => {
    const [word, pos, meaning, originLang, origin, related, synonyms, antonyms] = line.split('\\t')
    return {
      word,
      pos: pos || undefined,
      meaning,
      originLang: originLang || undefined,
      origin: origin || undefined,
      related: related ? related.split(' ') : undefined,
      synonyms: synonyms ? synonyms.split(' ') : undefined,
      antonyms: antonyms ? antonyms.split(' ') : undefined,
    }
  })
  .filter((e) => e.word && e.meaning)
`,
    'utf8',
  )

  writeFileSync(
    join(HERE, '..', 'src', 'data', 'webster-meta.ts'),
    `/** Generated by scripts/build-webster.mjs - do not edit by hand. */
export const WEBSTER_NAME = "Webster's 1913"
export const WEBSTER_COUNT = ${entries.length}
`,
    'utf8',
  )

  console.log(`${entries.length} entries -> ${OUT}\n`)
  for (const e of entries.slice(0, 10)) console.log(`  ${e.word.padEnd(15)}${(e.pos ?? '').padEnd(7)}${e.meaning}`)
}

await main()
