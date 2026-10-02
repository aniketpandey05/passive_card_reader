import type { Lang, Morpheme } from '../data/morphemes'
import { OVERRIDES, PREFIX_LIST, ROOT_LIST, SUFFIX_LIST } from '../data/morphemes'

/**
 * Breaking a word into prefix, root and suffix.
 *
 * Tuned for precision over coverage: showing nothing is fine, showing a wrong
 * derivation teaches someone something false. So a breakdown is only offered
 * when a known root sits immediately where it should and the parts account for
 * nearly the whole word.
 */

export interface WordPart {
  kind: 'prefix' | 'root' | 'suffix'
  form: string
  gloss: string
  lang: Lang
}

export interface Analysis {
  parts: WordPart[]
  /** Language of the root, which is the part that carries the meaning. */
  lang: Lang
  note?: string
  /** Share of the word's letters the parts account for. */
  coverage: number
}

/**
 * Words whose parts line up by coincidence. "person" is not per- + son: it is
 * persona, a mask. One short list is cheaper than loosening every rule.
 */
const FALSE_FRIENDS = new Set([
  // Latinate words whose parts line up with the wrong root. Each of these
  // reads convincingly and is simply untrue:
  'mitigate', //   mitis "mild", not mittere "send"
  'venerate', //   venerari "revere", not venire "come"
  'volatile', //   volare "fly", not velle "wish"
  'fervent', //    fervere "boil", not ferre "carry"
  'obfuscate', //  fuscus "dark", not fundere "pour"
  'tentative', //  tentare "try", not tenere "hold"
  'tenuous', //    tenuis "thin", not tenere "hold"
  'pedantic', //   pedante "teacher", not pes "foot"
  'relegate', //   legare "send away", not legere "read"
  'person',
  'personal',
  'personality',
  'content',
  'contents',
  'present',
  'presence',
  'sentence',
  'important',
  'however',
  'moment',
  'company',
  'certain',
  'subject',
  'object',
  'perfect',
  'problem',
  'property',
  'general',
  'interest',
  'manner',
  'matter',
  'nothing',
  'something',
  'cabinet',
  'carpenter',
  'parent',
  'current',
  'sudden',
  'suffer',
  'support',
])

const MIN_WORD = 6
const MIN_ROOT = 3
/** Each half of a two-root compound must be at least this long. */
const MIN_CHAIN_ROOT = 4
const MIN_COVERAGE = 0.75

function allMatches(list: Morpheme[], test: (form: string) => boolean): Morpheme[] {
  return list.filter((m) => test(m.form)).sort((a, b) => b.form.length - a.form.length)
}

function longestMatch(list: Morpheme[], test: (form: string) => boolean): Morpheme | null {
  return allMatches(list, test)[0] ?? null
}

/**
 * Greek compounds stack roots - philanthropy is phil + anthrop - so match up to
 * two, each starting exactly where the previous one ended.
 */
function rootChain(core: string): Morpheme[] {
  const first = longestMatch(ROOT_LIST, (f) => f.length >= MIN_ROOT && core.startsWith(f))
  if (!first) return []
  const rest = core.slice(first.form.length)
  if (rest.length < MIN_CHAIN_ROOT) return [first]
  // Both halves of a compound must be substantial. Two three-letter roots will
  // find each other inside almost any word - that is how "mother" becomes
  // "mot + her" - so a compound reading has to earn it.
  if (first.form.length < MIN_CHAIN_ROOT) return [first]

  // A connecting vowel often sits between two roots (anthrop-o-logy), but the
  // next root may equally well begin with a vowel (phil-anthrop), so try both
  // readings rather than assuming.
  let second: Morpheme | null = null
  for (const candidate of [rest, rest.replace(/^[aeiou]/, '')]) {
    const match = longestMatch(ROOT_LIST, (f) => f.length >= MIN_CHAIN_ROOT && candidate.startsWith(f))
    if (match && (!second || match.form.length > second.form.length)) second = match
  }
  return second ? [first, second] : [first]
}

function normalize(word: string): string {
  return word.toLowerCase().replace(/[^a-z]/g, '')
}

export function analyze(word: string): Analysis | null {
  const clean = normalize(word)

  const override = OVERRIDES[clean]
  if (override) {
    const lang = override.lang ?? 'Latin'
    return {
      parts: override.parts.map((p) => ({ kind: 'root' as const, form: p.form, gloss: p.gloss, lang })),
      lang,
      note: override.note,
      coverage: 1,
    }
  }

  if (clean.length < MIN_WORD || FALSE_FRIENDS.has(clean)) return null

  // Search the plausible splits rather than committing to the longest match at
  // each step: "biology" needs the short suffix (-logy, leaving the root bio),
  // while "dictionary" needs two stacked suffixes.
  const prefixOptions: (Morpheme | null)[] = [
    null,
    ...allMatches(PREFIX_LIST, (f) => clean.startsWith(f) && clean.length - f.length >= MIN_ROOT),
  ]

  let best: { parts: WordPart[]; lang: Lang; coverage: number } | null = null

  for (const prefix of prefixOptions) {
    const afterPrefix = prefix ? clean.slice(prefix.form.length) : clean
    const outerOptions: (Morpheme | null)[] = [
      null,
      ...allMatches(SUFFIX_LIST, (f) => afterPrefix.endsWith(f) && afterPrefix.length - f.length >= MIN_ROOT),
    ]

    for (const outer of outerOptions) {
      const afterOuter = outer ? afterPrefix.slice(0, afterPrefix.length - outer.form.length) : afterPrefix
      const innerOptions: (Morpheme | null)[] = [
        null,
        ...allMatches(SUFFIX_LIST, (f) => afterOuter.endsWith(f) && afterOuter.length - f.length >= MIN_ROOT),
      ]

      for (const inner of innerOptions) {
        const core = inner ? afterOuter.slice(0, afterOuter.length - inner.form.length) : afterOuter

        // The root has to begin where the root belongs: right after the prefix.
        // Allowing it anywhere in the word turns an analyzer into a coincidence
        // generator.
        const roots = rootChain(core)
        if (!roots.length) continue

        const covered =
          (prefix?.form.length ?? 0) +
          roots.reduce((n, r) => n + r.form.length, 0) +
          (inner?.form.length ?? 0) +
          (outer?.form.length ?? 0)
        const coverage = covered / clean.length
        if (coverage < MIN_COVERAGE) continue

        const parts: WordPart[] = []
        if (prefix) parts.push({ kind: 'prefix', form: prefix.form + '-', gloss: prefix.gloss, lang: prefix.lang })
        for (const r of roots) parts.push({ kind: 'root', form: r.form, gloss: r.gloss, lang: r.lang })
        if (inner) parts.push({ kind: 'suffix', form: '-' + inner.form, gloss: inner.gloss, lang: inner.lang })
        if (outer) parts.push({ kind: 'suffix', form: '-' + outer.form, gloss: outer.gloss, lang: outer.lang })

        // A single root on its own says nothing a reader can use.
        if (parts.length < 2) continue

        const candidate = { parts, lang: roots[0].lang, coverage }
        // Best coverage wins; ties go to the simpler reading.
        if (!best || coverage > best.coverage || (coverage === best.coverage && parts.length < best.parts.length)) {
          best = candidate
        }
      }
    }
  }

  return best
}

/** One-line rendering: "Latin · bene- well + vol wish + -ent doing" */
export function describe(analysis: Analysis): string {
  const body = analysis.parts.map((p) => `${p.form} ${p.gloss}`).join(' + ')
  return analysis.note ? `${analysis.lang} · ${body} · ${analysis.note}` : `${analysis.lang} · ${body}`
}
