import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { postJoin } from '../api'
import { ApiError } from '../types'
import { LinkBox } from '../components/Widgets'
import { absUrl } from '../urls'

export default function JoinPage() {
  const { joinToken = '' } = useParams()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [joined, setJoined] = useState<Awaited<ReturnType<typeof postJoin>> | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      setJoined(await postJoin(joinToken, name.trim()))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Server nicht erreichbar.')
    } finally {
      setBusy(false)
    }
  }

  if (joined) {
    return (
      <div className="wrap">
        <header className="page">
          <h1 className="page-title">Willkommen, {joined.participant.name}!</h1>
          <p className="sub">Du bist dabei. Jetzt deinen Link sichern.</p>
        </header>

        <div className="warn">
          <b>Wichtig:</b> Dieser persönliche Link wird <b>nie wieder angezeigt</b> —
          es gibt keine Anmeldung, über die du ihn wiederfindest.
          Setze ein Lesezeichen oder kopiere ihn jetzt!
        </div>

        <div className="card">
          <h2 className="section-title">Dein persönlicher Link</h2>
          <LinkBox url={absUrl(joined.personalUrl)} />
        </div>

        <div className="card" style={{ textAlign: 'center' }}>
          <p className="muted" style={{ marginBottom: 12 }}>
            Über diesen Link trägst du deine Wünsche ein — und siehst nach der Auslosung, wen du beschenkst.
          </p>
          <Link to={`/p/${joined.personalToken}`} className="btn" style={{ textDecoration: 'none' }}>
            Wünsche eintragen
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="wrap">
      <header className="page">
        <div className="flakes">{'\u2744\u2744\u2744'}</div>
        <h1 className="page-title">Wichteln</h1>
        <p className="sub">Du wurdest zu einer Wichtelrunde eingeladen</p>
      </header>

      <div className="card">
        <h2 className="section-title">Dein Name</h2>
        <p className="muted" style={{ marginBottom: 6 }}>
          Unter diesem Namen sehen dich die anderen.
        </p>
        <form onSubmit={submit} className="add" style={{ marginTop: 12 }}>
          <input
            type="text" value={name} maxLength={60} required autoFocus
            placeholder="z.B. Michael"
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn" type="submit" disabled={busy || !name.trim()}>
            {busy ? '…' : 'Beitreten'}
          </button>
        </form>
        {error && <p className="warn">{error}</p>}
      </div>
    </div>
  )
}
