import type { RawEntry } from '../db'
import { CORE_COUNT, CORE_NAME } from './core-meta'
import { ROGET_COUNT, ROGET_NAME, ROGET_THEMES } from './roget-meta'
import { WEBSTER_COUNT, WEBSTER_NAME } from './webster-meta'

/**
 * The dictionaries that ship with the app.
 *
 * Each is a named book rather than one blended pile, so a reader can take
 * Roget without having to go and find a copy of Roget, and can tell which
 * dictionary a word came from later. Entries load only when a dictionary is
 * actually added: the catalogue itself costs a few hundred bytes.
 */
export interface Pack {
  id: string
  name: string
  blurb: string
  count: number
  /** Stored on the deck, and what marks a dictionary as already added. */
  source: string
  /** False keeps the book's own order, which for Roget is the point of it. */
  sort: boolean
  load: () => Promise<RawEntry[]>
}

export const PACKS: Pack[] = [
  {
    id: 'core',
    name: CORE_NAME,
    blurb: `${CORE_COUNT.toLocaleString()} words worth knowing, A to Z, with roots and origins.`,
    count: CORE_COUNT,
    source: 'built in',
    sort: true,
    load: async () => (await import('./core')).CORE_PACK,
  },
  {
    id: 'webster',
    name: WEBSTER_NAME,
    blurb: `${WEBSTER_COUNT.toLocaleString()} entries in the voice of 1913, from the dictionary Merriam-Webster grew out of.`,
    count: WEBSTER_COUNT,
    source: "webster's 1913",
    sort: true,
    load: async () => (await import('./webster')).WEBSTER_PACK,
  },
  {
    id: 'roget',
    name: ROGET_NAME,
    blurb: `${ROGET_COUNT.toLocaleString()} words grouped by idea rather than alphabet, ${ROGET_THEMES} ideas in all.`,
    count: ROGET_COUNT,
    source: "roget's thesaurus 1911",
    sort: false,
    load: async () => (await import('./roget')).ROGET_PACK,
  },
]
