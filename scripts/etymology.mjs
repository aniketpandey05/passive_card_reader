/**
 * Reads word origins out of GCIDE, the GNU edition of Webster's Revised
 * Unabridged Dictionary (1913).
 *
 * This exists because a morpheme table can only ever explain words built from
 * roots it knows. "Taciturn" is Latin taciturnus and an analyzer that knows
 * "tac" still cannot account for "-iturn", so it says nothing at all. The
 * dictionary already knows, for nearly every borrowed word in English.
 *
 * GCIDE markup looks like:
 *   <ent>Taciturn</ent> … <ety>[L. <ets>taciturnus</ets>: cf. F. …]</ety>
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** Webster's abbreviations for the languages it cites. */
// Longer abbreviations first: "NL." must be matched before the "L." inside it.
const LANGUAGES = [
  ['LL.', 'Late Latin'],
  ['OL.', 'Old Latin'],
  ['NL.', 'New Latin'],
  ['L.', 'Latin'],
  ['Gr.', 'Greek'],
  ['OF.', 'Old French'],
  ['F.', 'French'],
  ['AS.', 'Old English'],
  ['OE.', 'Middle English'],
  ['OHG.', 'Old High German'],
  ['MHG.', 'Middle High German'],
  ['G.', 'German'],
  ['D.', 'Dutch'],
  ['Icel.', 'Icelandic'],
  ['Sw.', 'Swedish'],
  ['Dan.', 'Danish'],
  ['Goth.', 'Gothic'],
  ['Skr.', 'Sanskrit'],
  ['Ar.', 'Arabic'],
  ['Heb.', 'Hebrew'],
  ['Sp.', 'Spanish'],
  ['It.', 'Italian'],
  ['Pg.', 'Portuguese'],
  ['Russ.', 'Russian'],
  ['Ir.', 'Irish'],
  ['W.', 'Welsh'],
  ['Gael.', 'Gaelic'],
  ['Per.', 'Persian'],
  ['Turk.', 'Turkish'],
  ['Celt.', 'Celtic'],
  ['Pr.', 'Provencal'],
]

/** Other abbreviations, expanded so the line reads as English. */
const PHRASES = [
  [/\bfr\./g, 'from'],
  [/\bdim\. of\b/g, 'diminutive of'],
  [/\bdim\./g, 'diminutive of'],
  [/\bp\. p\. of\b/g, 'past participle of'],
  [/\bp\. p\./g, 'past participle of'],
  [/\bpp\. of\b/g, 'past participle of'],
  [/\bpp\./g, 'past participle of'],
  [/\bprop\./g, 'properly'],
  [/\bequiv\./g, 'equivalent to'],
  [/\bprob\./g, 'probably'],
  [/\bperh\./g, 'perhaps'],
  [/\borig\./g, 'originally'],
  [/\blit\./g, 'literally'],
  [/\bcontr\./g, 'contracted from'],
  [/\bsuperl\./g, 'superlative of'],
  [/\bpres\./g, 'present'],
  [/\bpart\./g, 'participle'],
  [/\bneut\./g, 'neuter'],
  [/\bfem\./g, 'feminine'],
  [/\bmasc\./g, 'masculine'],
  [/\bsing\./g, 'singular'],
  [/\bpl\./g, 'plural'],
  [/\bgen\./g, 'genitive'],
  [/\bacc\./g, 'accusative'],
  [/\bE\./g, 'English'],
]

function expandLanguages(text) {
  let out = text
  for (const [abbreviation, full] of LANGUAGES) {
    out = out.replaceAll(abbreviation, full)
  }
  return out
}

/** The language a word actually came from: the first one Webster cites. */
function primaryLanguage(text) {
  let best = null
  for (const [abbreviation, full] of LANGUAGES) {
    const at = text.indexOf(abbreviation)
    if (at === -1) continue
    if (!best || at < best.at) best = { at, full }
  }
  return best?.full ?? null
}

export function cleanEtymology(raw) {
  // Order matters. GCIDE writes unrepresentable characters as "<?/" and
  // ligatures as "<ae/" - openers with no closing bracket - so stripping real
  // tags first would swallow everything up to the next ">" and take the
  // etymology with it.
  let s = raw
    .replace(/<\?\//g, '') // a character the source could not represent
    .replace(/<ae\//g, 'ae')
    .replace(/<oe\//g, 'oe')
    .replace(/<[lr]dquo\//g, '"')
    .replace(/<[a-z0-9]+\//gi, '') // any other entity of that shape
    .replace(/<\/?[a-z][a-z0-9]*>/gi, '') // real tags, keeping their text
    .replace(/\\'[0-9a-f]{2}/gi, '')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/[[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // Cross references and cognates are for lexicographers, not for a card.
  // These run to the end of the clause: stopping at the first period would
  // leave "cf. F." behind and keep the French word after it.
  s = s.replace(/\bcf\.[^;:]*/gi, '')
  s = s.replace(/\bSee\s+[A-Z][^.]*\.?/g, '')
  s = s.replace(/\bakin to[^;:.]*/gi, '')
  s = s.replace(/\bsee\s+note[^.]*\.?/gi, '')
  s = s.replace(/\(\s*see[^)]*\)/gi, '') // "(see Ob-)"

  const language = primaryLanguage(s)
  s = expandLanguages(s)
  for (const [pattern, replacement] of PHRASES) s = s.replace(pattern, replacement)

  // Keep the first couple of steps of the derivation.
  s = s.split(/[;:]/).slice(0, 2).join(', ')
  s = s
    .replace(/\s*[,;:]\s*$/, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.])/g, '$1')
    .replace(/,\s*\./g, '.')
    .replace(/\.{2,}/g, '.')
    .replace(/\s*,\s*,/g, ',')
    .replace(/[\s,.]+$/, '')
    .trim()

  // A bare language name says nothing a reader can use.
  if (!language || s.replace(language, '').replace(/[^a-z]/gi, '').length < 3) return null

  // The card already shows the language, so "Latin taciturnus" would read as
  // "LATIN · Latin taciturnus".
  s = s.replace(new RegExp(`^${language}\\s+`), '').trim()
  if (s.length > 110) s = s.slice(0, 110).replace(/[\s,]+\S*$/, '') + '…'
  return { language, text: s }
}

/** word (lowercase) -> { language, text } */
export function readEtymologies(cacheDir) {
  const root = join(cacheDir, 'gcide')
  const files = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) walk(path)
      else if (name.startsWith('CIDE.')) files.push(path)
    }
  }
  walk(root)

  const origins = new Map()
  for (const file of files.sort()) {
    const text = readFileSync(file, 'latin1')
    const marks = []
    const entPattern = /<ent>([^<]+)<\/ent>/g
    let match
    while ((match = entPattern.exec(text))) marks.push({ word: match[1], at: match.index })

    for (let i = 0; i < marks.length; i++) {
      // One entry can carry several headwords back to back ("Laconic",
      // "Laconical") and they share a single <ety>. Cutting at the very next
      // <ent> would leave the first variant with nothing.
      let next = i + 1
      while (next < marks.length && marks[next].at - marks[i].at < 80) next++
      const slice = text.slice(marks[i].at, marks[next]?.at ?? text.length)
      const ety = /<ety>([\s\S]*?)<\/ety>/.exec(slice)
      if (!ety) continue
      const word = marks[i].word.toLowerCase().replace(/[^a-z]/g, '')
      if (!word || origins.has(word)) continue
      const cleaned = cleanEtymology(ety[1])
      if (cleaned) origins.set(word, cleaned)
    }
  }
  return origins
}

const DERIVED_ENDINGS = [
  'ally', 'ically', 'ity', 'ism', 'ist', 'ness', 'ment', 'able', 'ible', 'ous', 'ive', 'ary', 'ic', 'al', 'ly',
  'ance', 'ence', 'ant', 'ent', 'ate', 'ed', 'ing', 'y',
]

/**
 * Webster gives the etymology once, on the base word: "ephemeral" carries none
 * because "ephemera" has it. So when a word has no entry of its own, try the
 * stems it could have been derived from.
 */
export function originFor(word, origins) {
  const direct = origins.get(word)
  if (direct) return direct

  for (const ending of DERIVED_ENDINGS) {
    if (!word.endsWith(ending)) continue
    const stem = word.slice(0, -ending.length)
    if (stem.length < 4) continue
    // "acrimonious" -> "acrimoni" -> "acrimony"
    const unlinked = stem.endsWith('i') ? stem.slice(0, -1) : stem
    for (const candidate of [stem, stem + 'e', stem + 'a', stem + 'y', stem + 'us', unlinked + 'y', unlinked]) {
      const hit = origins.get(candidate)
      if (hit) return hit
    }
  }
  return null
}
