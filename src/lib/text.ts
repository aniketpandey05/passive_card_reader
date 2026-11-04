/**
 * Turning shared or pasted text into cards.
 *
 * Two kinds of text arrive. A list someone has already made - "abate - to
 * lessen", or just a column of words - and a passage of prose. The first is
 * taken at its word. The second is mined for the words worth knowing, which
 * is the only part of this that needs any judgement.
 */

/** A word and, where the text itself gave one, its meaning. */
export interface Taken {
  word: string
  meaning?: string
}

/** "abate - to lessen", "abate: to lessen", "abate<tab>to lessen". */
const PAIR = /^([A-Za-z][A-Za-z'’-]{1,29})\s*(?:[:|\t]|\s+[-–—]\s+|\s{2,})\s*(\S.*?)$/
/** A line that is nothing but a word. */
const BARE = /^([A-Za-z][A-Za-z'’-]{1,29})$/
/** Words in running text, long enough to be worth a card. */
const TOKEN = /[A-Za-z][A-Za-z'’-]{3,}/g

function lines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
}

/**
 * The text read as a list, or null if it does not look like one.
 *
 * The test is proportional rather than absolute: one stray line in a list of
 * forty should not throw the whole thing over to the prose reader, and three
 * lines of a paragraph that happen to contain a colon should not be mistaken
 * for a glossary.
 */
export function readList(text: string): Taken[] | null {
  const rows = lines(text)
  if (rows.length < 2) return null

  const pairs: Taken[] = []
  for (const row of rows) {
    const m = PAIR.exec(row)
    // A meaning that runs on for a paragraph is prose with a colon in it.
    if (m && m[2].length <= 160) pairs.push({ word: m[1], meaning: m[2] })
  }
  if (pairs.length >= 2 && pairs.length >= rows.length * 0.6) return pairs

  const bare = rows.filter((r) => BARE.test(r)).map((r) => ({ word: r }))
  if (bare.length >= 3 && bare.length >= rows.length * 0.8) return bare

  return null
}

/** A word as a passage used it. */
export interface Token {
  word: string
  /**
   * Whether it ever appeared in lower case. A word that is capitalised every
   * time it occurs is usually a name, which matters when counting up the
   * words that could not be defined: nobody wants to be told that WordFlow
   * has no definition for Helsinki.
   */
  everLower: boolean
}

/** Every word in a passage, lowercased, in the order it first appears. */
export function readProse(text: string): Token[] {
  const at = new Map<string, Token>()
  const out: Token[] = []
  for (const raw of text.match(TOKEN) ?? []) {
    const word = raw.toLowerCase().replace(/['’]s$/, '')
    if (word.length < 4) continue
    const lower = raw === raw.toLowerCase()
    const already = at.get(word)
    if (already) {
      already.everLower ||= lower
      continue
    }
    const token = { word, everLower: lower }
    at.set(word, token)
    out.push(token)
  }
  return out
}

/**
 * Forms to try when looking a word up. Prose is inflected and dictionaries
 * are not, so "aberrations" has to be allowed to find "aberration" - without
 * this, a passage yields a fraction of what it actually contains.
 */
export function forms(word: string): string[] {
  const w = word.toLowerCase()
  const out = [w]
  const add = (s: string) => {
    if (s.length > 2 && !out.includes(s)) out.push(s)
  }
  if (w.endsWith('ies')) add(w.slice(0, -3) + 'y')
  if (w.endsWith('es')) add(w.slice(0, -2))
  if (w.endsWith('s')) add(w.slice(0, -1))
  if (w.endsWith('ed')) {
    add(w.slice(0, -2))
    add(w.slice(0, -1))
  }
  if (w.endsWith('ing')) {
    add(w.slice(0, -3))
    add(w.slice(0, -3) + 'e')
  }
  if (w.endsWith('ally')) add(w.slice(0, -4) + 'al')
  if (w.endsWith('ly')) add(w.slice(0, -2))
  return out
}

/**
 * Whether this is writing rather than entries.
 *
 * The giveaway is shape, not punctuation: a table or a word list is many
 * short rows, and prose is a few long ones. Testing for commas instead would
 * call every CSV a paragraph - which is exactly what the first version of
 * this did, because the table parser had already claimed the text by then.
 */
export function looksLikeProse(text: string): boolean {
  if (!text.trim() || readList(text)) return false
  const rows = lines(text)
  if (!rows.length) return false
  const words = rows.reduce((n, row) => n + row.split(/\s+/).filter(Boolean).length, 0)
  return words / rows.length >= 12 && readProse(text).length >= 12
}

/**
 * A name for the deck, from whatever the share gave us.
 *
 * A page title is the best name there is. Failing that, the first line of a
 * list is usually a word and makes a poor one, and the first line of a
 * paragraph is a sentence fragment and makes a worse one - "She approached
 * the problem with characteristic" is nobody's idea of a deck. Prose gets the
 * day instead, which at least tells them apart.
 */
export function nameFor(title: string | undefined, text: string): string {
  const fromTitle = (title ?? '').trim().replace(/\s+/g, ' ')
  if (fromTitle) return fromTitle.slice(0, 60)
  if (looksLikeProse(text)) {
    const day = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
    return `Words from ${day}`
  }
  return 'Shared words'
}
