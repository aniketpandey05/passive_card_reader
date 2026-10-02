import { useEffect } from 'react'

/**
 * Close-on-Escape for sheets. Captures, so the player underneath doesn't also
 * act on the same key press and exit to the library.
 */
export function useEscape(onEscape: () => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onEscape()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onEscape])
}
