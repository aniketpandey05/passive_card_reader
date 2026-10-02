import type { RawEntry } from '../db'

/**
 * Import parsing. Everything a user can paste or drop in ends up as RawEntry[].
 * Detection is a guess; the import screen always shows a preview and lets the
 * user correct the column mapping before the deck is created.
 */

export interface TableShape {
  rows: string[][]
  delimiter: string
}

export interface Mapping {
  word: number
  meaning: number
  pos: number | null
  hasHeader: boolean
}

export interface Parsed {
  format: 'json' | 'table' | 'lines' | 'empty'
  entries: RawEntry[]
  /** Present for delimited text, so the UI can offer column dropdowns. */
  table: TableShape | null
  mapping: Mapping | null
  warnings: string[]
}

const POS_LONG =
  /^\(?(nouns?|verbs?|adjectives?|adverbs?|pronouns?|prepositions?|conjunctions?|interjections?|adj|adv|prep|conj|interj)\.?\)?[\s.,:;—–-]+/i
// Short forms must carry a period, or "a person who..." would lose its "a".
const POS_SHORT = /^\(?(n|v|vt|vi|a|adj|adv|prep|conj|interj)\.\)?\s+/i

const POS_CANON: Record<string, string> = {
  n: 'noun', noun: 'noun', nouns: 'noun',
  v: 'verb', vt: 'verb', vi: 'verb', verb: 'verb', verbs: 'verb',
  a: 'adjective', adj: 'adjective', adjective: 'adjective', adjectives: 'adjective',
  adv: 'adverb', adverb: 'adverb', adverbs: 'adverb',
  pron: 'pronoun', pronoun: 'pronoun', pronouns: 'pronoun',
  prep: 'preposition', preposition: 'preposition', prepositions: 'preposition',
  conj: 'conjunction', conjunction: 'conjunction', conjunctions: 'conjunction',
  interj: 'interjection', interjection: 'interjection', interjections: 'interjection',
}

/** Pull a leading part of speech out of a meaning: "v. to lessen" -> verb + "to lessen". */
export function splitPos(meaning: string): { pos?: string; meaning: string } {
  for (const re of [POS_LONG, POS_SHORT]) {
    const m = re.exec(meaning)
    if (m) {
      const rest = meaning.slice(m[0].length).trim()
      if (rest) return { pos: POS_CANON[m[1].toLowerCase()] ?? m[1].toLowerCase(), meaning: rest }
    }
  }
  return { meaning }
}

/** CSV/TSV tokenizer that understands quoted fields, including embedded newlines. */
export function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += c
    } else if (c === '"' && field === '') quoted = true
    else if (c === delimiter) {
      row.push(field)
      field = ''
    } else if (c === '\n') {
      row.push(field)
      field = ''
      rows.push(row)
      row = []
    } else if (c !== '\r') field += c
  }
  row.push(field)
  rows.push(row)
  return rows.map((r) => r.map((f) => f.trim())).filter((r) => r.some((f) => f))
}

/** Picks the delimiter that splits the most lines into a consistent column count. */
export function detectDelimiter(text: string): string | null {
  const lines = text
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .slice(0, 40)
  if (!lines.length) return null
  let best: { delimiter: string; agreement: number } | null = null
  for (const d of ['\t', ',', ';', '|']) {
    const counts = lines.map((l) => l.split(d).length).sort((a, b) => a - b)
    const mode = counts[Math.floor(counts.length / 2)]
    if (mode < 2) continue
    const agreement = counts.filter((c) => c === mode).length / counts.length
    if (agreement >= 0.7 && (!best || agreement > best.agreement)) best = { delimiter: d, agreement }
  }
  return best?.delimiter ?? null
}

const WORD_HEADERS = ['word', 'term', 'headword', 'front', 'key', 'entry', 'vocabulary', 'vocab']
const MEANING_HEADERS = ['meaning', 'definition', 'def', 'back', 'sense', 'gloss', 'translation', 'description']
const POS_HEADERS = ['pos', 'part of speech', 'part_of_speech', 'partofspeech', 'type', 'class']

/** Guess which column holds what: by header name first, then by shape. */
export function guessMapping(rows: string[][]): Mapping {
  const width = Math.max(...rows.map((r) => r.length))
  const head = (rows[0] ?? []).map((c) => c.toLowerCase().trim())
  const findHeader = (names: string[]) => head.findIndex((h) => names.includes(h))

  const wordByHeader = findHeader(WORD_HEADERS)
  const meaningByHeader = findHeader(MEANING_HEADERS)
  const posByHeader = findHeader(POS_HEADERS)

  if (wordByHeader >= 0 || meaningByHeader >= 0) {
    return {
      word: wordByHeader >= 0 ? wordByHeader : 0,
      meaning: meaningByHeader >= 0 ? meaningByHeader : Math.min(1, width - 1),
      pos: posByHeader >= 0 ? posByHeader : null,
      hasHeader: true,
    }
  }

  // No header row: the shortest column is the word, the longest is the meaning.
  const sample = rows.slice(0, 50)
  const avg = Array.from({ length: width }, (_, c) => {
    const cells = sample.map((r) => r[c] ?? '').filter((v) => v)
    if (!cells.length) return Number.POSITIVE_INFINITY
    return cells.reduce((sum, v) => sum + v.length, 0) / cells.length
  })
  let word = 0
  avg.forEach((len, c) => {
    if (len < avg[word]) word = c
  })
  let meaning = word === 0 && width > 1 ? 1 : 0
  avg.forEach((len, c) => {
    if (c !== word && len !== Number.POSITIVE_INFINITY && (meaning === word || len > avg[meaning])) meaning = c
  })
  // A short extra column of "n./v./adj." is a part-of-speech column.
  const pos = avg.findIndex((len, c) => c !== word && c !== meaning && len > 0 && len <= 12)
  return { word, meaning, pos: pos >= 0 ? pos : null, hasHeader: false }
}

export function applyMapping(table: TableShape, mapping: Mapping): RawEntry[] {
  const rows = mapping.hasHeader ? table.rows.slice(1) : table.rows
  return rows
    .map((r) => {
      const word = (r[mapping.word] ?? '').trim()
      const rawMeaning = (r[mapping.meaning] ?? '').trim()
      const posCell = mapping.pos !== null ? (r[mapping.pos] ?? '').trim() : ''
      const split = posCell
        ? { pos: POS_CANON[posCell.toLowerCase().replace(/\.$/, '')] ?? posCell, meaning: rawMeaning }
        : splitPos(rawMeaning)
      return { word, pos: split.pos, meaning: split.meaning }
    })
    .filter((e) => e.word && e.meaning)
}

export function entriesFromJson(text: string): RawEntry[] {
  const data: unknown = JSON.parse(text)

  const flatten = (v: unknown): string => {
    if (typeof v === 'string') return v
    if (typeof v === 'number') return String(v)
    if (Array.isArray(v)) return v.map(flatten).filter(Boolean).join('; ')
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>
      for (const k of ['definition', 'meaning', 'gloss', 'text', 'translation', 'def']) {
        if (o[k]) return flatten(o[k])
      }
    }
    return ''
  }
  const pick = (o: Record<string, unknown>, keys: string[]): string => {
    for (const k of Object.keys(o)) {
      if (keys.includes(k.toLowerCase())) {
        const out = flatten(o[k]).trim()
        if (out) return out
      }
    }
    return ''
  }

  if (Array.isArray(data)) {
    return data
      .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
      .map((row) => {
        const word = pick(row, [...WORD_HEADERS, 'w', 'lemma'])
        const meaning = pick(row, [...MEANING_HEADERS, 'm', 'definitions', 'senses', 'value', 'meanings'])
        const pos = pick(row, [...POS_HEADERS, 'p'])
        const split = pos ? { pos, meaning } : splitPos(meaning)
        return { word, pos: split.pos, meaning: split.meaning }
      })
      .filter((e) => e.word && e.meaning)
  }

  if (data && typeof data === 'object') {
    // { "abate": "to lessen", "aberration": ["a departure from the normal"] }
    return Object.entries(data as Record<string, unknown>)
      .map(([word, v]) => {
        const split = splitPos(flatten(v))
        return { word, pos: split.pos, meaning: split.meaning }
      })
      .filter((e) => e.word && e.meaning)
  }
  return []
}

const LINE_SEPARATORS = [/\t+/, /\s+[–—]\s+/, /\s+[-=]\s+/, /\s*:\s+/, /\s{2,}/]

export function entriesFromLines(text: string): { entries: RawEntry[]; skipped: number } {
  const entries: RawEntry[] = []
  let skipped = 0
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim().replace(/^\d+\s*[.)\]]\s*/, '') // "12. abate - to lessen"
    if (!trimmed) continue
    let matched = false
    for (const sep of LINE_SEPARATORS) {
      const m = sep.exec(trimmed)
      if (!m || m.index === 0) continue
      const word = trimmed.slice(0, m.index).trim()
      const rest = trimmed.slice(m.index + m[0].length).trim()
      if (!word || !rest || word.length > 60) continue
      const split = splitPos(rest)
      entries.push({ word, pos: split.pos, meaning: split.meaning })
      matched = true
      break
    }
    if (!matched) skipped++
  }
  return { entries, skipped }
}

export function autoParse(text: string, filename = ''): Parsed {
  const warnings: string[] = []
  if (!text.trim()) {
    return { format: 'empty', entries: [], table: null, mapping: null, warnings: ['Nothing to import yet.'] }
  }

  const looksJson = /\.json$/i.test(filename) || /^[[{]/.test(text.trim())
  if (looksJson) {
    try {
      const entries = entriesFromJson(text)
      if (entries.length) return { format: 'json', entries, table: null, mapping: null, warnings }
      warnings.push('That JSON parsed, but no word/meaning pairs were found in it.')
    } catch {
      warnings.push('That looked like JSON but could not be parsed, so it was read line by line instead.')
    }
  }

  const delimiter = detectDelimiter(text)
  if (delimiter) {
    const rows = parseDelimited(text, delimiter)
    if (rows.length && Math.max(...rows.map((r) => r.length)) >= 2) {
      const mapping = guessMapping(rows)
      const entries = applyMapping({ rows, delimiter }, mapping)
      if (entries.length) return { format: 'table', entries, table: { rows, delimiter }, mapping, warnings }
    }
  }

  const { entries, skipped } = entriesFromLines(text)
  if (skipped > 0) {
    warnings.push(
      skipped + (skipped === 1 ? ' line was' : ' lines were') + ' skipped: no separator between the word and its meaning.',
    )
  }
  if (!entries.length) {
    warnings.push('No entries found. Each line needs a word and a meaning, separated by a tab, a dash, or a colon.')
  }
  return { format: 'lines', entries, table: null, mapping: null, warnings }
}
