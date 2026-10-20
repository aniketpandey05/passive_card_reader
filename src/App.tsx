import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import { getSettings, saveSettings } from './db'
import type { Settings } from './types'
import Fault from './components/Fault'
import Library from './components/Library'
import Player from './components/Player'

// pdf.js and Tesseract are most of this app's weight, and most sessions are
// just revising. They load the first time someone opens a PDF, not before.
const PdfImport = lazy(() => import('./components/PdfImport'))

type View =
  | { name: 'library' }
  | { name: 'player'; deckId: number; startIdx: number; only?: 'starred' }
  | { name: 'pdf'; file: File }

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [noStorage, setNoStorage] = useState(false)
  const [view, setView] = useState<View>({ name: 'library' })

  useEffect(() => {
    getSettings().then(setSettings, (e: unknown) => {
      console.error('Storage is unavailable:', e)
      setNoStorage(true)
    })
  }, [])

  useEffect(() => {
    if (!settings) return
    // No attribute for "system": the stylesheet's prefers-color-scheme block
    // then decides, and follows the device if it changes while open.
    if (settings.theme === 'system') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = settings.theme
  }, [settings])

  const patch = useCallback(async (p: Partial<Settings>) => {
    setSettings(await saveSettings(p))
  }, [])

  // A private window, or site data switched off, makes IndexedDB throw the
  // moment it is opened. Everything this app holds lives there, so the honest
  // thing is to say so rather than sit on "Loading" for ever.
  if (noStorage) {
    return (
      <Fault title="This browser will not let WordFlow save anything">
        Your dictionaries, stars and progress are kept on the device, so WordFlow needs browser storage to work at
        all. Private and incognito windows usually block it, as does switching off site data for this page. Opening
        it in an ordinary window is normally all it takes.
      </Fault>
    )
  }

  if (!settings) return <div className="boot">Loading…</div>

  if (view.name === 'player') {
    return (
      <Player
        deckId={view.deckId}
        startIdx={view.startIdx}
        only={view.only}
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
      onPlay={(deckId, startIdx, only) => setView({ name: 'player', deckId, startIdx, only })}
      onPdf={(file) => setView({ name: 'pdf', file })}
    />
  )
}
