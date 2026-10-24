import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getAdminGroup, patchGroup, postDraw, removeParticipant, regenerateLink } from '../api'
import type { AdminGroupView, PersonalLinkResponse } from '../types'
import { ApiError } from '../types'
import { ConfirmDialog, LinkBox, Toast } from '../components/Widgets'
import { absUrl } from '../urls'

export default function AdminPage() {
  const { adminToken = '' } = useParams()
  const [group, setGroup] = useState<AdminGroupView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showDraw, setShowDraw] = useState(false)
  const [drawBusy, setDrawBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [newLink, setNewLink] = useState<PersonalLinkResponse | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)

  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [drawDate, setDrawDate] = useState('')

  useEffect(() => {
    getAdminGroup(adminToken)
      .then((g) => {
        setGroup(g)
        setTitle(g.title)
        setDescription(g.description ?? '')
        setDrawDate(g.drawDate ?? '')
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Server nicht erreichbar.'))
  }, [adminToken])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

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
  if (!group) return <div className="wrap"><div className="status">Lädt …</div></div>

  async function saveEdit() {
    try {
      const g = await patchGroup(adminToken, {
        title,
        description: description.trim() || undefined,
        drawDate: drawDate || undefined,
      })
      setGroup(g)
      setEditing(false)
      setToast('Gespeichert')
    } catch (err) {
      setToast(err instanceof ApiError ? err.message : 'Fehler beim Speichern')
    }
  }

  async function draw() {
    setDrawBusy(true)
    try {
      await postDraw(adminToken)
      const g = await getAdminGroup(adminToken)
      setGroup(g)
      setShowDraw(false)
      setToast('Wichtel ausgelost!')
    } catch (err) {
      setToast(err instanceof ApiError ? err.message : 'Fehler bei der Auslosung')
      setShowDraw(false)
    } finally {
      setDrawBusy(false)
    }
  }

  async function doRemove(pid: string) {
    try {
      await removeParticipant(adminToken, pid)
      setGroup(await getAdminGroup(adminToken))
      setToast('Teilnehmer entfernt')
    } catch (err) {
      setToast(err instanceof ApiError ? err.message : 'Fehler')
    } finally {
      setConfirmRemove(null)
    }
  }

  async function newLinkFor(pid: string) {
    try {
      const resp = await regenerateLink(adminToken, pid)
      setNewLink(resp)
    } catch (err) {
      setToast(err instanceof ApiError ? err.message : 'Fehler')
    }
  }

  const drawn = group.drawnAt !== null

  return (
    <div className="wrap">
      <header className="page">
        <div className="flakes">{'\u2744\u2744\u2744'}</div>
        <h1 className="page-title">{group.title}</h1>
        {group.drawDate && (
          <p className="sub">Auslosung geplant am {new Date(group.drawDate + 'T00:00:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        )}
      </header>

      {newLink && (
        <div className="card">
          <h2 className="section-title">Neuer persönlicher Link</h2>
          <p className="muted">Gib diesen Link dem Teilnehmer — der alte ist ungültig.</p>
          <LinkBox url={absUrl(newLink.personalUrl)} />
          <div style={{ marginTop: 12, textAlign: 'right' }}>
            <button className="btn ghost" onClick={() => setNewLink(null)}>Schließen</button>
          </div>
        </div>
      )}

      {drawn ? (
        <div className="status">
          {'\u2714'} Ausgelost am {new Date(group.drawnAt!).toLocaleString('de-DE')} — alle Wichtel sind verteilt.
        </div>
      ) : (
        <div className="status">
          {'\u23F3'} Noch nicht ausgelost — {group.participants.length} Teilnehmer angemeldet
        </div>
      )}

      <div className="card">
        <h2 className="section-title">Beschreibung</h2>
        {editing ? (
          <div>
            <label className="field">
              Titel
              <input type="text" value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="field">
              Beschreibung
              <textarea value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} />
            </label>
            <label className="field">
              Auslosungsdatum
              <input type="date" value={drawDate} onChange={(e) => setDrawDate(e.target.value)} />
            </label>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn ghost" onClick={() => setEditing(false)}>Abbrechen</button>
              <button className="btn" onClick={saveEdit}>Speichern</button>
            </div>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: 15 }}>{group.description || <span className="muted">Keine Beschreibung</span>}</p>
            <div style={{ marginTop: 12, textAlign: 'right' }}>
              <button className="btn ghost" onClick={() => setEditing(true)}>Bearbeiten</button>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="section-title">Beitritts-Link</h2>
        {drawn
          ? <p className="muted">Beitritte sind nach der Auslosung deaktiviert.</p>
          : <p className="muted">Teile diesen Link mit allen Teilnehmern.</p>}
        <LinkBox url={absUrl(group.joinUrl)} />
      </div>

      <div className="card">
        <h2 className="section-title">Teilnehmer ({group.participants.length})</h2>
        {group.participants.length === 0 && (
          <p className="muted">Noch niemand beigetreten — teile den Beitritts-Link.</p>
        )}
        <ul className="participants">
          {group.participants.map((p) => (
            <li key={p.id}>
              <span>{p.name}</span>
              <span className="since">
                seit {new Date(p.joinedAt).toLocaleDateString('de-DE')}
              </span>
              <button className="icon" title="Link neu erstellen" onClick={() => newLinkFor(p.id)}>
                {'\u21BB'} Link
              </button>
              {!drawn && (
                <button className="icon" title="Entfernen" onClick={() => setConfirmRemove(p.id)}>
                  {'\u2715'}
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {!drawn && (
        <div className="card" style={{ textAlign: 'center' }}>
          <h2 className="section-title">Auslosung</h2>
          <p className="muted" style={{ marginBottom: 14 }}>
            Die Auslosung kann <b>nicht rückgängig</b> gemacht werden. Jeder Teilnehmer
            bekommt danach die Wünsche seiner Zugewiesenen zu sehen.
          </p>
          <button
            className="btn" style={{ fontSize: 17, padding: '14px 28px' }}
            disabled={group.participants.length < 2}
            onClick={() => setShowDraw(true)}
          >
            {'\u26C4'} Wichtel jetzt auslosen
          </button>
          {group.participants.length < 2 && (
            <p className="muted" style={{ marginTop: 10 }}>
              Mindestens 2 Teilnehmer erforderlich.
            </p>
          )}
        </div>
      )}

      {showDraw && (
        <ConfirmDialog
          title="Wichtel auslosen?"
          text="Diese Aktion kann nicht zurückgenommen werden. Jeder Teilnehmer sieht danach die Wünsche der Person, die er beschenkt. Neue Beitritte sind danach nicht mehr möglich."
          confirmLabel="Jetzt auslosen"
          onConfirm={draw}
          onCancel={() => setShowDraw(false)}
          busy={drawBusy}
        />
      )}

      {confirmRemove && (
        <ConfirmDialog
          title="Teilnehmer entfernen?"
          text={`Möchtest du ${group.participants.find((p) => p.id === confirmRemove)?.name} wirklich entfernen? Dessen Wünsche und Link werden gelöscht.`}
          confirmLabel="Entfernen"
          onConfirm={() => doRemove(confirmRemove)}
          onCancel={() => setConfirmRemove(null)}
        />
      )}

      {toast && <Toast message={toast} />}
    </div>
  )
}
