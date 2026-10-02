import type { Settings } from '../types'

/** How long the word sits alone, giving the user a chance to recall it. */
export function recallMs(s: Settings): number {
  return Math.round(s.recallMs / s.speed)
}

/**
 * How long the meaning stays on screen. Scaled by its length, because a fixed
 * timer is far too short for a 40-word definition and too long for "to lessen".
 */
export function readMs(meaning: string, s: Settings): number {
  const words = meaning.trim().split(/\s+/).filter(Boolean).length || 1
  const raw = (words / s.wpm) * 60_000 + 1_000
  return Math.round(Math.min(Math.max(raw, 1_800), 20_000) / s.speed)
}
