import { useEffect, useMemo, useState } from 'react'
import { createDeck } from '../db'
import type { Mapping } from '../lib/parse'
import { applyMapping, autoParse } from '../lib/parse'

interface Props {
  onDone: (deckId: number) => void
  onCancel: () => void
  /** PDFs go to their own flow: pages, columns and a review step. */
  onPdf: (file: File) => void
}

const FORMAT_LABEL: Record<string, string> = {
  json: 'JSON',
  table: 'table',
  lines: 'one entry per line',
  empty: '',
}

export default function ImportPanel({ onDone, onCancel, onPdf }: Props) {
  const [text, setText] = useState('')
  const [filename, setFilename] = useState('')
  const [deckName, setDeckName] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [busy, setBusy] = useState(false)

  const parsed = useMemo(() => autoParse(text, filename), [text, filename])
  const [mapping, setMapping] = useState<Mapping | null>(null)
  useEffect(() => setMapping(parsed.mapping), [parsed])

  const entries = useMemo(
    () => (parsed.table && mapping ? applyMapping(parsed.table, mapping) : parsed.entries),
    [parsed, mapping],
  )

  const width = parsed.table ? Math.max(...parsed.table.rows.map((r) => r.length)) : 0
  const columns = Array.from({ length: width }, (_, i) => i)
  const columnLabel = (i: number) => {
    const head = mapping?.hasHeader ? parsed.table?.rows[0]?.[i] : ''
    return head ? `${i + 1}. ${head}` : `Column ${i + 1}`
  }

  const takeFile = async (file: File) => {
    if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') {
      onPdf(file)
      return
    }
    const content = await file.text()
    setFilename(file.name)
    setText(content)
    setDeckName(file.name.replace(/\.[^.]+$/, ''))
  }

  const create = async () => {
    setBusy(true)
    try {
      const id = await createDeck(deckName.trim() || 'Untitled deck', filename || 'pasted text', entries)
      onDone(id)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="import">
      <div
        className={dragOver ? 'drop over' : 'drop'}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          const file = e.dataTransfer.files[0]
          if (file) void takeFile(file)
        }}
      >
        Drop a PDF, CSV, TSV, TXT or JSON file here, or{' '}
        <label>
          choose a file
          <input
            type="file"
            accept=".pdf,.csv,.tsv,.txt,.json,application/pdf,text/plain,text/csv,application/json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void takeFile(file)
            }}
          />
        </label>
      </div>

      <textarea
        className="paste"
        value={text}
        placeholder={'…or paste entries here, one per line:\n\nephemeral - lasting a very short time\nerudite: deeply learned'}
        onChange={(e) => {
          setText(e.target.value)
          setFilename('')
        }}
      />

      {parsed.format !== 'empty' && (
        <>
          <p className="warn" style={{ color: 'var(--muted)' }}>
            Read as {FORMAT_LABEL[parsed.format]} · <b>{entries.length}</b> entries found
          </p>
          {parsed.warnings.map((w) => (
            <p className="warn" key={w}>
              {w}
            </p>
          ))}
        </>
      )}

      {parsed.table && mapping && width >= 2 && (
        <div className="row">
          <label className="field">
            Word column
            <select value={mapping.word} onChange={(e) => setMapping({ ...mapping, word: Number(e.target.value) })}>
              {columns.map((i) => (
                <option key={i} value={i}>
                  {columnLabel(i)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Meaning column
            <select value={mapping.meaning} onChange={(e) => setMapping({ ...mapping, meaning: Number(e.target.value) })}>
              {columns.map((i) => (
                <option key={i} value={i}>
                  {columnLabel(i)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Part of speech
            <select
              value={mapping.pos ?? ''}
              onChange={(e) => setMapping({ ...mapping, pos: e.target.value === '' ? null : Number(e.target.value) })}
            >
              <option value="">None</option>
              {columns.map((i) => (
                <option key={i} value={i}>
                  {columnLabel(i)}
                </option>
              ))}
            </select>
          </label>
          <label className="switch" style={{ paddingBottom: 8 }}>
            <input
              type="checkbox"
              checked={mapping.hasHeader}
              onChange={(e) => setMapping({ ...mapping, hasHeader: e.target.checked })}
            />
            <span style={{ fontSize: 13.5 }}>First row is a header</span>
          </label>
        </div>
      )}

      {entries.length > 0 && (
        <table className="preview">
          <thead>
            <tr>
              <th>Word</th>
              <th>Part of speech</th>
              <th>Meaning</th>
            </tr>
          </thead>
          <tbody>
            {entries.slice(0, 6).map((e, i) => (
              <tr key={i}>
                <td className="w">{e.word}</td>
                <td className="p">{e.pos ?? '—'}</td>
                <td>{e.meaning.length > 90 ? e.meaning.slice(0, 90) + '…' : e.meaning}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="row">
        <label className="field" style={{ flex: '1 1 220px' }}>
          Deck name
          <input type="text" value={deckName} placeholder="My dictionary" onChange={(e) => setDeckName(e.target.value)} />
        </label>
        <button className="btn primary" disabled={!entries.length || busy} onClick={() => void create()}>
          {busy ? 'Adding…' : `Add ${entries.length || ''} words`}
        </button>
        <button className="btn ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}
