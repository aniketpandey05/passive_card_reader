import { useEffect, useState } from 'react'
import { firstEntryForLetter, searchEntries, starredWords } from '../db'
import type { Deck, Entry } from '../types'
import { useEscape } from '../lib/useEscape'

interface Props {
  deck: Deck & { id: number }
  resumeIdx: number
  onStart: (idx: number) => void
  onClose: () => void
}

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('')

export default function StartPicker({ deck, resumeIdx, onStart, onClose }: Props) {
  useEscape(onClose)

  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<Entry[]>([])
  const [starred, setStarred] = useState<Entry[]>([])

  useEffect(() => {
    void starredWords(deck.id).then(setStarred)
  }, [deck.id])

  useEffect(() => {
    let live = true
    const t = setTimeout(() => {
      void searchEntries(deck.id, query, 40).then((rows) => {
        if (live) setHits(rows)
      })
    }, 120)
    return () => {
      live = false
      clearTimeout(t)
    }
  }, [deck.id, query])

  const jump = async (letter: string) => {
    const entry = await firstEntryForLetter(deck.id, letter)
    if (entry) onStart(entry.idx)
  }

  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Choose a starting word">
        <h2>Start from</h2>
        <p className="sub">{deck.name}</p>

        <div className="row" style={{ marginTop: 0, marginBottom: 14 }}>
          <button className="btn" onClick={() => onStart(resumeIdx)} disabled={resumeIdx <= 0}>
            Resume (word {resumeIdx + 1})
          </button>
          <button className="btn" onClick={() => onStart(0)}>
            Beginning
          </button>
        </div>

        {starred.length > 0 && (
          <>
            <p className="meta" style={{ margin: '0 0 6px' }}>
              ★ Marked important ({starred.length})
            </p>
            <div className="azrow starred-row">
              {starred.map((w) => (
                <button key={w.idx} className="relative" onClick={() => onStart(w.idx)} title={w.meaning}>
                  {w.word}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="azrow">
          {LETTERS.map((l) => (
            <button key={l} onClick={() => void jump(l)} aria-label={`Jump to ${l.toUpperCase()}`}>
              {l}
            </button>
          ))}
        </div>

        <label className="field">
          Search for a word
          <input
            type="text"
            value={query}
            autoFocus
            placeholder="e.g. ephemeral"
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>

        <ul className="hits">
          {hits.map((h) => (
            <li key={h.idx}>
              <button onClick={() => onStart(h.idx)}>
                <span className="w">{h.word}</span>
                <span className="m">{h.meaning}</span>
              </button>
            </li>
          ))}
          {!hits.length && (
            <li>
              <span className="m" style={{ padding: '12px 4px', display: 'block' }}>
                Nothing matches that.
              </span>
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}
