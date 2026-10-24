import { useEffect, useState } from 'react'

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

/** Kopieren-Button mit "Kopiert!"-Feedback. */
export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(t)
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
      }}
    >
      {copied ? 'Kopiert!' : 'Kopieren'}
    </button>
  )
}

/** Zeigt einen Link mit Copy-Button an. */
export function LinkBox({ url }: { url: string }) {
  return (
    <div className="linkbox">
      <a href={url} target="_blank" rel="noreferrer">{url}</a>
      <CopyButton text={url} />
    </div>
  )
}

/** Bestätigungs-Dialog (z.B. für die unwiderrufliche Auslosung). */
export function ConfirmDialog({
  title, text, confirmLabel = 'Bestätigen', cancelLabel = 'Abbrechen',
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
  return (
    <div className="dialog-backdrop" onClick={busy ? undefined : onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>{text}</p>
        <div className="row">
          <button className="btn ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button className="btn" onClick={onConfirm} disabled={busy}>
            {busy ? 'Bitte warten …' : confirmLabel}
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
