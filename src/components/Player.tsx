import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { db, familyWords, getEntry, setStarred, starredWords } from '../db'
import type { Entry, Settings } from '../types'
import { readMs, recallMs } from '../lib/timing'
import { calmRate, cancelSpeech, speak } from '../lib/speech'
import { analyze } from '../lib/morphology'
import SettingsSheet from './SettingsSheet'
import WordCard from './WordCard'

interface Props {
  deckId: number
  startIdx: number
  /** 'starred' plays only the marked words. */
  only?: 'starred'
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

export default function Player({ deckId, startIdx, only, settings, onPatch, onExit }: Props) {
  const [idx, setIdx] = useState(startIdx)
  const [phase, setPhase] = useState<Phase>('word')
  const [playing, setPlaying] = useState(true)
  const [entry, setEntry] = useState<Entry | null>(null)
  const [deckName, setDeckName] = useState('')
  const [count, setCount] = useState(0)
  const [finished, setFinished] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  /** Which related word is open in the mini card, if any. */
  const [reading, setReading] = useState<{ words: string[]; at: number } | null>(null)
  /** Positions to walk, or null for the whole deck in order. */
  const [sequence, setSequence] = useState<number[] | null>(null)

  const idxRef = useRef(idx)
  const countRef = useRef(0)
  const historyRef = useRef<number[]>([])
  const sequenceRef = useRef<number[] | null>(null)
  const touchRef = useRef<{ x: number; y: number } | null>(null)
  const swipedRef = useRef(false)

  useEffect(() => {
    idxRef.current = idx
  }, [idx])
  useEffect(() => {
    countRef.current = count
  }, [count])
  useEffect(() => {
    sequenceRef.current = sequence
  }, [sequence])

  useEffect(() => {
    void db.decks.get(deckId).then((deck) => {
      if (!deck) return
      setDeckName(deck.name)
      setCount(deck.entryCount)
    })
  }, [deckId])

  // Playing only the starred words walks a list of positions rather than
  // counting upward, so everything below asks the sequence where "next" is.
  useEffect(() => {
    if (only !== 'starred') {
      setSequence(null)
      return
    }
    let live = true
    void starredWords(deckId).then((words) => {
      if (!live) return
      const list = words.map((w) => w.idx).sort((a, b) => a - b)
      setSequence(list)
      if (list.length && !list.includes(idxRef.current)) setIdx(list[0])
    })
    return () => {
      live = false
    }
  }, [deckId, only])

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

  /**
   * A thousand words is not a session. Counting what has been seen today gives
   * the run an end you can actually reach, instead of a number that only ever
   * says you have barely started.
   */
  const countSeen = useCallback(() => {
    const day = new Date().toISOString().slice(0, 10)
    const seen = settings.sessionDate === day ? settings.sessionSeen + 1 : 1
    onPatch({ sessionDate: day, sessionSeen: seen })
  }, [settings.sessionDate, settings.sessionSeen, onPatch])

  const next = useCallback(() => {
    const sequence = sequenceRef.current
    const total = sequence ? sequence.length : countRef.current
    const cur = idxRef.current
    // Where we are in the run, which is the whole deck or only the starred.
    const at = sequence ? sequence.indexOf(cur) : cur

    if (settings.order === 'shuffle' && total > 1) {
      let n = at
      while (n === at) n = Math.floor(Math.random() * total)
      historyRef.current.push(cur)
      setIdx(sequence ? sequence[n] : n)
      setPhase('word')
      countSeen()
      return
    }
    if (at + 1 >= total) {
      setPlaying(false)
      setFinished(true)
      return
    }
    historyRef.current.push(cur)
    setIdx(sequence ? sequence[at + 1] : cur + 1)
    setPhase('word')
    countSeen()
  }, [settings.order, countSeen])

  const prev = useCallback(() => {
    const back = historyRef.current.pop()
    setFinished(false)
    setIdx(back ?? Math.max(0, idxRef.current - 1))
    setPhase('word')
  }, [])

  const today = new Date().toISOString().slice(0, 10)
  const seenToday = settings.sessionDate === today ? settings.sessionSeen : 0
  // The limit is there to give an endless deck an end. A starred review is
  // already a short, deliberate list, so it is exempt.
  const sessionDone = only !== 'starred' && settings.sessionSize > 0 && seenToday >= settings.sessionSize

  const reveal = useCallback(() => setPhase('meaning'), [])

  const toggleStar = useCallback(() => {
    if (!entry?.id) return
    const next = entry.starred ? undefined : (1 as const)
    setEntry({ ...entry, starred: next })
    void setStarred(entry.id, !entry.starred)
  }, [entry])

  const onStageClick = useCallback(() => {
    // A swipe ends in a click too; the gesture has already been acted on.
    if (swipedRef.current) {
      swipedRef.current = false
      return
    }
    if (phase === 'word') reveal()
    else next()
  }, [phase, reveal, next])

  /**
   * Swipe to move between cards. Tapping reveals, so moving on needs its own
   * gesture, and on a phone reaching the arrow buttons means moving your thumb
   * across the screen.
   */
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    touchRef.current = { x: touch.clientX, y: touch.clientY }
  }, [])

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const start = touchRef.current
      touchRef.current = null
      if (!start) return
      const touch = e.changedTouches[0]
      const dx = touch.clientX - start.x
      const dy = touch.clientY - start.y
      // Clearly sideways, and far enough to be deliberate rather than a scroll.
      if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.5) return
      swipedRef.current = true
      // A short tick confirms the gesture registered, which matters when the
      // next word looks much like the last.
      navigator.vibrate?.(8)
      if (dx < 0) next()
      else prev()
    },
    [next, prev],
  )

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
    if (!playing || !entry || finished || sessionDone) return
    const isWord = phase === 'word'
    const dur = isWord ? recallMs(settings) : readMs(entry.meaning, settings)
    const toSay = isWord ? entry.word : settings.speakMeaning ? entry.meaning : ''

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const held = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, dur)
    })
    const spoken =
      settings.voice && toSay
        ? speak(toSay, { rate: calmRate(settings.speed), pitch: settings.voicePitch, voiceURI: settings.voiceURI })
        : Promise.resolve()

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
  }, [playing, entry, phase, settings, finished, sessionDone, reveal, next])

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
        case 's':
        case 'S':
          toggleStar()
          break
        case 'Escape':
          onExit()
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, reveal, onExit, toggleStar])

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
      // The table's own examples first, then whatever the dictionary lists.
      const others = [...(root.examples ?? []), ...(entry.related ?? [])]
        .filter((w) => !taken.has(w.toLowerCase()) && !taken.has(w) && (taken.add(w.toLowerCase()), true))
        .slice(0, 6 - inDeck.length)
      setRelatives(inDeck.length || others.length ? { root: root.form, inDeck, others } : null)
    })
    return () => {
      live = false
    }
  }, [deckId, entry, parts])

  // Words with no root the table knows still have relatives in the dictionary.
  const dictionaryRelated = !relatives && settings.showParts ? (entry?.related ?? []).slice(0, 6) : []
  // One flat list, so the mini card can page through exactly what is on screen.
  const relatedRow = relatives ? [...relatives.inDeck.map((w) => w.word), ...relatives.others] : []

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
          <span className="crumb-name">{deckName}</span>
          <span className="crumb-count">
            {sequence ? sequence.indexOf(idx) + 1 : idx + 1} / {sequence ? sequence.length : count}
          </span>
          {settings.sessionSize > 0 && (
            <span className="crumb-today">{Math.min(seenToday, settings.sessionSize)}/{settings.sessionSize} today</span>
          )}
        </div>
        <button
          className={entry?.starred ? 'icon starred' : 'icon'}
          onClick={toggleStar}
          aria-pressed={!!entry?.starred}
          aria-label={entry?.starred ? 'Remove the star' : 'Mark as important'}
          title="Mark as important (S)"
        >
          {entry?.starred ? '★' : '☆'}
        </button>
        <button className="icon" onClick={() => setShowSettings(true)} aria-label="Settings">
          ☰
        </button>
      </header>

      <main className="stage" onClick={onStageClick} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {sessionDone && !finished ? (
          // A finishing point, rather than a counter that always reads "barely
          // started". Carrying on is one tap away for anyone who wants it.
          <div className="done">
            <p className="done-mark">✓</p>
            <p>
              That's {settings.sessionSize} words today{only === 'starred' ? ', from your starred list' : ''}.
            </p>
            <div className="row" style={{ justifyContent: 'center' }}>
              <button className="btn primary" onClick={onExit}>
                Done for today
              </button>
              <button
                className="btn"
                onClick={() => onPatch({ sessionSeen: 0, sessionDate: today })}
              >
                Keep going
              </button>
            </div>
          </div>
        ) : finished ? (
          <div className="done">
            <p>{only === 'starred' ? "That's every starred word." : "That's the end of the deck."}</p>
            <button className="btn primary" onClick={restart}>
              Start again
            </button>
          </div>
        ) : entry ? (
          <>
            {/* The idea a word sits under, in dictionaries grouped by concept
                rather than alphabet. It is the reason to read Roget in order. */}
            {entry.theme && <div className="theme">{entry.theme}</div>}
            {/* keyed so each new word replays the fade-in */}
            <div className="word" key={entry.idx}>
              {entry.word}
            </div>
            {entry.pos && <div className="pos">{entry.pos}</div>}
            {/* Announced when it appears: the reveal is the whole point of the
                card, and a screen reader would otherwise never hear it. */}
            <div className="meaning-slot" aria-live="polite" aria-atomic="true">
              {phase === 'meaning' ? (
                <div key={entry.idx}>
                  <p className="meaning">{entry.meaning}</p>
                  {parts ? (
                    <p className="parts">
                      <span className="lang">{parts.lang}</span>
                      {parts.parts.map((p) => (
                        <span className="part" key={p.kind + p.form}>
                          <b>{p.form}</b> {p.gloss}
                        </span>
                      ))}
                      {parts.note && <span className="part note">{parts.note}</span>}
                    </p>
                  ) : (
                    // No breakdown possible - "taciturn" is Latin taciturnus and
                    // no table of roots will ever account for "-iturn" - but the
                    // dictionary still knows where the word came from.
                    settings.showParts &&
                    entry.origin && (
                      <p className="parts">
                        {entry.originLang && <span className="lang">{entry.originLang}</span>}
                        <span className="part origin">{entry.origin}</span>
                      </p>
                    )
                  )}
                  {relatives && (
                    <p className="family">
                      <span className="also">
                        also from <b>{relatives.root}</b>
                      </span>
                      {relatedRow.map((w, i) => (
                        <button
                          key={w}
                          className="relative"
                          onClick={(e) => {
                            e.stopPropagation() // the stage itself advances the card
                            setReading({ words: relatedRow, at: i })
                          }}
                        >
                          {w}
                        </button>
                      ))}
                    </p>
                  )}
                  {(entry.synonyms?.length || entry.antonyms?.length) && settings.showParts ? (
                    <p className="family">
                      {entry.synonyms?.length ? (
                        <>
                          <span className="also">similar</span>
                          {entry.synonyms.map((w, i) => (
                            <button
                              key={w}
                              className="relative"
                              onClick={(e) => {
                                e.stopPropagation()
                                setReading({ words: entry.synonyms as string[], at: i })
                              }}
                            >
                              {w}
                            </button>
                          ))}
                        </>
                      ) : null}
                      {entry.antonyms?.length ? (
                        <>
                          <span className="also opposite">opposite</span>
                          {entry.antonyms.map((w, i) => (
                            <button
                              key={w}
                              className="relative"
                              onClick={(e) => {
                                e.stopPropagation()
                                setReading({ words: entry.antonyms as string[], at: i })
                              }}
                            >
                              {w}
                            </button>
                          ))}
                        </>
                      ) : null}
                    </p>
                  ) : null}
                  {!relatives && dictionaryRelated.length > 0 && (
                    <p className="family">
                      <span className="also">related</span>
                      {dictionaryRelated.map((w, i) => (
                        <button
                          key={w}
                          className="relative"
                          onClick={(e) => {
                            e.stopPropagation()
                            setReading({ words: dictionaryRelated, at: i })
                          }}
                        >
                          {w}
                        </button>
                      ))}
                    </p>
                  )}
                </div>
              ) : (
                <p className="hint">
                  <span className="hint-pointer">
                    tap, or press <kbd>↓</kbd>
                  </span>
                  <span className="hint-touch">tap to reveal · swipe to move on</span>
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

      {reading && (
        <WordCard
          deckId={deckId}
          words={reading.words}
          startAt={reading.at}
          onGoTo={jumpTo}
          onClose={() => setReading(null)}
        />
      )}

      {showSettings && <SettingsSheet settings={settings} onPatch={onPatch} onClose={() => setShowSettings(false)} />}
    </div>
  )
}
