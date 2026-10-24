import { useState } from 'react'
import { Link } from 'react-router-dom'
import { postGroup } from '../api'
import { ApiError } from '../types'
import { LinkBox } from '../components/Widgets'
import { absUrl } from '../urls'

export default function CreatePage() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [drawDate, setDrawDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<Awaited<ReturnType<typeof postGroup>> | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const resp = await postGroup({
        title,
        description: description.trim() || undefined,
        drawDate: drawDate || undefined,
      })
      setCreated(resp)
      // Admin-Token in die URL legen, damit der Admin die Seite neu laden kann
      window.history.replaceState(null, '', `/g/${resp.adminToken}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Server nicht erreichbar.')
    } finally {
      setBusy(false)
    }
  }

  if (created) {
    return (
      <div className="wrap">
        <header className="page">
          <h1 className="page-title">Fast fertig!</h1>
          <p className="sub">Speichere jetzt deine beiden Links</p>
        </header>

        <div className="warn">
          <b>Wichtig:</b> Der Admin-Link wird <b>nie wieder angezeigt</b>.
          Setze ein Lesezeichen, bevor du die Seite verlässt!
        </div>

        <div className="card">
          <h2 className="section-title">Dein Admin-Link</h2>
          <p className="muted">Nur für dich — damit verwaltest du die Runde.</p>
          <LinkBox url={absUrl(created.adminUrl)} />
        </div>

        <div className="card">
          <h2 className="section-title">Beitritts-Link für die Familie</h2>
          <p className="muted">Diesen Link teile mit allen, die mitwichteln wollen.</p>
          <LinkBox url={absUrl(created.joinUrl)} />
        </div>

        <div className="card" style={{ textAlign: 'center' }}>
          <p className="muted" style={{ marginBottom: 12 }}>
            Alles gespeichert? Dann weiter zur Admin-Ansicht.
          </p>
          <Link to={`/g/${created.adminToken}`} className="btn" style={{ textDecoration: 'none' }}>
            Zur Admin-Ansicht
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="wrap">
      <header className="page">
        <div className="flakes">{'\u2744\u2744\u2744'}</div>
        <h1 className="page-title">Neue Wichtelrunde</h1>
        <p className="sub">Du bist automatisch Admin der Runde</p>
      </header>

      <div className="card">
        <form onSubmit={submit}>
          <label className="field">
            Titel *
            <input
              type="text" value={title} maxLength={100} required
              placeholder="z.B. Weihnachten 2026"
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="field">
            Beschreibung
            <textarea
              value={description} maxLength={2000}
              placeholder="z.B. Budget 30 Euro. Ausgelost wird am 20. Dezember."
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="field">
            Auslosungsdatum
            <input type="date" value={drawDate} onChange={(e) => setDrawDate(e.target.value)} />
          </label>
          {error && <p className="warn">{error}</p>}
          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <button className="btn" type="submit" disabled={busy || !title.trim()}>
              {busy ? 'Wird erstellt …' : 'Wichtelrunde erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
