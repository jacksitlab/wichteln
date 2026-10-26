import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getAdminGroup, getExclusions, patchGroup, postDraw, putExclusions, removeParticipant, deleteGroup, regenerateLink } from '../api'
import type { AdminGroupView, Exclusion, PersonalLinkResponse } from '../types'
import { ApiError } from '../types'
import { ConfirmDialog, LinkBox, Toast } from '../components/Widgets'
import { absUrl } from '../urls'
import { useT } from '../i18n'
import { StarHero } from '../components/Decorations'

export default function AdminPage() {
  const { t, locale } = useT()
  const { adminToken = '' } = useParams()
  const navigate = useNavigate()
  const [group, setGroup] = useState<AdminGroupView | null>(null)
  const [exclusions, setExclusions] = useState<Exclusion[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showDraw, setShowDraw] = useState(false)
  const [drawBusy, setDrawBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [newLink, setNewLink] = useState<PersonalLinkResponse | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const [showDeleteGroup, setShowDeleteGroup] = useState(false)
  const [exGiver, setExGiver] = useState('')
  const [exReceiver, setExReceiver] = useState('')

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
      .catch((err) => setError(err instanceof ApiError ? err.localizedMessage(t) : t('error_server')))
    getExclusions(adminToken)
      .then(setExclusions)
      .catch(() => { /* exclusions are optional in the UI */ })
  }, [adminToken]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(timer)
  }, [toast])

  if (error) {
    return (
      <div className="wrap">
        <div className="status"><p>{error}</p></div>
        <p className="muted" style={{ textAlign: 'center', marginTop: 16 }}>
          <Link to="/">{t('to_homepage')}</Link>
        </p>
      </div>
    )
  }
  if (!group) return <div className="wrap"><div className="status"><p>{t('loading')}</p></div></div>

  async function saveEdit() {
    try {
      const g = await patchGroup(adminToken, {
        title,
        description: description.trim() || undefined,
        drawDate: drawDate || undefined,
      })
      setGroup(g)
      setEditing(false)
      setToast(t('admin_toast_saved'))
    } catch (err) {
      setToast(err instanceof ApiError ? err.localizedMessage(t) : t('admin_toast_save_error'))
    }
  }

  async function draw() {
    setDrawBusy(true)
    try {
      await postDraw(adminToken)
      const g = await getAdminGroup(adminToken)
      setGroup(g)
      setShowDraw(false)
      setToast(t('admin_toast_drawn'))
    } catch (err) {
      setToast(err instanceof ApiError ? err.localizedMessage(t) : t('admin_toast_draw_error'))
      setShowDraw(false)
    } finally {
      setDrawBusy(false)
    }
  }

  async function doRemove(pid: string) {
    try {
      await removeParticipant(adminToken, pid)
      const g = await getAdminGroup(adminToken)
      setGroup(g)
      // Ausschlüsse des entfernten Teilnehmers lokal mitfiltern (Backend löscht
      // sie per ON DELETE CASCADE mit), bis der nächste GET sie liefert
      setExclusions((prev) => prev.filter((ex) => ex.giverId !== pid && ex.receiverId !== pid))
      setToast(t('admin_toast_removed'))
    } catch (err) {
      setToast(err instanceof ApiError ? err.localizedMessage(t) : t('admin_toast_error'))
    } finally {
      setConfirmRemove(null)
    }
  }

  async function saveExclusions(next: Exclusion[]) {
    try {
      const saved = await putExclusions(adminToken, next.map((ex) => ({
        giverId: ex.giverId, receiverId: ex.receiverId,
      })))
      setExclusions(saved)
      return true
    } catch (err) {
      setToast(err instanceof ApiError ? err.localizedMessage(t) : t('admin_toast_error'))
      return false
    }
  }

  async function addExclusion() {
    if (!exGiver || !exReceiver || exGiver === exReceiver) return
    if (exclusions.some((ex) => ex.giverId === exGiver && ex.receiverId === exReceiver)) return
    const nameOf = (id: string) => group?.participants.find((p) => p.id === id)?.name ?? '?'
    const next = [...exclusions, {
      giverId: exGiver, receiverId: exReceiver,
      giverName: nameOf(exGiver), receiverName: nameOf(exReceiver),
    }]
    if (await saveExclusions(next)) {
      setExGiver('')
      setExReceiver('')
    }
  }

  async function removeExclusion(ex: Exclusion) {
    await saveExclusions(exclusions.filter((x) => x !== ex))
  }

  async function doDeleteGroup() {
    try {
      await deleteGroup(adminToken)
      navigate('/')
    } catch (err) {
      setToast(err instanceof ApiError ? err.localizedMessage(t) : t('admin_toast_error'))
      setShowDeleteGroup(false)
    }
  }

  async function newLinkFor(pid: string) {
    try {
      const resp = await regenerateLink(adminToken, pid)
      setNewLink(resp)
    } catch (err) {
      setToast(err instanceof ApiError ? err.localizedMessage(t) : t('admin_toast_error'))
    }
  }

  const drawn = group.drawnAt !== null
  const plannedDate = group.drawDate
    ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' })
        .format(new Date(group.drawDate + 'T00:00:00'))
    : null
  const drawnDate = group.drawnAt
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' })
        .format(new Date(group.drawnAt))
    : null

  return (
    <div className="wrap">
      <header className="page">
        <StarHero />
        <h1 className="page-title">{group.title}</h1>
        {plannedDate && <p className="sub">{t('admin_planned_date', { date: plannedDate })}</p>}
      </header>

      {newLink && (
        <div className="card">
          <h2 className="section-title">{t('admin_new_link_title')}</h2>
          <p className="muted">{t('admin_new_link_hint')}</p>
          <LinkBox url={absUrl(newLink.personalUrl)} />
          <div style={{ marginTop: 12, textAlign: 'right' }}>
            <button className="btn ghost" onClick={() => setNewLink(null)}>{t('close')}</button>
          </div>
        </div>
      )}

      {drawn ? (
        <div className="status"><p>{t('admin_status_drawn', { date: drawnDate ?? '' })}</p></div>
      ) : (
        <div className="status">
          {t('admin_status_pending', { count: group.participants.length })}
        </div>
      )}

      <div className="card">
        <h2 className="section-title">{t('admin_description_title')}</h2>
        {editing ? (
          <div>
            <label className="field">
              {t('field_title')}
              <input type="text" value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="field">
              {t('field_description')}
              <textarea value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} />
            </label>
            <label className="field">
              {t('field_drawdate')}
              <input type="date" value={drawDate} onChange={(e) => setDrawDate(e.target.value)} />
            </label>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn ghost" onClick={() => setEditing(false)}>{t('cancel')}</button>
              <button className="btn" onClick={saveEdit}>{t('save')}</button>
            </div>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: 15 }}>{group.description || <span className="muted">{t('admin_no_description')}</span>}</p>
            <div style={{ marginTop: 12, textAlign: 'right' }}>
              <button className="btn ghost" onClick={() => setEditing(true)}>{t('edit')}</button>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="section-title">{t('admin_join_link_title')}</h2>
        {drawn
          ? <p className="muted">{t('admin_join_disabled')}</p>
          : <p className="muted">{t('admin_join_hint')}</p>}
        <LinkBox url={absUrl(group.joinUrl)} />
      </div>

      <div className="card">
        <h2 className="section-title">{t('admin_participants_title', { count: group.participants.length })}</h2>
        {group.participants.length === 0 && (
          <p className="muted">{t('admin_no_participants')}</p>
        )}
        <ul className="participants">
          {group.participants.map((p) => (
            <li key={p.id}>
              <span>{p.name}</span>
              <span className="since">
                {t('admin_since', {
                  date: new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(p.joinedAt)),
                })}
              </span>
              <button className="icon" title={t('admin_regen_link')} onClick={() => newLinkFor(p.id)}>
                {'\u21BB'} Link
              </button>
              {!drawn && (
                <button className="icon" title={t('admin_remove')} onClick={() => setConfirmRemove(p.id)}>
                  {'\u2715'}
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {!drawn && (
        <div className="card">
          <h2 className="section-title">{t('admin_exclusions_title')}</h2>
          <p className="muted" style={{ marginBottom: 6 }}>{t('admin_exclusions_hint')}</p>
          {exclusions.length > 0 && (
            <ul className="participants" style={{ marginBottom: 12 }}>
              {exclusions.map((ex) => (
                <li key={`${ex.giverId}-${ex.receiverId}`}>
                  <span>
                    {t('admin_exclusion_entry', {
                      giver: ex.giverName, receiver: ex.receiverName,
                    })}
                  </span>
                  <button
                    className="icon" title={t('admin_exclusion_remove')}
                    onClick={() => removeExclusion(ex)}
                  >
                    {'\u2715'}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {group.participants.length >= 2 ? (
            <form
              className="add"
              onSubmit={(e) => { e.preventDefault(); addExclusion() }}
            >
              <select value={exGiver} onChange={(e) => setExGiver(e.target.value)}>
                <option value="">{t('admin_exclusion_giver')}</option>
                {group.participants.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <span aria-hidden="true" style={{ alignSelf: 'center' }}>→</span>
              <select value={exReceiver} onChange={(e) => setExReceiver(e.target.value)}>
                <option value="">{t('admin_exclusion_receiver')}</option>
                {group.participants
                  .filter((p) => p.id !== exGiver)
                  .map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
              </select>
              <button
                className="btn" type="submit"
                disabled={!exGiver || !exReceiver || exGiver === exReceiver}
              >
                {t('admin_exclusion_add')}
              </button>
            </form>
          ) : (
            <p className="muted">{t('admin_exclusions_need_two')}</p>
          )}
        </div>
      )}

      {!drawn && (
        <div className="card" style={{ textAlign: 'center' }}>
          <h2 className="section-title">{t('admin_draw_title')}</h2>
          <p className="muted" style={{ marginBottom: 14 }}>{t('admin_draw_warning')}</p>
          <button
            className="btn" style={{ fontSize: 17, padding: '14px 28px' }}
            disabled={group.participants.length < 2}
            onClick={() => setShowDraw(true)}
          >
            {t('admin_draw_button')}
          </button>
          {group.participants.length < 2 && (
            <p className="muted" style={{ marginTop: 10 }}>{t('admin_draw_min_participants')}</p>
          )}
        </div>
      )}

      <div className="card" style={{ textAlign: 'center', borderColor: '#5c2e2e' }}>
        <h2 className="section-title">{t('admin_delete_title')}</h2>
        <p className="muted" style={{ marginBottom: 14 }}>{t('admin_delete_hint')}</p>
        <button className="btn danger" onClick={() => setShowDeleteGroup(true)}>
          {t('admin_delete_button')}
        </button>
      </div>

      {showDraw && (
        <ConfirmDialog
          title={t('admin_draw_dialog_title')}
          text={t('admin_draw_dialog_text')}
          confirmLabel={t('admin_draw_dialog_confirm')}
          onConfirm={draw}
          onCancel={() => setShowDraw(false)}
          busy={drawBusy}
        />
      )}

      {confirmRemove && (
        <ConfirmDialog
          title={t('admin_remove_dialog_title')}
          text={t('admin_remove_dialog_text', {
            name: group.participants.find((p) => p.id === confirmRemove)?.name ?? '',
          })}
          confirmLabel={t('admin_remove_dialog_confirm')}
          onConfirm={() => doRemove(confirmRemove)}
          onCancel={() => setConfirmRemove(null)}
        />
      )}

      {showDeleteGroup && (
        <ConfirmDialog
          title={t('admin_delete_dialog_title')}
          text={t('admin_delete_dialog_text')}
          confirmLabel={t('admin_delete_dialog_confirm')}
          onConfirm={doDeleteGroup}
          onCancel={() => setShowDeleteGroup(false)}
        />
      )}

      {toast && <Toast message={toast} />}
    </div>
  )
}
