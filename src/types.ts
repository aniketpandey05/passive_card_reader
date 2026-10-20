export type Order = 'alpha' | 'shuffle'

export interface Deck {
  id?: number
  name: string
  source: string
  license?: string
  createdAt: number
  entryCount: number
}

export interface Entry {
  id?: number
  deckId: number
  /** Position in the deck, 0-based. Cards play in this order. */
  idx: number
  word: string
  /** Lowercased, punctuation-stripped form used for search and A-Z jumps. */
  key: string
  pos?: string
  meaning: string
  /** "Latin", "Greek" - where the word came from. */
  originLang?: string
  /** The derivation itself: "taciturnus" or "ad- toward + culture". */
  origin?: string
  /** Words sharing this word's ancestry, from the dictionary. */
  related?: string[]
  /** Words that mean nearly the same, from WordNet's synsets. */
  synonyms?: string[]
  /** Words that mean the opposite. */
  antonyms?: string[]
  /** The idea this word sits under, for dictionaries grouped by concept. */
  theme?: string
  /** Root families this word belongs to, indexed for "words sharing this root". */
  roots?: string[]
  /** 1 when marked important. Numeric because IndexedDB cannot index booleans. */
  starred?: 1
}

export interface Progress {
  deckId: number
  idx: number
  updatedAt: number
}

export interface Settings {
  id: 'app'
  /** Global multiplier, 0.5x - 2.5x. Scales every timing and the voice rate. */
  speed: number
  /** Pause between the word appearing and its meaning, before speed is applied. */
  recallMs: number
  /** Assumed reading speed for the meaning, in words per minute. */
  wpm: number
  voice: boolean
  voiceURI: string | null
  /** Speech pitch. Lower is deeper; the one lever every engine respects. */
  voicePitch: number
  speakMeaning: boolean
  /** Show the Latin/Greek breakdown under the meaning when one is known. */
  showParts: boolean
  order: Order
  /** "system" follows the device, which is what a phone at night wants. */
  theme: 'light' | 'dark' | 'system'
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'app',
  speed: 1,
  recallMs: 3000,
  wpm: 140,
  voice: false,
  voiceURI: null,
  voicePitch: 0.8,
  speakMeaning: true,
  showParts: true,
  order: 'alpha',
  theme: 'system',
}
