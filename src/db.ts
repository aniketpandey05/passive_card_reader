import Dexie from 'dexie'
import type { Table } from 'dexie'
import type { Deck, Entry, Progress, Settings } from './types'
import { DEFAULT_SETTINGS } from './types'

class WordFlowDB extends Dexie {
  decks!: Table<Deck, number>
  entries!: Table<Entry, number>
  progress!: Table<Progress, number>
  settings!: Table<Settings, string>

  constructor() {
    super('wordflow')
    this.version(1).stores({
      decks: '++id, name',
      entries: '++id, deckId, [deckId+idx], [deckId+key]',
      progress: 'deckId',
      settings: 'id',
    })
  }
}

export const db = new WordFlowDB()

export interface RawEntry {
  word: string
  pos?: string
  meaning: string
}

export function sortKey(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()
}

export async function getSettings(): Promise<Settings> {
  const stored = await db.settings.get('app')
  if (stored) return { ...DEFAULT_SETTINGS, ...stored }
  await db.settings.put(DEFAULT_SETTINGS)
  return DEFAULT_SETTINGS
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch, id: 'app' as const }
  await db.settings.put(next)
  return next
}

export async function createDeck(
  name: string,
  source: string,
  raw: RawEntry[],
  opts: { sort?: boolean; license?: string } = {},
): Promise<number> {
  const cleaned = raw
    .map((e) => ({ word: e.word?.trim() ?? '', pos: e.pos?.trim() || undefined, meaning: e.meaning?.trim() ?? '' }))
    .filter((e) => e.word && e.meaning)
  if (opts.sort !== false) cleaned.sort((a, b) => sortKey(a.word).localeCompare(sortKey(b.word)))

  const deckId = await db.decks.add({
    name,
    source,
    license: opts.license,
    createdAt: Date.now(),
    entryCount: cleaned.length,
  })

  const rows: Entry[] = cleaned.map((e, i) => ({
    deckId,
    idx: i,
    word: e.word,
    key: sortKey(e.word),
    pos: e.pos,
    meaning: e.meaning,
  }))
  for (let i = 0; i < rows.length; i += 500) {
    await db.entries.bulkAdd(rows.slice(i, i + 500))
  }
  await db.progress.put({ deckId, idx: 0, updatedAt: Date.now() })
  return deckId
}

export async function deleteDeck(deckId: number): Promise<void> {
  await db.entries.where('deckId').equals(deckId).delete()
  await db.progress.delete(deckId)
  await db.decks.delete(deckId)
}

export function getEntry(deckId: number, idx: number): Promise<Entry | undefined> {
  return db.entries.where('[deckId+idx]').equals([deckId, idx]).first()
}

/** Prefix search over a deck, for the "start from this word" picker. */
export function searchEntries(deckId: number, query: string, limit = 40): Promise<Entry[]> {
  const q = sortKey(query)
  if (!q) return db.entries.where('[deckId+idx]').between([deckId, 0], [deckId, limit]).toArray()
  return db.entries
    .where('[deckId+key]')
    .between([deckId, q], [deckId, q + '\uffff'])
    .limit(limit)
    .toArray()
}

/** First entry at or after a letter, so A-Z jumps land somewhere sensible. */
export async function firstEntryForLetter(deckId: number, letter: string): Promise<Entry | undefined> {
  return db.entries
    .where('[deckId+key]')
    .between([deckId, letter.toLowerCase()], [deckId, '\uffff'])
    .first()
}
