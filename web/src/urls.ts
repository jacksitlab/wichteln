/**
 * Der Backend liefert absolute URLs (AdminUrl, joinUrl, personalUrl), die er aus
 * seiner eigenen Basis baut — hinter einem Reverse-Proxy/Dev-Proxy ist das der
 * falsche Origin. Wir normalisieren deshalb: nur der Pfad aus der Backend-URL,
 * Origin immer der des Frontends.
 */
export function absUrl(backendUrl: string): string {
  try {
    const u = new URL(backendUrl)
    return window.location.origin + u.pathname
  } catch {
    return backendUrl
  }
}
