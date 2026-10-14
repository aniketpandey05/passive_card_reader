import { useEffect, useState } from 'react'

/**
 * Offers to install the app to the home screen.
 *
 * Android and desktop Chrome fire `beforeinstallprompt`, which can be saved and
 * replayed from a button. iOS fires nothing and has no API, so Safari users get
 * the one instruction that works there instead. Either way this only appears
 * when the app is running in a browser tab, never once installed.
 */

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED = 'wordflow:install-dismissed'

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari reports installation here rather than through display-mode.
    (navigator as { standalone?: boolean }).standalone === true
  )
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export default function InstallBanner() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null)
  const [showIosHint, setShowIosHint] = useState(false)
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(DISMISSED) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    if (isStandalone()) {
      setHidden(true)
      return
    }
    const onPrompt = (e: Event) => {
      e.preventDefault() // keep it for our own button
      setPrompt(e as InstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    // Safari never fires the event, so offer the manual route there.
    if (isIos()) setShowIosHint(true)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const dismiss = () => {
    setHidden(true)
    try {
      localStorage.setItem(DISMISSED, '1')
    } catch {
      // A browser with storage blocked just gets the banner again next time.
    }
  }

  if (hidden || (!prompt && !showIosHint)) return null

  return (
    <div className="install">
      <div>
        <b>Keep it on your phone</b>
        <p>
          {prompt
            ? 'Install it to the home screen: it opens full screen and works offline, with no connection needed to revise.'
            : 'Add it to your home screen from the share menu, and it opens full screen and works offline.'}
        </p>
      </div>
      <div className="install-actions">
        {prompt ? (
          <button
            className="btn primary small"
            onClick={() => {
              void prompt.prompt().then(() => prompt.userChoice.then(dismiss))
            }}
          >
            Install
          </button>
        ) : (
          <span className="meta" style={{ margin: 0 }}>
            Share → Add to Home Screen
          </span>
        )}
        <button className="btn ghost small" onClick={dismiss}>
          Not now
        </button>
      </div>
    </div>
  )
}
