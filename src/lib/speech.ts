/** Thin wrapper over the browser's built-in text-to-speech. */

export function speechAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function listVoices(): SpeechSynthesisVoice[] {
  if (!speechAvailable()) return []
  return window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('en'))
}

/** Voices load asynchronously in most browsers, so callers need to re-render. */
export function onVoicesChanged(cb: () => void): () => void {
  if (!speechAvailable()) return () => {}
  window.speechSynthesis.addEventListener('voiceschanged', cb)
  return () => window.speechSynthesis.removeEventListener('voiceschanged', cb)
}

export function cancelSpeech(): void {
  if (!speechAvailable()) return
  window.speechSynthesis.cancel()
}

export function speak(text: string, opts: { rate?: number; voiceURI?: string | null } = {}): Promise<void> {
  if (!speechAvailable() || !text.trim()) return Promise.resolve()
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text)
    u.rate = Math.min(Math.max(opts.rate ?? 1, 0.5), 2)
    if (opts.voiceURI) {
      const voice = window.speechSynthesis.getVoices().find((v) => v.voiceURI === opts.voiceURI)
      if (voice) u.voice = voice
    }
    let done = false
    const finish = () => {
      if (done) return
      done = true
      clearTimeout(guard)
      resolve()
    }
    // Some browsers never fire `end`. Estimate a ceiling so the player can't stall.
    const guard = setTimeout(finish, 4_000 + (text.length / (u.rate * 12)) * 1_000)
    u.onend = finish
    u.onerror = finish
    window.speechSynthesis.speak(u)
  })
}
