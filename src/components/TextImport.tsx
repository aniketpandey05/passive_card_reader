import { useEffect, useMemo, useState } from 'react'
import { createDeck, definitionsFor } from '../db'
import { forms, nameFor, readList, readProse } from '../lib/text'

interface Props {
  text: string
  title?: string
  /** Where it came from, for the deck's source line. */
  source?: string
  onCancel: () => void
  onDone: (deckId: number) => void
}

interface Found {
  word: string
  pos?: string
  meaning: string
}

export default function TextImport({ text, title, source, onCancel, onDone }: Props) {
  const [found, setFound] = useState<Found[] | null>(null)
  const [kind, setKind] = useState<'list' | 'prose'>('prose')
  const [undefined_, setUndefined] = useState(0)
  const [dropped, setDropped] = useState<Set<string>>(new Set())
  const [name, setName] = useState(() => nameFor(title, text))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    void (async () => {
      const list = readList(text)
      const words = list ? list.map((i) => i.word) : readProse(text).map((t) => t.word)

      // Three sources, in the order they deserve. The reader's own decks
      // first - those meanings are curated and carry an origin. Then the
      // bundled glossary. COMMON is not a source but a floor: without it a
      // passage comes back offering "about" and "error", which appear in the
      // glossary only because they are cross-references under something else.
      const [{ GLOSSARY }, { COMMON }, inDecks] = await Promise.all([
        import('../data/glossary'),
        import('../data/common'),
        definitionsFor(words.flatMap(forms)),
      ])
      if (!live) return

      const out: Found[] = []
      const taken = new Set<string>()
      let missing = 0

      const take = (word: string): Found | null => {
        for (const form of forms(word)) {
          const entry = inDecks.get(form)
          if (entry) return { word: entry.word, pos: entry.pos, meaning: entry.meaning }
          const gloss = GLOSSARY[form]
          if (gloss) return { word: form, pos: gloss.pos, meaning: gloss.meaning }
        }
        return null
      }

      if (list) {
        setKind('list')
        // A list is what someone chose to send. It is not second-guessed
        // against a frequency table.
        for (const item of list) {
          if (item.meaning) {
            if (!taken.has(item.word.toLowerCase())) {
              taken.add(item.word.toLowerCase())
              out.push({ word: item.word, meaning: item.meaning })
            }
            continue
          }
          const hit = take(item.word)
          if (!hit) missing++
          else if (!taken.has(hit.word)) {
            taken.add(hit.word)
            out.push(hit)
          }
        }
      } else {
        setKind('prose')
        for (const token of readProse(text)) {
          if (COMMON.has(token.word)) continue
          const hit = take(token.word)
          // The floor has to be checked again on what the lookup settled on.
          // A passage says "contemporaries" and "bordered", neither of which
          // is in a list of common words - but contemporary and border both
          // are, and those are the words that would end up on the cards.
          if (hit && COMMON.has(hit.word.toLowerCase())) continue
          if (!hit) {
            // Only count what a reader would recognise as a missed word.
            if (token.everLower) missing++
            continue
          }
          if (taken.has(hit.word)) continue
          taken.add(hit.word)
          out.push(hit)
          // A long article would otherwise hand someone two hundred cards.
          if (out.length >= 120) break
        }
      }

      setFound(out)
      setUndefined(missing)
    })()
    return () => {
      live = false
    }
  }, [text])

  const keeping = useMemo(() => (found ?? []).filter((f) => !dropped.has(f.word)), [found, dropped])

  const toggle = (word: string) =>
    setDropped((prev) => {
      const next = new Set(prev)
      if (next.has(word)) next.delete(word)
      else next.add(word)
      return next
    })

  const create = async () => {
    setBusy(true)
    setError('')
    try {
      const id = await createDeck(name.trim() || 'Shared text', source ?? 'shared text', keeping)
      onDone(id)
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : 'The deck could not be made.')
      setBusy(false)
    }
  }

  return (
    <div className="sheetpage">
      <header className="bar">
        <button className="icon" onClick={onCancel} aria-label="Back">
          ←
        </button>
        <div className="crumb">Text you shared</div>
      </header>

      <div className="library">
        {found === null ? (
          <p className="hint">Reading it…</p>
        ) : found.length === 0 ? (
          <>
            <h2 className="step">Nothing to make cards from</h2>
            <p className="sub">
              {text.trim().startsWith('http')
                ? 'That looks like a link rather than text. Open the page, select the part you want and share that instead - WordFlow reads what it is given and cannot fetch a page itself.'
                : 'None of the words here are ones WordFlow has a definition for. A list written as "word - meaning", one per line, always works.'}
            </p>
            <div className="row" style={{ marginTop: 16 }}>
              <button className="btn" onClick={onCancel}>
                Back
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="step">
              {kind === 'list' ? `${found.length} words read from your list` : `${found.length} words worth knowing`}
            </h2>
            <p className="sub">
              {kind === 'list'
                ? 'Tap any word to leave it out.'
                : 'Picked out of the passage and defined from your dictionaries. Tap any word to leave it out.'}
            </p>

            <div className="picked">
              {found.map((f) => (
                <button
                  key={f.word}
                  className={dropped.has(f.word) ? 'relative out' : 'relative'}
                  onClick={() => toggle(f.word)}
                  aria-pressed={!dropped.has(f.word)}
                  title={f.meaning}
                >
                  {f.word}
                </button>
              ))}
            </div>

            {undefined_ > 0 && (
              <p className="hint">
                {undefined_} other uncommon {undefined_ === 1 ? 'word was' : 'words were'} left out: WordFlow only makes a card
                for a word it can define, from your dictionaries or its built-in glossary.{' '}
                {kind === 'list' && 'Writing the meaning after a dash on the same line always works.'}
              </p>
            )}

            <div className="setting" style={{ marginTop: 18 }}>
              <div className="label">
                <b>Deck name</b>
              </div>
              <input className="text" value={name} onChange={(e) => setName(e.target.value)} aria-label="Deck name" />
            </div>

            {error && <p className="hint warn-note">{error}</p>}

            <div className="row" style={{ marginTop: 18 }}>
              <button className="btn primary" disabled={!keeping.length || busy} onClick={() => void create()}>
                {busy ? 'Making the deck…' : `Make a deck of ${keeping.length}`}
              </button>
              <button className="btn ghost" onClick={onCancel}>
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
