import { useCallback, useEffect, useState } from 'react'
import { countStarred, createDeck, db, deleteDeck } from '../db'
import type { Deck, Settings } from '../types'
import type { Pack } from '../data/packs'
import { PACKS } from '../data/packs'
import ImportPanel from './ImportPanel'
import InstallBanner from './InstallBanner'
import SettingsSheet from './SettingsSheet'
import StartPicker from './StartPicker'

interface Props {
  settings: Settings
  onPatch: (patch: Partial<Settings>) => void
  onPlay: (deckId: number, startIdx: number, only?: 'starred') => void
  onPdf: (file: File) => void
}

type Row = Deck & { id: number; resumeIdx: number; starred: number }

export default function Library({ settings, onPatch, onPlay, onPdf }: Props) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [importing, setImporting] = useState(false)
  const [picking, setPicking] = useState<Row | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)

  const taken = new Set((rows ?? []).map((r) => r.source))
  const missingPacks = PACKS.filter((p) => !taken.has(p.source))

  const load = useCallback(async () => {
    const decks = await db.decks.toArray()
    const progress = await db.progress.toArray()
    const at = new Map(progress.map((p) => [p.deckId, p.idx]))
    const visible = decks
      .filter((d): d is Deck & { id: number } => d.id !== undefined)
      .sort((a, b) => b.createdAt - a.createdAt)
    const starCounts = await Promise.all(visible.map((d) => countStarred(d.id)))
    setRows(visible.map((d, i) => ({ ...d, resumeIdx: at.get(d.id) ?? 0, starred: starCounts[i] })))
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const [adding, setAdding] = useState<string | null>(null)

  const addPack = async (pack: Pack) => {
    setAdding(pack.id)
    try {
      // Loaded on demand: a dictionary should not be part of the first page
      // load on a phone, when most sessions are just resuming a deck.
      const entries = await pack.load()
      const id = await createDeck(pack.name, pack.source, entries, { sort: pack.sort })
      await load()
      onPlay(id, 0)
    } finally {
      setAdding(null)
    }
  }

  const remove = async (deckId: number) => {
    await deleteDeck(deckId)
    setConfirmDelete(null)
    await load()
  }

  return (
    <div className="library">
      <header className="masthead">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h1>WordFlow</h1>
            <p>One word at a time. A pause to remember it, then the meaning.</p>
          </div>
          <button className="icon" onClick={() => setShowSettings(true)} aria-label="Settings">
            ☰
          </button>
        </div>
      </header>

      {rows !== null && (rows.length > 0 || importing) && (
        <div className="section-head">
          <h2>Your decks</h2>
          {!importing && rows.length > 0 && (
            <button className="btn small" onClick={() => setImporting(true)}>
              Add words
            </button>
          )}
        </div>
      )}

      {rows === null ? (
        <p className="hint">Loading…</p>
      ) : rows.length === 0 && !importing ? (
        // Each dictionary is a full-width target rather than a paragraph with
        // buttons under it - this is the whole screen on a phone.
        <div className="choices">
          {PACKS.map((pack, i) => (
            <button
              key={pack.id}
              className={i === 0 ? 'choice primary' : 'choice'}
              disabled={adding !== null}
              onClick={() => void addPack(pack)}
            >
              <span className="choice-title">{pack.name}</span>
              <span className="choice-note">{pack.blurb}</span>
              <span className="choice-go">{adding === pack.id ? 'Adding…' : 'Begin →'}</span>
            </button>
          ))}
          <button className="choice" onClick={() => setImporting(true)}>
            <span className="choice-title">Use your own dictionary</span>
            <span className="choice-note">
              A PDF, CSV or word list from your phone. Scanned pages are read on the device, nothing is uploaded.
            </span>
            <span className="choice-go">Choose a file →</span>
          </button>
        </div>
      ) : (
        rows.map((d) => {
          const pct = d.entryCount ? (d.resumeIdx / d.entryCount) * 100 : 0
          return (
            <div className="deck" key={d.id}>
              <h3>{d.name}</h3>
              <div className="meta">
                {d.entryCount.toLocaleString()} words · {d.source}
                {d.resumeIdx > 0 && ` · at word ${d.resumeIdx + 1}`}
              </div>
              <div className="track">
                <i style={{ width: `${pct}%` }} />
              </div>
              <div className="actions">
                <button className="btn primary" onClick={() => onPlay(d.id, d.resumeIdx)}>
                  {d.resumeIdx > 0 ? 'Resume' : 'Start'}
                </button>
                <button className="btn" onClick={() => setPicking(d)}>
                  Start from…
                </button>
                {d.starred > 0 && (
                  <button className="btn" onClick={() => onPlay(d.id, 0, 'starred')}>
                    ★ {d.starred}
                  </button>
                )}
                <span style={{ flex: 1 }} />
                {confirmDelete === d.id ? (
                  <>
                    <span className="meta" style={{ margin: 0 }}>
                      Delete this deck?
                    </span>
                    <button className="btn small danger" onClick={() => void remove(d.id)}>
                      Yes, delete
                    </button>
                    <button className="btn small ghost" onClick={() => setConfirmDelete(null)}>
                      No
                    </button>
                  </>
                ) : (
                  <button className="btn small danger" onClick={() => setConfirmDelete(d.id)}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          )
        })
      )}

      {importing && (
        <>
          <div className="section-head">
            <h2>Import</h2>
          </div>
          <ImportPanel
            onPdf={onPdf}
            onCancel={() => setImporting(false)}
            onDone={(id) => {
              setImporting(false)
              void load().then(() => onPlay(id, 0))
            }}
          />
        </>
      )}

      {/* Dictionaries not yet taken. Keyed on the source rather than the name,
          so renaming a deck cannot make the app offer a second copy of it. */}
      {rows !== null && rows.length > 0 && !importing && missingPacks.length > 0 && (
        <>
          <div className="section-head">
            <h2>Dictionaries</h2>
          </div>
          <div className="choices">
            {missingPacks.map((pack) => (
              <button key={pack.id} className="choice" disabled={adding !== null} onClick={() => void addPack(pack)}>
                <span className="choice-title">{pack.name}</span>
                <span className="choice-note">{pack.blurb}</span>
                <span className="choice-go">{adding === pack.id ? 'Adding…' : 'Add →'}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {!importing && <InstallBanner />}

      {picking && (
        <StartPicker
          deck={picking}
          resumeIdx={picking.resumeIdx}
          onClose={() => setPicking(null)}
          onStart={(idx) => {
            const id = picking.id
            setPicking(null)
            onPlay(id, idx)
          }}
        />
      )}

      {showSettings && <SettingsSheet settings={settings} onPatch={onPatch} onClose={() => setShowSettings(false)} />}
    </div>
  )
}
