import { useState } from 'react'
import { exportBackup, importBackup } from '../db'

/**
 * Backup and restore.
 *
 * Decks, progress and settings live in this browser's storage and nowhere
 * else. Clearing site data, switching browser or losing the phone takes all of
 * it, including a dictionary that took an hour of recognition to import.
 */
export default function YourData({ onRestored }: { onRestored: () => void }) {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const save = async () => {
    setBusy(true)
    setError('')
    try {
      const backup = await exportBackup()
      const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `wordflow-${backup.exportedAt.slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(url)
      const words = backup.decks.reduce((n, d) => n + d.entries.length, 0)
      setNote(`Saved ${backup.decks.length} deck${backup.decks.length === 1 ? '' : 's'}, ${words.toLocaleString()} words.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The backup could not be made.')
    } finally {
      setBusy(false)
    }
  }

  const restore = async (file: File) => {
    setBusy(true)
    setError('')
    setNote('')
    try {
      const result = await importBackup(JSON.parse(await file.text()))
      setNote(`Restored ${result.decks} deck${result.decks === 1 ? '' : 's'}, ${result.words.toLocaleString()} words.`)
      onRestored()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That file could not be read.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="setting">
      <div className="label">
        <b>Your decks and progress</b>
      </div>
      <span className="note">
        Everything is kept on this device and nowhere else. A backup is one file: keep it somewhere safe and nothing
        is lost if this browser is cleared or the phone replaced.
      </span>
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn" disabled={busy} onClick={() => void save()}>
          Save a backup
        </button>
        <label className="btn" style={{ cursor: 'pointer' }}>
          Restore from a file
          <input
            type="file"
            accept=".json,application/json"
            hidden
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void restore(file)
              e.target.value = ''
            }}
          />
        </label>
      </div>
      {note && <span className="note">{note}</span>}
      {error && <span className="note warn-note">{error}</span>}
    </div>
  )
}
