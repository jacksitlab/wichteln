import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { addWish, deleteWish, getAssignee, getMe, leaveGroup } from '../api'
import type { ApiErrorBody, Assignee, MeResponse } from '../types'
import { ApiError } from '../types'
import { ConfirmDialog, Toast, WishText } from '../components/Widgets'
import { Snowman } from '../components/Decorations'
import { StarHero } from '../components/Decorations'
import { useT } from '../i18n'

/**
 * Error state is kept as structured data (not pre-rendered text), so the
 * message re-localizes when the language is switched.
 */
type ErrorState =
  | { kind: 'api'; body: ApiErrorBody }
  | { kind: 'left' }
  | { kind: 'server' }

export default function ParticipantPage() {
  const { t, locale } = useT()
  const { personalToken = '' } = useParams()
  const [me, setMe] = useState<MeResponse | null>(null)
  const [assignee, setAssignee] = useState<Assignee | null>(null)
  const [error, setError] = useState<ErrorState | null>(null)
  const [newWish, setNewWish] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [showLeave, setShowLeave] = useState(false)

  // Localize at render time (reacts to language switches)
  const errorMessage = !error
    ? null
    : error.kind === 'api'
      ? new ApiError(0, error.body).localizedMessage(t)
      : error.kind === 'left'
        ? t('left_message')
        : t('error_server')

  useEffect(() => {
    getMe(personalToken)
      .then(async (m) => {
        setMe(m)
        if (m.drawn) {
          try {
            setAssignee(await getAssignee(personalToken))
          } catch { /* drawing just started */ }
        }
      })
      .catch((err) => setError(
        err instanceof ApiError ? { kind: 'api', body: err.body } : { kind: 'server' },
      ))
  }, [personalToken])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(timer)
  }, [toast])

  const refresh = useCallback(async () => {
    const m = await getMe(personalToken)
    setMe(m)
    if (m.drawn) {
      try { setAssignee(await getAssignee(personalToken)) } catch { /* not yet */ }
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
      setToast(err instanceof ApiError ? err.localizedMessage(t) : t('error_generic'))
    } finally {
      setBusy(false)
    }
  }

  async function removeWish(id: string) {
    try {
      await deleteWish(personalToken, id)
      await refresh()
    } catch (err) {
      setToast(err instanceof ApiError ? err.localizedMessage(t) : t('error_generic'))
    }
  }

  async function leave() {
    try {
      await leaveGroup(personalToken)
      setShowLeave(false)
      setError({ kind: 'left' })
    } catch (err) {
      setToast(err instanceof ApiError ? err.localizedMessage(t) : t('error_generic'))
      setShowLeave(false)
    }
  }

  if (errorMessage) {
    return (
      <div className="wrap">
        <div className="status">{errorMessage}</div>
        <p className="muted" style={{ textAlign: 'center', marginTop: 16 }}>
          <Link to="/">{t('to_homepage')}</Link>
        </p>
      </div>
    )
  }
  if (!me) return <div className="wrap"><div className="status">{t('loading')}</div></div>

  const drawDateText = me.drawDate
    ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' })
        .format(new Date(me.drawDate + 'T00:00:00'))
    : null

  // Statuszeile direkt bei drawDateText zusammensetzen: Datum fett (via <strong>)
  const statusLine: ReactNode = (() => {
    if (me.drawn) return t('status_drawn')
    if (!drawDateText) return t('status_pending')
    return (
      <>
        {t('status_pending_date')}
        <strong>{drawDateText}</strong>
        {t('status_pending_date_suffix')}
      </>
    )
  })()

  return (
    <div className="wrap">
      <header className="page">
        <StarHero />
        <h1 className="page-title">{me.groupTitle}</h1>
        <p className="sub">{t('participant_greeting', { name: me.participant.name })}</p>
      </header>

      <div className="status"><p>{statusLine}</p></div>

      {me.groupDescription ? (
        <div className="card">
          <Snowman />
          <h2 className="section-title">{t('info_title')}</h2>
          <p style={{ fontSize: 15 }}>{me.groupDescription}</p>
        </div>
      ) : (
        <div className="card">
          <Snowman />
          <h2 className="section-title">{t('info_title')}</h2>
          <p className="muted">{t('info_no_description')}</p>
        </div>
      )}

      {assignee && (
        <div className="card assignee">
          <h2 className="section-title">{t('assignee_title')}</h2>
          <div className="name">{assignee.name}</div>
          {assignee.wishes.length === 0 ? (
            <p className="muted">{t('assignee_no_wishes', { name: assignee.name })}</p>
          ) : (
            <div>
              {assignee.wishes.map((w) => (
                <div className="wish" key={w.id}>
                  <span className="n">{'\u2726'}</span> <WishText text={w.text} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!me.drawn && (
        <div className="card">
          <h2 className="section-title">{t('wishes_title')}</h2>
          <p className="muted" style={{ marginBottom: 6 }}>{t('wishes_privacy_hint')}</p>
          {me.wishes.length === 0 && (
            <p className="muted" style={{ padding: '8px 0' }}>{t('wishes_empty')}</p>
          )}
          {me.wishes.map((w) => (
            <div className="wish" key={w.id}>
              <span className="n">{'\u2726'}</span> <WishText text={w.text} />
              <button className="icon" title={t('delete')} onClick={() => removeWish(w.id)}>
                {'\u2715'}
              </button>
            </div>
          ))}
          <form className="add" onSubmit={submitWish}>
            <input
              type="text" value={newWish} maxLength={500}
              placeholder={t('wish_placeholder')}
              onChange={(e) => setNewWish(e.target.value)}
            />
            <button className="btn" type="submit" disabled={busy || !newWish.trim()}>
              {t('wish_add')}
            </button>
          </form>
        </div>
      )}

      {!me.drawn && (
        <p className="muted" style={{ textAlign: 'center', marginTop: 24 , marginBottom: 160}}>
          <button className="btn danger" onClick={() => setShowLeave(true)}>
            {t('leave_button')}
          </button>
        </p>
      )}

      {showLeave && (
        <ConfirmDialog
          title={t('leave_dialog_title')}
          text={t('leave_dialog_text')}
          confirmLabel={t('leave_dialog_confirm')}
          onConfirm={leave}
          onCancel={() => setShowLeave(false)}
        />
      )}

      {toast && <Toast message={toast} />}
    </div>
  )
}
