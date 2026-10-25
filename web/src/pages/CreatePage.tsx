import { useState } from 'react'
import { Link } from 'react-router-dom'
import { postGroup } from '../api'
import { ApiError } from '../types'
import { LinkBox } from '../components/Widgets'
import { absUrl } from '../urls'
import { useT } from '../i18n'
import { StarHero } from '../components/Decorations'

export default function CreatePage() {
  const { t } = useT()
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
      // Put the admin token into the URL so the admin can reload the page
      window.history.replaceState(null, '', `/g/${resp.adminToken}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.localizedMessage(t) : t('error_server'))
    } finally {
      setBusy(false)
    }
  }

  if (created) {
    return (
      <div className="wrap">
        <header className="page">
          <StarHero />
          <h1 className="page-title">{t('create_done_title')}</h1>
          <p className="sub">{t('create_done_sub')}</p>
        </header>

        <div className="warn">{t('create_warn_admin')}</div>

        <div className="card">
          <h2 className="section-title">{t('create_admin_link')}</h2>
          <p className="muted">{t('create_admin_link_hint')}</p>
          <LinkBox url={absUrl(created.adminUrl)} />
        </div>

        <div className="card">
          <h2 className="section-title">{t('create_join_link')}</h2>
          <p className="muted">{t('create_join_link_hint')}</p>
          <LinkBox url={absUrl(created.joinUrl)} />
        </div>

        <div className="card" style={{ textAlign: 'center' }}>
          <p className="muted" style={{ marginBottom: 12 }}>{t('create_continue')}</p>
          <Link to={`/g/${created.adminToken}`} className="btn" style={{ textDecoration: 'none' }}>
            {t('create_to_admin')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="wrap">
      <header className="page">
        <StarHero />
        <h1 className="page-title">{t('create_title')}</h1>
        <p className="sub">{t('create_sub')}</p>
      </header>

      <div className="card">
        <form onSubmit={submit}>
          <label className="field">
            {t('field_title')} *
            <input
              type="text" value={title} maxLength={100} required
              placeholder={t('field_title_placeholder')}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="field">
            {t('field_description')}
            <textarea
              value={description} maxLength={2000}
              placeholder={t('field_description_placeholder')}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="field">
            {t('field_drawdate')}
            <input type="date" value={drawDate} onChange={(e) => setDrawDate(e.target.value)} />
          </label>
          {error && <p className="warn">{error}</p>}
          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <button className="btn" type="submit" disabled={busy || !title.trim()}>
              {busy ? t('create_submitting') : t('create_submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
