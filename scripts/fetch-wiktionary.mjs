/**
 * Fetches word origins and related words from Wiktionary, via kaikki.org's
 * machine-readable extracts.
 *
 *   node scripts/fetch-wiktionary.mjs
 *
 * Writes scripts/.cache/wiktionary.json, which build-deck.mjs folds into the
 * generated deck. Every response is cached per word, so a second run costs
 * nothing and only new words are fetched.
 *
 * Why this and not Webster 1913: Webster is a book from 1913 and has no entry
 * for "absenteeism", "acculturation" or anything else coined since, which is
 * where the old pipeline ran out at 586 of 1,000. Wiktionary is current, says
 * which language a word came from in plain English, and already lists the
 * related and derived forms that the family cross-reference wants.
 *
 * Wiktionary text is CC BY-SA 3.0.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const CACHE = join(HERE, '.cache')
const WORD_CACHE = join(CACHE, 'kaikki')
const OUT = join(CACHE, 'wiktionary.json')

const CONCURRENCY = 6

function url(word) {
  const a = word[0]
  const ab = word.slice(0, 2)
  return `https://kaikki.org/dictionary/English/meaning/${a}/${ab}/${word}.jsonl`
}

async function fetchWord(word) {
  const file = join(WORD_CACHE, `${word}.jsonl`)
  if (existsSync(file)) return readFileSync(file, 'utf8')
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url(word))
      if (res.status === 404) {
        writeFileSync(file, '')
        return ''
      }
      if (!res.ok) throw new Error(`status ${res.status}`)
      const text = await res.text()
      writeFileSync(file, text)
      return text
    } catch (e) {
      if (attempt === 2) {
        console.warn(`  ${word}: ${e.message}`)
        return ''
      }
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
    }
  }
  return ''
}

// ------------------------------------------------------------------ parsing

const CLASSICAL = [
  ['Ancient Greek', 'Greek'],
  ['Byzantine Greek', 'Greek'],
  ['Koine Greek', 'Greek'],
  ['Greek', 'Greek'],
  ['Late Latin', 'Latin'],
  ['Medieval Latin', 'Latin'],
  ['Vulgar Latin', 'Latin'],
  ['New Latin', 'Latin'],
  ['Latin', 'Latin'],
]

const OTHER_LANGUAGES = [
  'Old French',
  'Middle French',
  'Anglo-Norman',
  'French',
  'Old English',
  'Middle English',
  'Proto-Germanic',
  'Old Norse',
  'Middle Dutch',
  'Dutch',
  'Old High German',
  'German',
  'Italian',
  'Spanish',
  'Portuguese',
  'Arabic',
  'Hebrew',
  'Sanskrit',
  'Persian',
  'Russian',
  'Japanese',
  'Chinese',
  'Hindi',
  'Turkish',
  'Irish',
  'Welsh',
  'Scots',
]

const tidy = (s) =>
  s
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

const LATIN_SCRIPT = /^[\p{Script=Latin}\p{M}'-]+$/u

/**
 * Parses what follows an etymon: "(ephḗmeros, "lasting a day")" carries a
 * romanization then a gloss, "("hidden, secret")" carries only a gloss.
 */
function readParenthetical(inside) {
  if (!inside) return {}
  const quoted = /"([^"]{2,70})"/.exec(inside)
  const gloss = quoted?.[1]
  const before = (quoted ? inside.slice(0, quoted.index) : inside).replace(/[,;\s]+$/, '').trim()
  const romanization = before && LATIN_SCRIPT.test(before) ? before : undefined
  return { gloss, romanization }
}

function findEtymon(text, name) {
  // "from Latin taciturnus ("silent")", "Borrowed from Ancient Greek ἐφήμερος (ephḗmeros)"
  const pattern = new RegExp(`${name}\\s+([\\p{L}\\p{M}*'-]{3,})\\s*(?:\\(([^)]{0,120})\\))?`, 'gu')
  let match
  const found = []
  while ((match = pattern.exec(text))) {
    const etymon = match[1].replace(/[.,;]$/, '')
    // Reconstructions and bare affixes teach nothing on a card.
    if (etymon.startsWith('*') || etymon.startsWith('-') || etymon.endsWith('-')) continue
    const { gloss, romanization } = readParenthetical(match[2])
    const display = LATIN_SCRIPT.test(etymon) ? etymon : romanization
    if (!display) continue
    found.push({ display, gloss })
  }
  // A step that comes with its meaning is worth more than one that does not.
  return found.find((f) => f.gloss) ?? found[0] ?? null
}

const NOT_AN_ORIGIN = /^(first attested|attested|unknown|uncertain|origin unknown|etymology tree|disputed)/i

/**
 * A card wants the classical ancestor, not the whole chain: "taciturn" is
 * interesting because it is Latin tacitus "silent", not because the trail runs
 * through Middle English on the way.
 */
export function readOrigin(etymology) {
  if (!etymology) return null
  let text = tidy(etymology)

  // Some entries lead with a reconstruction tree and put the prose last.
  if (/Etymology tree/i.test(etymology)) {
    const lines = etymology.split('\n').map(tidy).filter(Boolean)
    text = lines[lines.length - 1]
  }

  for (const [name, label] of CLASSICAL) {
    const hit = findEtymon(text, name)
    if (hit) return { language: label, text: hit.gloss ? `${hit.display} "${hit.gloss}"` : hit.display }
  }
  for (const name of OTHER_LANGUAGES) {
    const hit = findEtymon(text, name)
    if (hit) return { language: name, text: hit.gloss ? `${hit.display} "${hit.gloss}"` : hit.display }
  }

  // No language named, but a compound etymology names the parts outright:
  // "ad- ("toward") + culture + -ation ("a process")" is exactly the breakdown.
  const compound = text.match(/([\p{L}-]+)\s*(?:\("([^"]{2,40})"\))?\s*\+\s*([\p{L}-]+)\s*(?:\("([^"]{2,40})"\))?(?:\s*\+\s*([\p{L}-]+)\s*(?:\("([^"]{2,40})"\))?)?/u)
  if (compound) {
    const parts = [
      [compound[1], compound[2]],
      [compound[3], compound[4]],
      [compound[5], compound[6]],
    ]
      .filter(([form]) => form)
      .map(([form, gloss]) => (gloss ? `${form} "${gloss}"` : form))
    if (parts.length >= 2) return { language: null, text: parts.join(' + ') }
  }

  const first = text.split(/(?<=[.;])\s/)[0].replace(/[.;]$/, '')
  if (!NOT_AN_ORIGIN.test(first) && first.length >= 12 && first.length <= 110) {
    return { language: null, text: first }
  }
  return null
}

/**
 * Single-word relatives, which is what fits on a card. Synonyms are left out
 * on purpose: "unstable" is a synonym of "ephemeral" but shares no ancestry,
 * and this row is about where words come from.
 */
function sharesStem(a, b, length = 4) {
  for (let i = 0; i + length <= a.length; i++) {
    if (b.includes(a.slice(i, i + length))) return true
  }
  return false
}

export function readRelated(entry, word, etymon = '') {
  const out = []
  const seen = new Set([word])
  const stemSource = (word + ' ' + etymon).toLowerCase()
  for (const list of [entry.related, entry.derived]) {
    for (const item of list ?? []) {
      const candidate = (item.word ?? '').trim().toLowerCase()
      if (!/^[a-z][a-z-]{2,18}$/.test(candidate) || seen.has(candidate)) continue
      // Skip forms that are just this word with an ending glued on.
      if (candidate.startsWith(word.slice(0, Math.max(5, word.length - 2)))) continue
      // Wiktionary files loose associations under "related terms" too -
      // "unstable" sits beside "ephemeral" - so require shared word stock.
      if (!sharesStem(candidate, stemSource)) continue
      seen.add(candidate)
      out.push(candidate)
    }
  }
  return out.slice(0, 8)
}

function extract(text, word) {
  let best = null
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    let entry
    try {
      entry = JSON.parse(line)
    } catch {
      continue
    }
    if (entry.lang_code !== 'en') continue
    const origin = readOrigin(entry.etymology_text)
    const related = readRelated(entry, word, origin?.text ?? '')
    const score = (origin ? 2 : 0) + (related.length ? 1 : 0)
    if (!best || score > best.score) best = { score, origin, related }
  }
  if (!best || (!best.origin && !best.related.length)) return null
  return {
    language: best.origin?.language ?? undefined,
    origin: best.origin?.text ?? undefined,
    related: best.related.length ? best.related : undefined,
  }
}

async function main() {
  mkdirSync(WORD_CACHE, { recursive: true })
  const deck = readFileSync(join(HERE, '..', 'src', 'data', 'core.ts'), 'utf8')
  const block = /const TSV = `\n([\s\S]*?)\n`/.exec(deck)
  if (!block) throw new Error('could not read the deck; run build-deck.mjs first')
  const words = block[1]
    .trim()
    .split('\n')
    .map((line) => line.split('\t')[0])
    .filter((w) => /^[a-z]{3,20}$/.test(w))

  console.log(`${words.length} words to look up\n`)
  const result = {}
  let done = 0
  let found = 0

  const queue = [...words]
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const word = queue.shift()
      const text = await fetchWord(word)
      const data = text ? extract(text, word) : null
      if (data) {
        result[word] = data
        found++
      }
      done++
      if (done % 50 === 0) process.stdout.write(`\r  ${done}/${words.length} fetched, ${found} with data`)
    }
  })
  await Promise.all(workers)

  writeFileSync(OUT, JSON.stringify(result, null, 1), 'utf8')
  const withOrigin = Object.values(result).filter((r) => r.origin).length
  const withRelated = Object.values(result).filter((r) => r.related).length
  console.log(`\n\n${withOrigin} with an origin, ${withRelated} with related words -> ${OUT}`)
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  await main()
}
