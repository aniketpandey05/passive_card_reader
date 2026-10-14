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

/**
 * Engines that actually sound like a person. Judging the engine matters far
 * more than guessing at timbre from a first name: a neural voice reads calmly
 * at any pitch, while Windows' legacy SAPI voices cannot, however they are
 * tuned. "Microsoft Mark" is a male voice and still sounds like a 2010 satnav.
 */
const GOOD_ENGINES = ['natural', 'neural', 'online', 'google', 'siri', 'premium', 'enhanced', 'eloquence']

/** Legacy desktop voices, kept as a last resort rather than a preference. */
const LEGACY_ENGINES = ['david', 'mark', 'zira', 'hazel', 'ravi', 'heera', 'george', 'susan', 'espeak', 'pico']

/** Warmer, lower voices among the good engines, where the platform has them. */
const WARM_NAMES = ['daniel', 'arthur', 'oliver', 'james', 'alex', 'rishi', 'guy', 'davis', 'ryan', 'aaron', 'male']

/** Clearly not what was asked for, when there is a choice. */
const OTHER_VOICE_NAMES = ['female', 'samantha', 'victoria', 'karen', 'moira', 'tessa', 'fiona', 'serena', 'catherine', 'zira', 'heera']

export function voiceQuality(voice: SpeechSynthesisVoice): 'good' | 'plain' | 'legacy' {
  const name = voice.name.toLowerCase()
  if (GOOD_ENGINES.some((hint) => name.includes(hint)) || !voice.localService) return 'good'
  if (LEGACY_ENGINES.some((hint) => name.includes(hint))) return 'legacy'
  return 'plain'
}

function voiceScore(voice: SpeechSynthesisVoice): number {
  const name = voice.name.toLowerCase()
  const quality = voiceQuality(voice)
  let score = quality === 'good' ? 8 : quality === 'legacy' ? 0 : 4
  if (WARM_NAMES.some((hint) => name.includes(hint))) score += 3
  if (OTHER_VOICE_NAMES.some((hint) => name.includes(hint))) score -= 2
  if (/^en-(gb|us|au|ie)/i.test(voice.lang)) score += 1
  return score
}

/** The best-sounding English voice available, when none has been chosen. */
export function preferredVoice(): SpeechSynthesisVoice | undefined {
  return listVoices()[0]
}

/**
 * True when every available voice is a legacy desktop engine, so the app can
 * say so rather than letting the user think this is as good as it gets.
 */
export function onlyLegacyVoices(): boolean {
  const voices = listVoices()
  return voices.length > 0 && voices.every((v) => voiceQuality(v) === 'legacy')
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
  return Math.min(Math.max(0.9 + (speed - 1) * 0.25, 0.75), 1.35)
}

export function speak(text: string, opts: { rate?: number; voiceURI?: string | null } = {}): Promise<void> {
  if (!speechAvailable() || !text.trim()) return Promise.resolve()
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text)
    u.rate = Math.min(Math.max(opts.rate ?? 1, 0.5), 2)
    // Only a touch below default. Pushing pitch further down reads as muffled
    // on the older engines rather than calm - they resample rather than
    // resynthesise, so the artefacts get louder along with the warmth.
    u.pitch = 0.95
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
