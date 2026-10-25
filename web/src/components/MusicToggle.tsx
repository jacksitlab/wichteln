import { useEffect, useRef, useState } from 'react'
import jingleUrl from '../assets/jingle.mp3'

/**
 * Hintergrundmusik (Endlos-Loop), Pill-Schalter oben links.
 *
 * Autostart: Die Musik startet beim Laden sofort STUMM (Muted-Autoplay ist
 * erlaubt) und wird bei der ersten Interaktion automatisch mit Ton
 * aktiviert (unmute + play in einem Schritt, damit ein einziger Klick
 * genügt). Wurde die Musik einmal stumm geschaltet, merkt sich das der
 * sessionStorage und beim Neuladen wird nicht mehr automatisch gestartet.
 * Die Komponente hängt außerhalb des Routers und läuft über Seitenwechsel
 * hinweg weiter.
 */
const STORAGE_KEY = 'wichtel.musicOff'

export function MusicToggle() {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [fading, setFading] = useState(false)
  const autoStarted = useRef(false)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = 0.5
    // "playing" bedeutet HÖRBAR: läuft UND nicht stumm. Muted-Autoplay
    // (läuft sofort nach dem Laden stumm) zeigt den Button daher korrekt
    // als "aus"; erst mit Ton kippt er auf "an".
    const sync = () => setPlaying(!audio.paused && !audio.muted)
    const onPlay = () => sync()
    const onPause = () => sync()
    const onVolume = () => sync()
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('volumechange', onVolume)
    return () => {
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('volumechange', onVolume)
    }
  }, [])

  // Autostart beim ersten Laden — sofern nicht stumm geschaltet wurde.
  const activateCleanupRef = useRef<() => void>(() => {})

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || autoStarted.current) return
    if (sessionStorage.getItem(STORAGE_KEY) === '1') return
    autoStarted.current = true

    const targetVolume = 0.5
    audio.muted = true
    audio.play().catch(() => { /* Muted-Autoplay blockiert -> Aktivierungs-Listener */ })

    const activate = (e: Event) => {
      // Klicks auf den Musik-Button selbst ignorieren: dessen toggle()
      // übernimmt die Umschaltung, sonst feuern beide Handler und die
      // Musik springt sofort wieder aus (bes. mobil: pointerdown + click).
      if (e.target instanceof Element && e.target.closest('.music-toggle')) return
      audio.muted = false
      audio.play().then(() => {
        fade(audio, 0, targetVolume, 800)
        activateCleanupRef.current()
      }).catch(() => {
        audio.muted = true // immer noch blockiert -> beim nächsten Klick erneut
      })
    }
    // iOS/Safari zählt nur touchend/click als Nutzer-Geste für play();
    // pointerdown/keydown decken Desktop-Browser ab. Scrollen (scroll,
    // wheel, touchmove) ist keine garantierte Geste — der Versuch kostet
    // aber nichts und greift, wo der Browser es zulässt.
    const events = ['pointerdown', 'touchend', 'click', 'keydown',
                    'scroll', 'wheel', 'touchmove']
    for (const ev of events) document.addEventListener(ev, activate, { passive: true })
    activateCleanupRef.current = () => {
      for (const ev of events) document.removeEventListener(ev, activate)
    }
    return activateCleanupRef.current
  }, [])

  async function toggle() {
    const audio = audioRef.current
    if (!audio) return
    activateCleanupRef.current() // Button-Klick ist auch pointerdown -> Autostart-Listener entfernen
    setFading(true)
    try {
      if (playing) {
        // sanft ausblenden, dann pausieren; Stummschaltung merken
        await fade(audio, audio.volume, 0, 400)
        audio.pause()
        audio.muted = false // Muted-Flag zurücksetzen
        sessionStorage.setItem(STORAGE_KEY, '1')
      } else {
        sessionStorage.removeItem(STORAGE_KEY) // "wieder an" ebenfalls merken
        audio.muted = false
        audio.volume = 0.5
        await audio.play()
      }
    } catch {
      // Autoplay-Politik o.ä. — Zustand bleibt unverändert
    } finally {
      setFading(false)
    }
  }

  return (
    <>
      <audio ref={audioRef} src={jingleUrl} loop preload="auto" />
      <button
        type="button"
        className={`music-toggle ${playing ? 'on' : ''}`}
        onClick={toggle}
        disabled={fading}
        title={playing ? 'Musik aus' : 'Musik an'}
        aria-pressed={playing}
        aria-label={playing ? 'Musik ausschalten' : 'Musik einschalten'}
      >
        {playing ? (
          // Lautsprecher mit Schallwellen
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M3 9v6h4l5 4V5L7 9H3z" fill="currentColor" />
            <path d="M16 8.5a5 5 0 0 1 0 7" stroke="currentColor" strokeWidth="1.8"
                  fill="none" strokeLinecap="round" />
            <path d="M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" strokeWidth="1.8"
                  fill="none" strokeLinecap="round" />
          </svg>
        ) : (
          // Lautsprecher mit X (stumm)
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M3 9v6h4l5 4V5L7 9H3z" fill="currentColor" />
            <path d="M16 9l6 6M22 9l-6 6" stroke="currentColor" strokeWidth="1.8"
                  strokeLinecap="round" />
          </svg>
        )}
      </button>
      <style>{`
        .music-toggle {
          position: fixed; top: 16px; left: 16px;
          z-index: 50; display: flex; align-items: center; justify-content: center;
          width: 44px; height: 34px;
          padding: 0; box-sizing: border-box;
          background: rgba(18, 32, 25, 0.85);
          color: var(--fg, #ede4d3);
          border: 1px solid var(--border, #2c4a38);
          /* halbe Höhe -> Ecken als Viertelkreis, wie der Sprachumschalter-Pill */
          border-radius: 17px;
          cursor: pointer;
          opacity: 0.85; transition: opacity 0.2s, border-color 0.2s, color 0.2s;
        }
        .music-toggle:hover { opacity: 1; }
        .music-toggle.on {
          color: var(--gold, #c8a24a);
          border-color: var(--gold, #c8a24a);
        }
        .music-toggle svg { display: block; }
      `}</style>
    </>
  )
}

/** Lautstärke-Übergang (Promise). */
function fade(audio: HTMLAudioElement, from: number, to: number, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const steps = 20
    let i = 0
    const timer = setInterval(() => {
      i++
      audio.volume = Math.max(0, Math.min(1, from + (to - from) * (i / steps)))
      if (i >= steps) {
        clearInterval(timer)
        audio.volume = to
        resolve()
      }
    }, ms / steps)
  })
}
