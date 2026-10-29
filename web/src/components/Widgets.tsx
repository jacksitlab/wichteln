import { useEffect, useState } from 'react'
import { useT, type Language } from '../i18n'

/** Language switch (DE | EN), fixed top-right. Persisted in sessionStorage. */
export function LanguageSwitch() {
  const { lang, setLang } = useT()
  const options: Language[] = ['de', 'en']
  return (
    <div style={{
      position: 'fixed', top: 12, right: 14, zIndex: 40,
      display: 'flex', gap: 4, alignItems: 'center',
      background: 'rgba(18, 32, 25, 0.85)',
      border: '1px solid var(--border)',
      borderRadius: 999,
      padding: 3,
      height: 34, boxSizing: 'border-box',
    }}>
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => setLang(opt)}
          style={{
            background: lang === opt ? 'var(--gold)' : 'transparent',
            color: lang === opt ? '#16281d' : 'var(--fg-muted)',
            border: 'none', borderRadius: 999,
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            padding: '3px 10px',
            textTransform: 'uppercase',
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

const URL_RE = /(https?:\/\/[^\s<>"']+)/g

/**
 * Rendert Wunsch-Text mit automatisch verlinkten URLs (neuer Tab).
 * Der Text wird über React-Textknoten escaped — kein dangerouslySetInnerHTML,
 * HTML-Injection ist ausgeschlossen.
 */
export function WishText({ text }: { text: string }) {
  const parts = text.split(URL_RE)
  return (
    <span>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer">
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </span>
  )
}

/** Copy button with feedback. Optionally reports when a copy succeeded. */
export function CopyButton({ text, onCopied }: { text: string; onCopied?: () => void }) {
  const [copied, setCopied] = useState(false)
  const { t } = useT()
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])
  return (
    <button
      className="btn"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
        } catch {
          // Fallback für ältere Browser
          const ta = document.createElement('textarea')
          ta.value = text
          document.body.appendChild(ta)
          ta.select()
          document.execCommand('copy')
          document.body.removeChild(ta)
        }
        setCopied(true)
        onCopied?.()
      }}
    >
      {copied ? t('copied') : t('copy')}
    </button>
  )
}

/** Zeigt einen Link mit Copy-Button an. */
export function LinkBox({ url, onCopied }: { url: string; onCopied?: () => void }) {
  return (
    <div className="linkbox">
      <a href={url} target="_blank" rel="noreferrer">{url}</a>
      <CopyButton text={url} onCopied={onCopied} />
    </div>
  )
}

/** Confirmation dialog (e.g. for the irreversible drawing). */
export function ConfirmDialog({
  title, text, confirmLabel, cancelLabel,
  onConfirm, onCancel, busy = false,
}: {
  title: string
  text: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  busy?: boolean
}) {
  const { t } = useT()
  return (
    <div className="dialog-backdrop" onClick={busy ? undefined : onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>{text}</p>
        <div className="row">
          <button className="btn ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel ?? t('cancel')}
          </button>
          <button className="btn" onClick={onConfirm} disabled={busy}>
            {busy ? '…' : (confirmLabel ?? t('save'))}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Toast-Nachricht unten. */
export function Toast({ message }: { message: string }) {
  return <div className="toast" role="status">{message}</div>
}
