import { useEffect, useState } from 'react'
import { findByWord } from '../db'
import type { Entry } from '../types'
import { useEscape } from '../lib/useEscape'
import { analyze } from '../lib/morphology'

interface Props {
  deckId: number
  /** The whole related set, so one can be read and the rest paged through. */
  words: string[]
  startAt: number
  /** Jump the player to this word, when it is in the deck. */
  onGoTo: (idx: number) => void
  onClose: () => void
}

interface Shown {
  word: string
  pos?: string
  meaning?: string
  originLang?: string
  origin?: string
  /** Set when the word is in the deck, so the player can jump to it. */
  idx?: number
}

export default function WordCard({ deckId, words, startAt, onGoTo, onClose }: Props) {
  useEscape(onClose)
  const [at, setAt] = useState(startAt)
  const [shown, setShown] = useState<Shown | null>(null)
  const [loading, setLoading] = useState(true)

  const word = words[at]

  useEffect(() => {
    let live = true
    setLoading(true)
    void (async () => {
      // The deck first: it has the fuller entry, and needs no extra download.
      const entry: Entry | undefined = await findByWord(deckId, word)
      if (!live) return
      if (entry) {
        setShown({
          word: entry.word,
          pos: entry.pos,
          meaning: entry.meaning,
          originLang: entry.originLang,
          origin: entry.origin,
          idx: entry.idx,
        })
        setLoading(false)
        return
      }
      // Otherwise the bundled glossary, loaded the first time one is opened.
      const { GLOSSARY } = await import('../data/glossary')
      if (!live) return
      const gloss = GLOSSARY[word.toLowerCase()]
      setShown({ word, pos: gloss?.pos, meaning: gloss?.meaning })
      setLoading(false)
    })()
    return () => {
      live = false
    }
  }, [deckId, word])

  const parts = shown ? analyze(shown.word) : null

  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet wordcard" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={word}>
        <div className="wordcard-head">
          <span className="meta" style={{ margin: 0 }}>
            {at + 1} of {words.length}
          </span>
          <button className="icon" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <h2 className="wordcard-word">{shown?.word ?? word}</h2>
        {shown?.pos && <p className="pos">{shown.pos}</p>}

        {loading ? (
          <p className="hint">Looking it up…</p>
        ) : shown?.meaning ? (
          <p className="wordcard-meaning">{shown.meaning}</p>
        ) : (
          <p className="hint">No meaning stored for this one.</p>
        )}

        {(parts || shown?.origin) && (
          <p className="parts" style={{ marginTop: 14 }}>
            {parts ? (
              <>
                <span className="lang">{parts.lang}</span>
                {parts.parts.map((p) => (
                  <span className="part" key={p.kind + p.form}>
                    <b>{p.form}</b> {p.gloss}
                  </span>
                ))}
              </>
            ) : (
              <>
                {shown?.originLang && <span className="lang">{shown.originLang}</span>}
                <span className="part origin">{shown?.origin}</span>
              </>
            )}
          </p>
        )}

        <div className="wordcard-nav">
          <button className="btn small" onClick={() => setAt((i) => (i - 1 + words.length) % words.length)} disabled={words.length < 2}>
            ‹ Previous
          </button>
          {shown?.idx !== undefined && (
            <button
              className="btn small primary"
              onClick={() => {
                const idx = shown.idx as number
                onClose()
                onGoTo(idx)
              }}
            >
              Go to this card
            </button>
          )}
          <button className="btn small" onClick={() => setAt((i) => (i + 1) % words.length)} disabled={words.length < 2}>
            Next ›
          </button>
        </div>
      </div>
    </div>
  )
}
