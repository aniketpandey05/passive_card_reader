import type { RawEntry } from '../db'
import type { Line } from './layout'
import { joinLines, joinWords } from './layout'
import { splitPos } from './parse'

/**
 * Turning reconstructed lines into dictionary entries.
 *
 * Rather than scoring every line with a blend of weak signals, this picks one
 * strategy for the whole document and says which it picked. A dictionary is
 * typeset consistently, so one rule usually holds throughout - and a visible,
 * overridable choice is far easier for a user to correct than a black box.
 */

export type Strategy = 'bold' | 'indent' | 'numbered' | 'pattern'

export const STRATEGY_LABEL: Record<Strategy, string> = {
  bold: 'Bold headwords',
  indent: 'Hanging indent',
  numbered: 'Numbered list',
  pattern: 'Word, then a dash or part of speech',
}

export type Flag = 'order' | 'short' | 'odd' | 'long' | 'garbled'

export const FLAG_LABEL: Record<Flag, string> = {
  order: 'out of alphabetical order',
  short: 'meaning looks too short',
  odd: 'headword looks wrong',
  long: 'may have swallowed the next entry',
  garbled: 'may be misread',
}

/** Characters that have no business in a definition - a sign of OCR noise. */
const GARBLED = /[#@|~^_{}<>\\«»¬¦]|\s[^\s\p{L}\p{N}(),;:'’".!?/-]\s/u

export interface DraftEntry extends RawEntry {
  page: number
  flags: Flag[]
}

export interface Assembly {
  entries: DraftEntry[]
  strategy: Strategy
  stats: {
    total: number
    flagged: number
    outOfOrder: number
    pages: number
  }
}

const NUMBERED = /^\s*\d{1,4}\s*[.)\]]\s+\S/
const SENSE_MARKER = /(?:^|\s)(\d{1,2})[.)]\s/g
// A headword, then the thing that separates it from its definition.
const HEAD_SPLIT =
  /^([\p{L}][\p{L}'’‐‑-]{0,30})(?:\s*\d{1,2})?\s*(?:([–—:])\s*|(\(?(?:n|v|vt|vi|adj|adv|prep|conj|interj|pron)\b\.?\)?)\s+|\s{2,})/u
const PHONETIC = /[ˈˌːəɪʊɛɔæŋθðʃʒʧʤɑɒʌɜɐ]/

export function groupKey(line: Line): string {
  return `${line.page}:${line.column}`
}

/**
 * How far from the margin a line can start and still count as flush left.
 * Scaled by font size because a scan is never perfectly straight, and absolute
 * points mean nothing across different page sizes.
 */
function indentTolerance(line: Line): number {
  return Math.max(2, line.size * 0.5)
}

/**
 * Hanging indent: entry first lines sit at the column's left margin and
 * continuation lines are pushed in. Detected per column, since margins differ.
 */
export function indentProfile(lines: Line[]): { hanging: boolean; baseByGroup: Map<string, number> } {
  const groups = new Map<string, Line[]>()
  for (const line of lines) {
    const key = groupKey(line)
    const list = groups.get(key)
    if (list) list.push(line)
    else groups.set(key, [line])
  }

  const baseByGroup = new Map<string, number>()
  let flush = 0
  let indented = 0
  let total = 0

  for (const [key, group] of groups) {
    // The 5th percentile rather than the minimum: one stray line sitting left
    // of the margin shouldn't redefine where the column starts.
    const sorted = group.map((l) => l.x0).sort((a, b) => a - b)
    const base = sorted[Math.floor(sorted.length * 0.05)] ?? sorted[0]
    baseByGroup.set(key, base)
    for (const line of group) {
      total++
      if (line.x0 <= base + indentTolerance(line)) flush++
      else if (line.x0 > base + indentTolerance(line)) indented++
    }
  }

  const hanging = total > 0 && flush / total >= 0.08 && flush / total <= 0.9 && indented / total >= 0.1
  return { hanging, baseByGroup }
}

export function chooseStrategy(lines: Line[]): Strategy {
  const total = lines.length || 1
  const numbered = lines.filter((l) => NUMBERED.test(l.text)).length / total
  if (numbered > 0.35) return 'numbered'

  const bold = lines.filter((l) => l.boldRun > 0).length / total
  if (bold >= 0.12 && bold <= 0.85) return 'bold'

  if (indentProfile(lines).hanging) return 'indent'
  return 'pattern'
}

function splitByPattern(text: string): { word: string; rest: string } | null {
  const m = HEAD_SPLIT.exec(text)
  if (!m) return null
  const pos = m[3] ? m[3] + ' ' : ''
  return { word: m[1], rest: (pos + text.slice(m[0].length)).trim() }
}

function isHeadLine(line: Line, strategy: Strategy, baseX: number): boolean {
  switch (strategy) {
    case 'numbered':
      return NUMBERED.test(line.text)
    case 'bold':
      return line.boldRun > 0 && line.boldRun <= 6
    case 'indent':
      return line.x0 <= baseX + indentTolerance(line)
    case 'pattern':
      return splitByPattern(line.text) !== null
  }
}

function splitHead(line: Line, strategy: Strategy): { word: string; rest: string } {
  if (strategy === 'bold' && line.boldRun > 0) {
    const word = joinWords(line.words.slice(0, line.boldRun))
    const rest = joinWords(line.words.slice(line.boldRun))
    if (word) return { word, rest }
  }

  let text = line.text
  if (strategy === 'numbered') text = text.replace(/^\s*\d{1,4}\s*[.)\]]\s*/, '')

  const byPattern = splitByPattern(text)
  if (byPattern) return byPattern

  const space = text.search(/\s/)
  if (space === -1) return { word: text, rest: '' }
  return { word: text.slice(0, space), rest: text.slice(space + 1).trim() }
}

function cleanWord(word: string): string {
  return word
    .replace(/[·•∙]/g, '') // syllable dots: a·bate
    .replace(/^[^\p{L}]+/u, '')
    .replace(/[^\p{L})]+$/u, '')
    .replace(/\s*\d{1,2}$/, '') // homograph markers: abate 1
    .replace(/\s+/g, ' ')
    .trim()
}

/** Where a dictionary puts "n." / "v." / "adj.", right after the headword. */
const POS_SLOT = /^([^\s]{1,3})[.,]\s+/

function cleanMeaning(text: string): { meaning: string; suspect: boolean } {
  let out = text.replace(/\s+/g, ' ').trim()
  let suspect = false

  // Drop a pronunciation in slashes or brackets, but only when it really looks
  // phonetic - "(of a person)" is part of the definition and has to survive.
  out = out.replace(/^[/[]([^\]/]{0,40})[/\]]\s*/, (full, inner: string) => (PHONETIC.test(inner) ? '' : full))

  // OCR turns "n." into things like "7." or "7».". Nothing but a part of speech
  // belongs in that slot, so junk there is a misreading rather than meaning -
  // worth removing, and worth telling the user about.
  const slot = POS_SLOT.exec(out)
  if (slot && !/^\p{L}{1,3}$/u.test(slot[1])) {
    out = out.slice(slot[0].length)
    suspect = true
  }

  out = out.replace(/^[\s–—:.,;-]+/, '')
  return { meaning: out.trim(), suspect }
}

/** Keep only the first few senses, so a card stays readable. */
export function trimSenses(meaning: string, max: number): string {
  if (max <= 0) return meaning
  const markers: number[] = []
  SENSE_MARKER.lastIndex = 0
  let m = SENSE_MARKER.exec(meaning)
  while (m) {
    markers.push(m.index === 0 ? 0 : m.index + 1)
    m = SENSE_MARKER.exec(meaning)
  }
  if (markers.length <= max) return meaning
  return meaning.slice(0, markers[max]).replace(/[\s;,]+$/, '').trim()
}

function sortable(word: string): string {
  return word.toLowerCase().replace(/[^a-z]/g, '')
}

export interface AssembleOptions {
  strategy?: Strategy
  maxSenses?: number
}

export function assemble(lines: Line[], opts: AssembleOptions = {}): Assembly {
  const strategy = opts.strategy ?? chooseStrategy(lines)
  const maxSenses = opts.maxSenses ?? 3
  const { baseByGroup } = indentProfile(lines)

  const entries: DraftEntry[] = []
  const seen = new Set<string>()
  let current: { word: string; parts: string[]; page: number } | null = null
  let lastSortable = ''

  const flush = () => {
    if (!current) return
    const { page } = current
    const word = cleanWord(current.word)
    const joined = current.parts.reduce((acc, part) => (acc ? joinLines(acc, part) : part), '')
    const cleaned = cleanMeaning(joined)
    const meaning = trimSenses(cleaned.meaning, maxSenses)
    current = null
    if (!word || !meaning) return

    const key = word.toLowerCase() + '|' + meaning.slice(0, 40).toLowerCase()
    if (seen.has(key)) return
    seen.add(key)

    const split = splitPos(meaning)
    const flags: Flag[] = []
    const order = sortable(word)
    if (order && lastSortable && order < lastSortable) flags.push('order')
    if (split.meaning.length < 8) flags.push('short')
    if (!/^\p{L}[\p{L}\s'’-]{0,40}$/u.test(word)) flags.push('odd')
    if (cleaned.suspect || GARBLED.test(split.meaning) || GARBLED.test(word)) flags.push('garbled')
    if (order) lastSortable = order

    entries.push({ word, pos: split.pos, meaning: split.meaning, page, flags })
  }

  for (const line of lines) {
    const base = baseByGroup.get(groupKey(line)) ?? line.x0
    if (isHeadLine(line, strategy, base)) {
      const page = line.page
      flush()
      const { word, rest } = splitHead(line, strategy)
      current = { word, parts: rest ? [rest] : [], page }
    } else if (current) {
      current.parts.push(line.text)
    }
    // Lines before the first headword are front matter, and are dropped.
  }
  flush()

  // "Too long" only means anything relative to this book: an entry several
  // times the typical length has usually run on into the next headword.
  const lengths = entries.map((e) => e.meaning.length).sort((a, b) => a - b)
  const typical = lengths[Math.floor(lengths.length / 2)] ?? 0
  const longLimit = Math.max(240, typical * 3.5)
  for (const entry of entries) {
    if (entry.meaning.length > longLimit) entry.flags.push('long')
  }

  const pages = new Set(lines.map((l) => l.page)).size
  return {
    entries,
    strategy,
    stats: {
      total: entries.length,
      flagged: entries.filter((e) => e.flags.length).length,
      outOfOrder: entries.filter((e) => e.flags.includes('order')).length,
      pages,
    },
  }
}
