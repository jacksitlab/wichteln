import { useEffect, useState } from 'react'
import { useT } from '../i18n'

/**
 * Info-Button unten mittig: öffnet ein Popup mit Datenschutz-Hinweis und
 * GitHub-Link (ehemaliger Footer-Inhalt). Schließbar via Button, Klick auf
 * den Hintergrund oder ESC. Zweisprachig via useT.
 */
export function Footer() {
  const { t } = useT()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      {/* Info-Button, oben links neben dem Sound-Button */}
      <button
        type="button"
        className="info-button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t('info_button_label')}
        title={t('info_button_label')}
      >
        i
      </button>

      {/* Popup */}
      {open && (
        <div
          className="info-overlay"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            className="info-popup"
            role="dialog"
            aria-modal="true"
            aria-label={t('info_dialog_title')}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="section-title">{t('info_dialog_title')}</h2>
            <p style={{ fontSize: 14, lineHeight: 1.7 }}>{t('footer_privacy')}</p>
            <p style={{ marginTop: 12 }}>
              <a
                href="https://github.com/jacksitlab/wichtel"
                target="_blank"
                rel="noopener noreferrer"
              >
                {'\u2726'} {t('footer_code')}
              </a>
            </p>
            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <button className="btn ghost" onClick={() => setOpen(false)}>
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .info-button {
          position: fixed; top: 16px; left: 68px;
          z-index: 45;
          width: 34px; height: 34px;
          padding: 0;
          display: flex; align-items: center; justify-content: center;
          background: rgba(18, 32, 25, 0.85);
          color: var(--fg-muted);
          border: 1px solid var(--border);
          border-radius: 17px;
          font-size: 16px; font-style: italic; font-weight: 600;
          font-family: Georgia, serif;
          cursor: pointer;
          opacity: 0.8;
          transition: opacity 0.2s, border-color 0.2s, color 0.2s;
        }
        .info-button:hover {
          opacity: 1;
          color: var(--gold);
          border-color: var(--gold);
        }
        .info-overlay {
          position: fixed; inset: 0;
          z-index: 60;
          background: rgba(10, 18, 14, 0.7);
          display: flex; align-items: center; justify-content: center;
          padding: 20px;
        }
        .info-popup {
          background: var(--card-solid, #1b3124);
          border: 1px solid var(--border);
          border-radius: 14px;
          max-width: 440px; width: 100%;
          padding: 24px 26px;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
          position: relative; z-index: 1;
        }
        .info-popup a {
          color: var(--gold); text-decoration: none;
          border-bottom: 1px dotted var(--gold);
        }
        .info-popup a:hover { opacity: 0.8; }
      `}</style>
    </>
  )
}
