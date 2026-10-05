import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { db, familyWords, getEntry } from '../db'
import type { Entry, Settings } from '../types'
import { readMs, recallMs } from '../lib/timing'
import { cancelSpeech, speak } from '../lib/speech'
import { analyze } from '../lib/morphology'
import SettingsSheet from './SettingsSheet'

interface Props {
  deckId: number
  startIdx: number
  settings: Settings
  onPatch: (patch: Partial<Settings>) => void
  onExit: () => void
}

type Phase = 'word' | 'meaning'

function SpeakerIcon({ on }: { on: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="currentColor" fillOpacity="0.12" />
      {on ? (
        <>
          <path d="M15.8 9.2a4 4 0 0 1 0 5.6" />
          <path d="M18.4 6.6a7.5 7.5 0 0 1 0 10.8" />
        </>
      ) : (
        <path d="M16.5 9.5l5 5m0-5l-5 5" />
      )}
    </svg>
  )
}

export default function Player({ deckId, startIdx, settings, onPatch, onExit }: Props) {
  const [idx, setIdx] = useState(startIdx)
  const [phase, setPhase] = useState<Phase>('word')
  const [playing, setPlaying] = useState(true)
  const [entry, setEntry] = useState<Entry | null>(null)
  const [deckName, setDeckName] = useState('')
  const [count, setCount] = useState(0)
  const [finished, setFinished] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const idxRef = useRef(idx)
  const countRef = useRef(0)
  const historyRef = useRef<number[]>([])

  useEffect(() => {
    idxRef.current = idx
  }, [idx])
  useEffect(() => {
    countRef.current = count
  }, [count])

  useEffect(() => {
    void db.decks.get(deckId).then((deck) => {
      if (!deck) return
      setDeckName(deck.name)
      setCount(deck.entryCount)
    })
  }, [deckId])

  useEffect(() => {
    let live = true
    void getEntry(deckId, idx).then((e) => {
      if (live) setEntry(e ?? null)
    })
    return () => {
      live = false
    }
  }, [deckId, idx])

  // Remember where the user got to, so the deck can be resumed later.
  useEffect(() => {
    const t = setTimeout(() => {
      void db.progress.put({ deckId, idx, updatedAt: Date.now() })
    }, 400)
    return () => clearTimeout(t)
  }, [deckId, idx])

  const next = useCallback(() => {
    const total = countRef.current
    const cur = idxRef.current
    if (settings.order === 'shuffle' && total > 1) {
      let n = cur
      while (n === cur) n = Math.floor(Math.random() * total)
      historyRef.current.push(cur)
      setIdx(n)
      setPhase('word')
      return
    }
    if (cur + 1 >= total) {
      setPlaying(false)
      setFinished(true)
      return
    }
    historyRef.current.push(cur)
    setIdx(cur + 1)
    setPhase('word')
  }, [settings.order])

  const prev = useCallback(() => {
    const back = historyRef.current.pop()
    setFinished(false)
    setIdx(back ?? Math.max(0, idxRef.current - 1))
    setPhase('word')
  }, [])

  const reveal = useCallback(() => setPhase('meaning'), [])

  const onStageClick = useCallback(() => {
    if (phase === 'word') reveal()
    else next()
  }, [phase, reveal, next])

  const restart = useCallback(() => {
    historyRef.current = []
    setFinished(false)
    setIdx(0)
    setPhase('word')
    setPlaying(true)
  }, [])

  // The engine: hold the current phase for its duration (and until the voice
  // has finished, if it is on), then reveal the meaning or move to the next word.
  useEffect(() => {
    if (!playing || !entry || finished) return
    const isWord = phase === 'word'
    const dur = isWord ? recallMs(settings) : readMs(entry.meaning, settings)
    const toSay = isWord ? entry.word : settings.speakMeaning ? entry.meaning : ''

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const held = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, dur)
    })
    const spoken = settings.voice && toSay ? speak(toSay, { rate: settings.speed, voiceURI: settings.voiceURI }) : Promise.resolve()

    void Promise.all([held, spoken]).then(() => {
      if (cancelled) return
      if (isWord) reveal()
      else next()
    })

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      cancelSpeech()
    }
  }, [playing, entry, phase, settings, finished, reveal, next])

  // Don't let the screen sleep mid-session.
  useEffect(() => {
    if (!playing || !('wakeLock' in navigator)) return
    let sentinel: WakeLockSentinel | null = null
    let released = false
    void navigator.wakeLock
      .request('screen')
      .then((s) => {
        if (released) void s.release()
        else sentinel = s
      })
      .catch(() => {})
    return () => {
      released = true
      void sentinel?.release().catch(() => {})
    }
  }, [playing])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return
      switch (e.key) {
        case ' ':
          e.preventDefault()
          setPlaying((p) => !p)
          break
        case 'ArrowRight':
          e.preventDefault()
          next()
          break
        case 'ArrowLeft':
          e.preventDefault()
          prev()
          break
        case 'ArrowDown':
          e.preventDefault()
          reveal()
          break
        case 'Escape':
          onExit()
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, reveal, onExit])

  useEffect(() => cancelSpeech, [])

  const parts = useMemo(() => (entry && settings.showParts ? analyze(entry.word) : null), [entry, settings.showParts])

  // Words built on the same root, the way a dictionary prints related forms
  // under an entry: this deck's own words first, then the wider family.
  const [relatives, setRelatives] = useState<{ root: string; inDeck: Entry[]; others: string[] } | null>(null)
  useEffect(() => {
    const root = parts?.parts.find((p) => p.kind === 'root' && p.family)
    if (!entry || !root?.family) {
      setRelatives(null)
      return
    }
    let live = true
    void familyWords(deckId, root.family, entry.idx, 4).then((inDeck) => {
      if (!live) return
      const taken = new Set([entry.word.toLowerCase(), ...inDeck.map((w) => w.word.toLowerCase())])
      const others = (root.examples ?? []).filter((w) => !taken.has(w.toLowerCase())).slice(0, 6 - inDeck.length)
      setRelatives(inDeck.length || others.length ? { root: root.form, inDeck, others } : null)
    })
    return () => {
      live = false
    }
  }, [deckId, entry, parts])

  const jumpTo = useCallback((target: number) => {
    historyRef.current.push(idxRef.current)
    setFinished(false)
    setIdx(target)
    setPhase('word')
  }, [])

  const phaseMs = entry ? (phase === 'word' ? recallMs(settings) : readMs(entry.meaning, settings)) : 0
  const deckPct = count ? ((idx + 1) / count) * 100 : 0

  return (
    <div className={playing ? 'player playing' : 'player'}>
      <header className="bar">
        <button className="icon" onClick={onExit} aria-label="Back to library" title="Back (Esc)">
          ←
        </button>
        <div className="crumb">
          {deckName}
          <span className="sep">·</span>
          {count ? idx + 1 : 0} / {count}
        </div>
        <button className="icon" onClick={() => setShowSettings(true)} aria-label="Settings">
          ☰
        </button>
      </header>

      <main className="stage" onClick={onStageClick}>
        {finished ? (
          <div className="done">
            <p>That's the end of the deck.</p>
            <button className="btn primary" onClick={restart}>
              Start again
            </button>
          </div>
        ) : entry ? (
          <>
            {/* keyed so each new word replays the fade-in */}
            <div className="word" key={entry.idx}>
              {entry.word}
            </div>
            {entry.pos && <div className="pos">{entry.pos}</div>}
            <div className="meaning-slot">
              {phase === 'meaning' ? (
                <div key={entry.idx}>
                  <p className="meaning">{entry.meaning}</p>
                  {parts && (
                    <p className="parts">
                      <span className="lang">{parts.lang}</span>
                      {parts.parts.map((p) => (
                        <span className="part" key={p.kind + p.form}>
                          <b>{p.form}</b> {p.gloss}
                        </span>
                      ))}
                      {parts.note && <span className="part note">{parts.note}</span>}
                    </p>
                  )}
                  {relatives && (
                    <p className="family">
                      <span className="also">
                        also from <b>{relatives.root}</b>
                      </span>
                      {relatives.inDeck.map((w) => (
                        <button
                          key={w.idx}
                          className="relative"
                          onClick={(e) => {
                            e.stopPropagation() // the stage itself advances the card
                            jumpTo(w.idx)
                          }}
                          title={w.meaning}
                        >
                          {w.word}
                        </button>
                      ))}
                      {relatives.others.map((w) => (
                        <span className="relative outside" key={w} title="not in this deck">
                          {w}
                        </span>
                      ))}
                    </p>
                  )}
                </div>
              ) : (
                <p className="hint">
                  tap, or press <kbd>↓</kbd>
                </p>
              )}
            </div>
          </>
        ) : (
          <p className="hint">No card here.</p>
        )}
      </main>

      <footer className="controls">
        <div className="phasebar">
          <i
            key={`${idx}-${phase}-${playing}-${phaseMs}`}
            style={{ animationDuration: `${phaseMs}ms`, animationPlayState: playing && !finished ? 'running' : 'paused' }}
          />
        </div>

        <div className="buttons">
          <button className="icon" onClick={prev} aria-label="Previous word" title="Previous (←)">
            ⟨
          </button>
          <button
            className="play"
            onClick={() => (finished ? restart() : setPlaying((p) => !p))}
            aria-label={playing ? 'Pause' : 'Play'}
            title="Play / pause (Space)"
          >
            {playing ? '❙❙' : '▶'}
          </button>
          <button className="icon" onClick={next} aria-label="Next word" title="Next (→)">
            ⟩
          </button>
          <button
            className="icon"
            onClick={() => onPatch({ voice: !settings.voice })}
            aria-label={settings.voice ? 'Turn voice off' : 'Turn voice on'}
            title="Voice on / off"
            style={{ color: settings.voice ? 'var(--accent)' : undefined }}
          >
            <SpeakerIcon on={settings.voice} />
          </button>
        </div>

        <div className="speedrow">
          <span>slower</span>
          <input
            type="range"
            min={0.5}
            max={2.5}
            step={0.1}
            value={settings.speed}
            onChange={(e) => onPatch({ speed: Number(e.target.value) })}
            aria-label="Speed"
          />
          <span>faster</span>
          <b>{settings.speed.toFixed(1)}×</b>
        </div>

        <div className="track" style={{ width: 'min(560px, 100%)', margin: 0 }}>
          <i style={{ width: `${deckPct}%` }} />
        </div>
      </footer>

      {showSettings && <SettingsSheet settings={settings} onPatch={onPatch} onClose={() => setShowSettings(false)} />}
    </div>
  )
}
