import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import { getSettings, saveSettings } from './db'
import type { Settings } from './types'
import Library from './components/Library'
import Player from './components/Player'

// pdf.js and Tesseract are most of this app's weight, and most sessions are
// just revising. They load the first time someone opens a PDF, not before.
const PdfImport = lazy(() => import('./components/PdfImport'))

type View =
  | { name: 'library' }
  | { name: 'player'; deckId: number; startIdx: number }
  | { name: 'pdf'; file: File }

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [view, setView] = useState<View>({ name: 'library' })

  useEffect(() => {
    void getSettings().then(setSettings)
  }, [])

  useEffect(() => {
    if (settings) document.documentElement.dataset.theme = settings.theme
  }, [settings])

  const patch = useCallback(async (p: Partial<Settings>) => {
    setSettings(await saveSettings(p))
  }, [])

  if (!settings) return <div className="boot">Loading…</div>

  if (view.name === 'player') {
    return (
      <Player
        deckId={view.deckId}
        startIdx={view.startIdx}
        settings={settings}
        onPatch={patch}
        onExit={() => setView({ name: 'library' })}
      />
    )
  }

  if (view.name === 'pdf') {
    return (
      <Suspense fallback={<div className="boot">Loading the PDF reader…</div>}>
        <PdfImport
          file={view.file}
          onCancel={() => setView({ name: 'library' })}
          onDone={(deckId) => setView({ name: 'player', deckId, startIdx: 0 })}
        />
      </Suspense>
    )
  }

  return (
    <Library
      settings={settings}
      onPatch={patch}
      onPlay={(deckId, startIdx) => setView({ name: 'player', deckId, startIdx })}
      onPdf={(file) => setView({ name: 'pdf', file })}
    />
  )
}
