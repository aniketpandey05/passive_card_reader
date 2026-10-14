/** Thin wrapper over the browser's built-in text-to-speech. */

export function speechAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function listVoices(): SpeechSynthesisVoice[] {
  if (!speechAvailable()) return []
  return window.speechSynthesis
    .getVoices()
    .filter((v) => v.lang.toLowerCase().startsWith('en'))
    .sort((a, b) => voiceScore(b) - voiceScore(a))
}

// Names of the warmer, lower English voices each platform ships. There is no
// API for timbre or gender, so the name is the only signal available.
const WARM_VOICES = [
  'daniel', // macOS / iOS en-GB, the calmest of the Apple set
  'arthur',
  'oliver',
  'george',
  'james',
  'alex', // macOS en-US
  'rishi',
  'guy', // Microsoft
  'davis',
  'ryan',
  'mark',
  'aaron',
  'male',
]

// Thin or strident engines, and the voices that are clearly not what was asked for.
const AVOID_VOICES = ['espeak', 'zira', 'female', 'samantha', 'victoria', 'karen', 'moira', 'tessa', 'fiona', 'serena', 'catherine']

function voiceScore(voice: SpeechSynthesisVoice): number {
  const name = voice.name.toLowerCase()
  let score = 0
  if (WARM_VOICES.some((hint) => name.includes(hint))) score += 4
  if (AVOID_VOICES.some((hint) => name.includes(hint))) score -= 6
  // Network voices are generally the better-sounding engine.
  if (!voice.localService || name.includes('google') || name.includes('natural')) score += 2
  if (/^en-(gb|us)/i.test(voice.lang)) score += 1
  if (voice.default) score += 1
  return score
}

/** The best-sounding English voice available, when none has been chosen. */
export function preferredVoice(): SpeechSynthesisVoice | undefined {
  return listVoices()[0]
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

/**
 * How fast to speak at a given card speed.
 *
 * Deliberately not the card speed itself: that runs to 2.5x, and speech at
 * 2.5x is a chipmunk reading a list. The voice shifts with the slider but stays
 * inside a calm band, and sits just below normal pace at the default setting.
 */
export function calmRate(speed: number): number {
  return Math.min(Math.max(0.85 + (speed - 1) * 0.25, 0.7), 1.35)
}

export function speak(text: string, opts: { rate?: number; voiceURI?: string | null } = {}): Promise<void> {
  if (!speechAvailable() || !text.trim()) return Promise.resolve()
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text)
    u.rate = Math.min(Math.max(opts.rate ?? 1, 0.5), 2)
    // A touch below default pitch reads as settled rather than bright.
    u.pitch = 0.9
    const chosen = opts.voiceURI
      ? window.speechSynthesis.getVoices().find((v) => v.voiceURI === opts.voiceURI)
      : preferredVoice()
    if (chosen) u.voice = chosen
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
