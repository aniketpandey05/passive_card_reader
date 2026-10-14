import { useEffect, useState } from 'react'
import type { Settings } from '../types'
import {
  calmRate,
  cancelSpeech,
  listVoices,
  onVoicesChanged,
  onlyLegacyVoices,
  speak,
  speechAvailable,
  voiceQuality,
} from '../lib/speech'
import { useEscape } from '../lib/useEscape'

interface Props {
  settings: Settings
  onPatch: (patch: Partial<Settings>) => void
  onClose: () => void
}

export default function SettingsSheet({ settings, onPatch, onClose }: Props) {
  const [voices, setVoices] = useState(listVoices())

  useEffect(() => {
    setVoices(listVoices())
    return onVoicesChanged(() => setVoices(listVoices()))
  }, [])

  useEscape(onClose)

  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Playback settings">
        <h2>Playback</h2>
        <p className="sub">Everything here applies straight away, mid-session.</p>

        <div className="setting">
          <div className="label">
            <b>Speed</b>
            <span className="val">{settings.speed.toFixed(1)}×</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={2.5}
            step={0.1}
            value={settings.speed}
            onChange={(e) => onPatch({ speed: Number(e.target.value) })}
          />
          <span className="note">Scales both timings below, and the voice, together.</span>
        </div>

        <div className="setting">
          <div className="label">
            <b>Pause before the meaning</b>
            <span className="val">{(settings.recallMs / 1000).toFixed(1)}s</span>
          </div>
          <input
            type="range"
            min={500}
            max={10000}
            step={250}
            value={settings.recallMs}
            onChange={(e) => onPatch({ recallMs: Number(e.target.value) })}
          />
          <span className="note">Your window to remember the word before it tells you.</span>
        </div>

        <div className="setting">
          <div className="label">
            <b>Reading speed</b>
            <span className="val">{settings.wpm} wpm</span>
          </div>
          <input
            type="range"
            min={70}
            max={280}
            step={10}
            value={settings.wpm}
            onChange={(e) => onPatch({ wpm: Number(e.target.value) })}
          />
          <span className="note">
            How long a meaning stays on screen is worked out from its length, so short and long definitions both get a
            fair amount of time. Lower is slower.
          </span>
        </div>

        <div className="setting">
          <div className="label">
            <label className="switch">
              <input type="checkbox" checked={settings.voice} onChange={(e) => onPatch({ voice: e.target.checked })} />
              <b>Voiceover</b>
            </label>
            {speechAvailable() && settings.voice && (
              <button
                className="btn small ghost"
                onClick={() => {
                  cancelSpeech()
                  void speak('ephemeral. Lasting a very short time.', {
                    rate: calmRate(settings.speed),
                    voiceURI: settings.voiceURI,
                  })
                }}
              >
                Try it
              </button>
            )}
          </div>
          {!speechAvailable() && <span className="note">This browser has no built-in speech.</span>}
          {speechAvailable() && settings.voice && (
            <>
              {/* A list rather than a dropdown, because which voice sounds
                  good is entirely device-dependent and only the listener can
                  judge it. Every row can be heard before it is chosen. */}
              <ul className="voices">
                {voices.map((v) => {
                  const chosen = (settings.voiceURI ?? voices[0]?.voiceURI) === v.voiceURI
                  const quality = voiceQuality(v)
                  return (
                    <li key={v.voiceURI} className={chosen ? 'chosen' : ''}>
                      <button className="voice-pick" onClick={() => onPatch({ voiceURI: v.voiceURI })}>
                        <span className="voice-name">{v.name.replace(/\s*\([^)]*\)\s*$/, '')}</span>
                        <span className="voice-tag">
                          {v.lang}
                          {quality === 'good' && ' · natural'}
                          {quality === 'legacy' && ' · older, robotic'}
                        </span>
                      </button>
                      <button
                        className="icon"
                        aria-label={`Hear ${v.name}`}
                        onClick={() => {
                          cancelSpeech()
                          void speak('taciturn. Saying little by nature.', {
                            rate: calmRate(settings.speed),
                            voiceURI: v.voiceURI,
                          })
                        }}
                      >
                        ▶
                      </button>
                    </li>
                  )
                })}
              </ul>
              {onlyLegacyVoices() && (
                <span className="note warn-note">
                  Every voice on this device is an older, robotic one, and no amount of tuning fixes that. Phones
                  generally have far better voices than desktops; on Windows, Settings → Time &amp; language → Speech →
                  Manage voices adds the natural ones.
                </span>
              )}
              <label className="switch" style={{ marginTop: 8 }}>
                <input
                  type="checkbox"
                  checked={settings.speakMeaning}
                  onChange={(e) => onPatch({ speakMeaning: e.target.checked })}
                />
                <span>Read the meaning aloud too</span>
              </label>
              <span className="note">
                Cards wait for the voice to finish, so they never get cut off. The voice keeps an unhurried pace even
                at high card speeds. On phones, speech stops when the screen locks.
              </span>
            </>
          )}
        </div>

        <div className="setting">
          <div className="label">
            <label className="switch">
              <input
                type="checkbox"
                checked={settings.showParts}
                onChange={(e) => onPatch({ showParts: e.target.checked })}
              />
              <b>Word parts</b>
            </label>
          </div>
          <span className="note">
            Shows the Latin or Greek pieces under the meaning, where they are known: prefix, root and suffix. Learning
            that <i>spect</i> is "look" gives you circumspect, introspective and retrospect at once.
          </span>
        </div>

        <div className="setting">
          <div className="label">
            <b>Order</b>
            <span className="segmented">
              <button aria-pressed={settings.order === 'alpha'} onClick={() => onPatch({ order: 'alpha' })}>
                A → Z
              </button>
              <button aria-pressed={settings.order === 'shuffle'} onClick={() => onPatch({ order: 'shuffle' })}>
                Shuffle
              </button>
            </span>
          </div>
        </div>

        <div className="setting">
          <div className="label">
            <b>Theme</b>
            <span className="segmented">
              <button aria-pressed={settings.theme === 'light'} onClick={() => onPatch({ theme: 'light' })}>
                Light
              </button>
              <button aria-pressed={settings.theme === 'dark'} onClick={() => onPatch({ theme: 'dark' })}>
                Dark
              </button>
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
          <button className="btn primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
