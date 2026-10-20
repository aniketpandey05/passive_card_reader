/**
 * Builds a deck from Roget's Thesaurus (1911), public domain.
 *
 *   node scripts/build-roget.mjs [words]
 *
 * Roget is organised by concept, not alphabetically, and that is the whole
 * point of it: the words for Aid sit together, so they are learned together.
 * This deck keeps that order, which is the one thing an alphabetical
 * dictionary cannot give you.
 *
 * Two filters make a 1911 book usable. Every word must exist in WordNet, which
 * quietly removes "pauciloquy" and "obmutescence" while keeping the live
 * vocabulary, and must sit in a sane frequency band, which removes the merely
 * obscure. Definitions come from WordNet, since Roget has none.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const CACHE = join(HERE, '.cache')
const DICT = join(HERE, '..', 'node_modules', 'wordnet-db', 'dict')
const OUT = join(HERE, '..', 'src', 'data', 'roget.ts')

const MAX_PER_CONCEPT = 6
// Three words still read as a cluster; two do not.
const MIN_PER_CONCEPT = 3
const MIN_RANK = 2_000
const MAX_RANK = 200_000

const POS_NAME = { adj: 'adjective', adv: 'adverb', noun: 'noun', verb: 'verb' }

function readData(pos) {
  const byOffset = new Map()
  for (const line of readFileSync(join(DICT, `data.${pos}`), 'utf8').split('\n')) {
    if (!line || line.startsWith('  ')) continue
    const bar = line.indexOf('|')
    if (bar === -1) continue
    const head = line.slice(0, bar)
    const fields = head.trim().split(/\s+/)
    byOffset.set(fields[0], { gloss: line.slice(bar + 1).trim(), domainSpecific: /\s;c\s/.test(head) })
  }
  return byOffset
}

function readIndex(pos) {
  const map = new Map()
  for (const line of readFileSync(join(DICT, `index.${pos}`), 'utf8').split('\n')) {
    if (!line || line.startsWith('  ')) continue
    const f = line.trim().split(/\s+/)
    map.set(f[0], f[4 + Number(f[3]) + 2])
  }
  return map
}

function cleanGloss(gloss) {
  const definition = gloss
    .split(';')
    .filter((part) => !part.includes('"'))
    .join(';')
    .trim()
  return definition
    .replace(/^\(([^)]*)\)\s*/, '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .replace(/\s+/g, ' ')
    .replace(/[;,]\s*$/, '')
    .trim()
}

/**
 * "#585. Taciturnity.—N. silence, muteness..." -> "Taciturnity".
 * The heading runs straight into the entry's first words, so it is cut at the
 * dash or the first sentence break rather than merely tidied.
 */
function conceptName(raw) {
  const head = raw
    .replace(/\[[^\]]*\]/g, ' ') // "[Motion beyond]"
    .split(/[—–]|--/)[0] // the dash before the part-of-speech marker
    .split(/\.\s/)[0]
  return head
    .replace(/[^A-Za-z\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function main() {
  const wanted = Number(process.argv[2] ?? 1200)

  const ranks = new Map()
  const rankFile = join(CACHE, 'count_1w.txt')
  if (existsSync(rankFile)) {
    readFileSync(rankFile, 'utf8')
      .split(/\r?\n/)
      .forEach((line, i) => {
        const word = line.split('\t')[0]
        if (word && !ranks.has(word)) ranks.set(word, i + 1)
      })
  }

  const data = { adj: readData('adj'), verb: readData('verb'), noun: readData('noun'), adv: readData('adv') }
  const index = { adj: readIndex('adj'), verb: readIndex('verb'), noun: readIndex('noun'), adv: readIndex('adv') }

  const define = (word) => {
    for (const pos of ['adj', 'verb', 'noun', 'adv']) {
      const offset = index[pos].get(word)
      if (!offset) continue
      const synset = data[pos].get(offset)
      if (!synset || synset.domainSpecific) continue
      const meaning = cleanGloss(synset.gloss)
      if (meaning.length < 18 || meaning.length > 130) continue
      if (meaning.toLowerCase().includes(word.slice(0, Math.max(5, word.length - 3)))) continue
      return { pos: POS_NAME[pos], meaning }
    }
    return null
  }

  const text = readFileSync(join(CACHE, 'roget.txt'), 'utf8')
  const blocks = text.split(/\n(?=#\d+\.)/).filter((b) => /^#\d+\./.test(b))

  const entries = []
  const seen = new Set()
  for (const block of blocks) {
    if (entries.length >= wanted) break
    const heading = /^#(\d+)\.\s*([^\n]*)/.exec(block)
    if (!heading) continue
    const theme = conceptName(heading[2])
    if (!theme || theme.length > 28) continue

    const candidates = []
    const words = new Set(
      block
        .replace(/\[[^\]]*\]/g, ' ')
        .replace(/&c\.?/g, ' ')
        .replace(/\([^)]*\)\s*\d*/g, ' ')
        .split(/[;,\n]/)
        .map((s) => s.replace(/[|.#\d]/g, '').trim().toLowerCase())
        .filter((s) => /^[a-z][a-z'-]{3,16}$/.test(s)),
    )

    for (const word of words) {
      if (seen.has(word)) continue
      const rank = ranks.get(word) ?? Number.POSITIVE_INFINITY
      if (rank < MIN_RANK || rank > MAX_RANK) continue
      const defined = define(word)
      if (!defined) continue
      candidates.push({ word, rank, ...defined })
    }

    if (candidates.length < MIN_PER_CONCEPT) continue
    // The most recognisable words of the concept, so a cluster reads as one.
    candidates.sort((a, b) => a.rank - b.rank)
    for (const c of candidates.slice(0, MAX_PER_CONCEPT)) {
      seen.add(c.word)
      entries.push({ word: c.word, pos: c.pos, meaning: c.meaning, theme })
    }
  }

  const tsv = entries
    .map((e) => `${e.word}\t${e.pos ?? ''}\t${e.meaning}\t${e.theme}`)
    .join('\n')
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${')

  const themes = new Set(entries.map((e) => e.theme)).size

  writeFileSync(
    OUT,
    `import type { RawEntry } from '../db'

/**
 * Generated by scripts/build-roget.mjs - do not edit by hand.
 *
 * ${entries.length} words from ${themes} of Roget's concepts, kept in his order rather than
 * alphabetical, so the words for one idea arrive together.
 *
 * Roget's Thesaurus (1911) is public domain. Definitions are WordNet 3.0
 * (Princeton), since Roget gives none.
 */
const TSV = \`
${tsv}
\`

export const ROGET_PACK: RawEntry[] = TSV.trim()
  .split('\\n')
  .map((line) => {
    const [word, pos, meaning, theme] = line.split('\\t')
    return { word, pos: pos || undefined, meaning, theme: theme || undefined }
  })
  .filter((e) => e.word && e.meaning)
`,
    'utf8',
  )

  writeFileSync(
    join(HERE, '..', 'src', 'data', 'roget-meta.ts'),
    `/** Generated by scripts/build-roget.mjs - do not edit by hand. */
export const ROGET_NAME = "Roget's Thesaurus"
export const ROGET_COUNT = ${entries.length}
export const ROGET_THEMES = ${themes}
`,
    'utf8',
  )

  console.log(`${entries.length} words from ${themes} concepts -> ${OUT}\n`)
  let last = ''
  for (const e of entries.slice(0, 14)) {
    if (e.theme !== last) console.log(`  ${e.theme}`)
    last = e.theme
    console.log(`     ${e.word.padEnd(14)} ${e.meaning.slice(0, 60)}`)
  }
}

await main()
