import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { addWish, deleteWish, getAssignee, getMe, leaveGroup } from '../api'
import type { Assignee, MeResponse } from '../types'
import { ApiError } from '../types'
import { ConfirmDialog, Toast, WishText } from '../components/Widgets'
import { Snowman } from '../components/Decorations'

export default function ParticipantPage() {
  const { personalToken = '' } = useParams()
  const [me, setMe] = useState<MeResponse | null>(null)
  const [assignee, setAssignee] = useState<Assignee | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [newWish, setNewWish] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [showLeave, setShowLeave] = useState(false)

  useEffect(() => {
    getMe(personalToken)
      .then(async (m) => {
        setMe(m)
        if (m.drawn) {
          try {
            setAssignee(await getAssignee(personalToken))
          } catch { /* Ziehung läuft gerade erst */ }
        }
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Server nicht erreichbar.'))
  }, [personalToken])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  const refresh = useCallback(async () => {
    const m = await getMe(personalToken)
    setMe(m)
    if (m.drawn) {
      try { setAssignee(await getAssignee(personalToken)) } catch { /* noch nicht */ }
    }
  }, [personalToken])

  async function submitWish(e: React.FormEvent) {
    e.preventDefault()
    if (!newWish.trim()) return
    setBusy(true)
    try {
      await addWish(personalToken, newWish.trim())
      setNewWish('')
      await refresh()
    } catch (err) {
      setToast(err instanceof ApiError ? err.message : 'Fehler')
    } finally {
      setBusy(false)
    }
  }

  async function removeWish(id: string) {
    try {
      await deleteWish(personalToken, id)
      await refresh()
    } catch (err) {
      setToast(err instanceof ApiError ? err.message : 'Fehler')
    }
  }

  async function leave() {
    try {
      await leaveGroup(personalToken)
      setShowLeave(false)
      setError('Du hast die Wichtelrunde verlassen.')
    } catch (err) {
      setToast(err instanceof ApiError ? err.message : 'Fehler')
      setShowLeave(false)
    }
  }

  if (error) {
    return (
      <div className="wrap">
        <div className="status">{error}</div>
        <p className="muted" style={{ textAlign: 'center', marginTop: 16 }}>
          <Link to="/">Zur Startseite</Link>
        </p>
      </div>
    )
  }
  if (!me) return <div className="wrap"><div className="status">Lädt …</div></div>

  return (
    <div className="wrap">
      <header className="page">
        <div className="flakes">{'\u2744\u2744\u2744'}</div>
        <h1 className="page-title">{me.groupTitle}</h1>
        <p className="sub">Hallo, {me.participant.name}!</p>
      </header>

      {me.drawn ? (
        <div className="status">{'\u2714'} Die Wichtel sind ausgelost!</div>
      ) : (
        <div className="status">
          {'\u23F3'}
          {me.drawDate
            ? <> Auslosung am {new Date(me.drawDate + 'T00:00:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })} — trage bis dahin deine Wünsche ein.</>
            : ' Die Auslosung steht noch aus — trage schon jetzt deine Wünsche ein.'}
        </div>
      )}

      {me.groupDescription ? (
        <div className="card">
          <Snowman />
          <h2 className="section-title">Info</h2>
          <p style={{ fontSize: 15 }}>{me.groupDescription}</p>
        </div>
      ) : (
        <div className="card">
          <Snowman />
          <h2 className="section-title">Info</h2>
          <p className="muted">Keine Beschreibung vom Admin hinterlegt.</p>
        </div>
      )}

      {assignee && (
        <div className="card assignee">
          <h2 className="section-title">Du wichtelst für</h2>
          <div className="name">{assignee.name}</div>
          {assignee.wishes.length === 0 ? (
            <p className="muted">{assignee.name} hat noch keine Wünsche eingetragen.</p>
          ) : (
            <div>
              {assignee.wishes.map((w) => (
                <div className="wish" key={w.id}>
                  <span className="n">{w.position + 1}.</span> <WishText text={w.text} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!me.drawn && (
        <div className="card">
          <h2 className="section-title">Deine Wünsche</h2>
          <p className="muted" style={{ marginBottom: 6 }}>
            Nur du und dein Wichtel sehen diese Liste.
          </p>
          {me.wishes.length === 0 && (
            <p className="muted" style={{ padding: '8px 0' }}>Noch keine Wünsche eingetragen.</p>
          )}
          {me.wishes.map((w) => (
            <div className="wish" key={w.id}>
              <span className="n">{w.position + 1}.</span> <WishText text={w.text} />
              <button className="icon" title="Löschen" onClick={() => removeWish(w.id)}>
                {'\u2715'}
              </button>
            </div>
          ))}
          <form className="add" onSubmit={submitWish}>
            <input
              type="text" value={newWish} maxLength={500}
              placeholder="Noch ein Wunsch …"
              onChange={(e) => setNewWish(e.target.value)}
            />
            <button className="btn" type="submit" disabled={busy || !newWish.trim()}>
              Hinzufügen
            </button>
          </form>
        </div>
      )}

      {!me.drawn && (
        <p className="muted" style={{ textAlign: 'center', marginTop: 24 }}>
          <button className="btn danger" onClick={() => setShowLeave(true)}>
            Aus der Wichtelrunde austreten
          </button>
        </p>
      )}

      {showLeave && (
        <ConfirmDialog
          title="Austreten?"
          text="Deine Wünsche und dein Zugang werden gelöscht. Du kannst mit dem Beitritts-Link wieder beitreten, sofern die Auslosung noch nicht stattgefunden hat."
          confirmLabel="Austreten"
          onConfirm={leave}
          onCancel={() => setShowLeave(false)}
        />
      )}

      {toast && <Toast message={toast} />}
    </div>
  )
}
