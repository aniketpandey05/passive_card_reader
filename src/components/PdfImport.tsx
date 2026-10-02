import { useCallback, useEffect, useRef, useState } from 'react'
import { createDeck } from '../db'
import type { Line } from '../lib/layout'
import { pageLines, stripRunningHeads } from '../lib/layout'
import type { OpenedPdf } from '../lib/pdf'
import { extractPage, openPdf, renderPage } from '../lib/pdf'
import { TEXT_LAYER_MIN_WORDS } from '../lib/pdfsource'
import { ocrPage, terminateOcr } from '../lib/ocr'
import type { Assembly, DraftEntry, Strategy } from '../lib/dict'
import { FLAG_LABEL, STRATEGY_LABEL, assemble } from '../lib/dict'

interface Props {
  file: File
  onDone: (deckId: number) => void
  onCancel: () => void
}

type Stage = 'opening' | 'options' | 'scanning' | 'review'

interface Probe {
  pages: number
  sampled: number
  withText: number
}

const MAX_SUGGESTED = 40

export default function PdfImport({ file, onDone, onCancel }: Props) {
  const [stage, setStage] = useState<Stage>('opening')
  const [error, setError] = useState('')
  const [probe, setProbe] = useState<Probe | null>(null)
  const [from, setFrom] = useState(1)
  const [to, setTo] = useState(1)
  const [columns, setColumns] = useState<'auto' | 1 | 2 | 3>('auto')
  const [maxSenses, setMaxSenses] = useState(3)
  const [useOcr, setUseOcr] = useState(false)
  const [progress, setProgress] = useState({ page: 0, done: 0, total: 0, phase: '' })
  const [lines, setLines] = useState<Line[]>([])
  const [assembly, setAssembly] = useState<Assembly | null>(null)
  const [entries, setEntries] = useState<DraftEntry[]>([])
  const [override, setOverride] = useState<Strategy | ''>('')
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  const [deckName, setDeckName] = useState(file.name.replace(/\.pdf$/i, ''))
  const [busy, setBusy] = useState(false)

  const docRef = useRef<OpenedPdf | null>(null)
  const openedRef = useRef<File | null>(null)
  const cancelRef = useRef(false)

  useEffect(() => {
    // Open each file exactly once. Two getDocument calls racing each other
    // deadlock pdf.js, and StrictMode runs effects twice in development.
    if (openedRef.current === file) return
    openedRef.current = file

    void (async () => {
      try {
        const opened = await openPdf(await file.arrayBuffer())
        docRef.current = opened
        const doc = opened.doc

        // Sample a handful of pages rather than all of them: a 1,200-page
        // dictionary shouldn't have to be read twice just to be described.
        const sample: number[] = []
        const step = Math.max(1, Math.floor(doc.numPages / 6))
        for (let n = 1; n <= doc.numPages && sample.length < 6; n += step) sample.push(n)
        let withText = 0
        for (const n of sample) {
          const page = await extractPage(doc, n)
          if (page.words.length >= TEXT_LAYER_MIN_WORDS) withText++
        }
        setProbe({ pages: doc.numPages, sampled: sample.length, withText })
        setUseOcr(withText < sample.length)
        setFrom(1)
        setTo(Math.min(doc.numPages, MAX_SUGGESTED))
        setStage('options')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'That file could not be opened as a PDF.')
      }
    })()
    // No cancellation flag here on purpose: the guard above means this runs
    // once, and cancelling on StrictMode's simulated unmount would abandon the
    // only pass. The document is closed by the unmount effect below.
  }, [file])

  useEffect(() => {
    return () => {
      void terminateOcr()
      void docRef.current?.close()
    }
  }, [])

  const scan = useCallback(async () => {
    const doc = docRef.current?.doc
    if (!doc) return
    cancelRef.current = false
    setStage('scanning')
    const total = to - from + 1
    const collected: { page: Awaited<ReturnType<typeof extractPage>>; lines: Line[] }[] = []

    for (let n = from; n <= to; n++) {
      if (cancelRef.current) break
      setProgress({ page: n, done: n - from, total, phase: 'Reading' })
      // Let React paint the progress before the next page blocks the thread.
      await new Promise((r) => setTimeout(r, 0))

      try {
        let words = await extractPage(doc, n)
        if (words.words.length < TEXT_LAYER_MIN_WORDS && useOcr) {
          setProgress({ page: n, done: n - from, total, phase: 'Reading the image' })
          const { canvas, scale } = await renderPage(doc, n)
          words = await ocrPage(canvas, scale, n, {
            onStatus: (status, pct) =>
              setProgress({
                page: n,
                done: n - from + pct,
                total,
                phase: status === 'recognizing text' ? 'Recognising text' : status,
              }),
          })
        }
        collected.push({ page: words, lines: pageLines(words, columns === 'auto' ? undefined : columns).lines })
      } catch (e) {
        // One bad page shouldn't lose the pages that worked.
        setError(`Page ${n} could not be read (${e instanceof Error ? e.message : 'unknown error'}), so it was skipped.`)
      }
    }

    const kept = stripRunningHeads(collected)
    const result = assemble(kept, { maxSenses })
    setLines(kept)
    setAssembly(result)
    setEntries(result.entries)
    setOverride('')
    setStage('review')
  }, [from, to, columns, maxSenses, useOcr])

  const reassemble = useCallback(
    (strategy: Strategy | '', senses: number) => {
      if (!lines.length) return
      const result = assemble(lines, { strategy: strategy || undefined, maxSenses: senses })
      setAssembly(result)
      setEntries(result.entries)
    },
    [lines],
  )

  const create = async () => {
    setBusy(true)
    try {
      const id = await createDeck(
        deckName.trim() || 'Imported dictionary',
        file.name,
        entries.map((e) => ({ word: e.word, pos: e.pos, meaning: e.meaning })),
      )
      onDone(id)
    } finally {
      setBusy(false)
    }
  }

  const downloadCsv = () => {
    const escape = (s: string) => (/[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s)
    const csv = ['word,pos,meaning', ...entries.map((e) => [e.word, e.pos ?? '', e.meaning].map(escape).join(','))].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = (deckName.trim() || 'entries') + '.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const shown = flaggedOnly ? entries.filter((e) => e.flags.length) : entries

  return (
    <div className="sheetpage">
      <header className="bar">
        <button className="icon" onClick={onCancel} aria-label="Cancel import">
          ←
        </button>
        <div className="crumb">{file.name}</div>
        <span style={{ width: 40 }} />
      </header>

      <div className="library" style={{ paddingTop: 0 }}>
        {error && <p className="warn">{error}</p>}

        {stage === 'opening' && <p className="hint">Opening the PDF…</p>}

        {stage === 'options' && probe && (
          <section className="import">
            <h2 className="step">1 — What to read</h2>
            <p className="meta">
              {probe.pages.toLocaleString()} page{probe.pages === 1 ? '' : 's'}.{' '}
              {probe.withText === probe.sampled
                ? 'All sampled pages have a text layer, so this will be quick and exact.'
                : probe.withText === 0
                  ? 'No text layer found — these pages are images, so they need to be recognised. That is slower, a few seconds a page.'
                  : `${probe.withText} of ${probe.sampled} sampled pages have a text layer. Pages without one will be recognised as images.`}
            </p>

            <div className="row">
              <label className="field" style={{ maxWidth: 110 }}>
                First page
                <input
                  type="number"
                  min={1}
                  max={probe.pages}
                  value={from}
                  onChange={(e) => setFrom(Math.min(Math.max(1, Number(e.target.value)), probe.pages))}
                />
              </label>
              <label className="field" style={{ maxWidth: 110 }}>
                Last page
                <input
                  type="number"
                  min={from}
                  max={probe.pages}
                  value={to}
                  onChange={(e) => setTo(Math.min(Math.max(from, Number(e.target.value)), probe.pages))}
                />
              </label>
              <label className="field" style={{ maxWidth: 150 }}>
                Columns
                <select value={String(columns)} onChange={(e) => setColumns(e.target.value === 'auto' ? 'auto' : (Number(e.target.value) as 1 | 2 | 3))}>
                  <option value="auto">Detect</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                </select>
              </label>
              <label className="field" style={{ maxWidth: 150 }}>
                Senses per word
                <select value={maxSenses} onChange={(e) => setMaxSenses(Number(e.target.value))}>
                  <option value={1}>Just the first</option>
                  <option value={2}>First two</option>
                  <option value={3}>First three</option>
                  <option value={0}>Keep all</option>
                </select>
              </label>
            </div>

            {probe.withText < probe.sampled && (
              <label className="switch" style={{ marginTop: 14 }}>
                <input type="checkbox" checked={useOcr} onChange={(e) => setUseOcr(e.target.checked)} />
                <span>Recognise pages that have no text layer (slower, stays on this device)</span>
              </label>
            )}

            {to - from + 1 > MAX_SUGGESTED && (
              <p className="warn">
                That is {to - from + 1} pages in one go. A smaller range finishes sooner, and you can import the next
                range afterwards.
              </p>
            )}

            <div className="row">
              <button className="btn primary" onClick={() => void scan()}>
                Read {to - from + 1} page{to - from === 0 ? '' : 's'}
              </button>
              <button className="btn ghost" onClick={onCancel}>
                Cancel
              </button>
            </div>
          </section>
        )}

        {stage === 'scanning' && (
          <section className="import">
            <h2 className="step">2 — Reading</h2>
            <p className="meta">
              {progress.phase} page {progress.page} of {from + progress.total - 1}
            </p>
            <div className="track">
              <i style={{ width: `${Math.min(100, (progress.done / Math.max(progress.total, 1)) * 100)}%` }} />
            </div>
            <button
              className="btn ghost"
              style={{ marginTop: 14 }}
              onClick={() => {
                cancelRef.current = true
              }}
            >
              Stop and use what has been read
            </button>
          </section>
        )}

        {stage === 'review' && assembly && (
          <section className="import">
            <h2 className="step">3 — Check what came out</h2>
            <p className="meta">
              <b>{entries.length}</b> entries from {assembly.stats.pages} page
              {assembly.stats.pages === 1 ? '' : 's'}
              {assembly.stats.flagged > 0 && <> · {assembly.stats.flagged} worth a look</>}
            </p>

            <div className="row" style={{ marginTop: 10 }}>
              <label className="field" style={{ maxWidth: 260 }}>
                Entries detected by
                <select
                  value={override || assembly.strategy}
                  onChange={(e) => {
                    const next = e.target.value as Strategy
                    setOverride(next)
                    reassemble(next, maxSenses)
                  }}
                >
                  {(Object.keys(STRATEGY_LABEL) as Strategy[]).map((s) => (
                    <option key={s} value={s}>
                      {STRATEGY_LABEL[s]}
                      {s === assembly.strategy ? ' (detected)' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field" style={{ maxWidth: 170 }}>
                Senses per word
                <select
                  value={maxSenses}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    setMaxSenses(n)
                    reassemble(override, n)
                  }}
                >
                  <option value={1}>Just the first</option>
                  <option value={2}>First two</option>
                  <option value={3}>First three</option>
                  <option value={0}>Keep all</option>
                </select>
              </label>
              {assembly.stats.flagged > 0 && (
                <label className="switch" style={{ paddingBottom: 8 }}>
                  <input type="checkbox" checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)} />
                  <span style={{ fontSize: 13.5 }}>Only show the {assembly.stats.flagged} flagged</span>
                </label>
              )}
            </div>

            <ul className="drafts">
              {shown.slice(0, 300).map((entry) => {
                const index = entries.indexOf(entry)
                const open = editing === index
                return (
                  <li key={index} className={entry.flags.length ? 'flagged' : ''}>
                    {open ? (
                      <div className="editrow">
                        <input
                          type="text"
                          value={entry.word}
                          onChange={(e) =>
                            setEntries((all) => all.map((x, i) => (i === index ? { ...x, word: e.target.value } : x)))
                          }
                        />
                        <textarea
                          value={entry.meaning}
                          rows={3}
                          onChange={(e) =>
                            setEntries((all) => all.map((x, i) => (i === index ? { ...x, meaning: e.target.value } : x)))
                          }
                        />
                        <button className="btn small" onClick={() => setEditing(null)}>
                          Done
                        </button>
                      </div>
                    ) : (
                      <button className="draftrow" onClick={() => setEditing(index)}>
                        <span className="w">{entry.word}</span>
                        {entry.pos && <span className="p">{entry.pos}</span>}
                        <span className="m">{entry.meaning}</span>
                        {entry.flags.map((f) => (
                          <span className="chip" key={f}>
                            {FLAG_LABEL[f]}
                          </span>
                        ))}
                      </button>
                    )}
                    <button
                      className="icon drop"
                      aria-label={`Remove ${entry.word}`}
                      onClick={() => setEntries((all) => all.filter((_, i) => i !== index))}
                    >
                      ✕
                    </button>
                  </li>
                )
              })}
            </ul>
            {shown.length > 300 && <p className="hint">Showing the first 300 of {shown.length}.</p>}

            <div className="row">
              <label className="field" style={{ flex: '1 1 200px' }}>
                Deck name
                <input type="text" value={deckName} onChange={(e) => setDeckName(e.target.value)} />
              </label>
              <button className="btn primary" disabled={!entries.length || busy} onClick={() => void create()}>
                {busy ? 'Adding…' : `Add ${entries.length} words`}
              </button>
              <button className="btn" onClick={downloadCsv} disabled={!entries.length}>
                Download CSV
              </button>
              <button className="btn ghost" onClick={() => setStage('options')}>
                Back
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
