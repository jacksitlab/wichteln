import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { postJoin } from '../api'
import { ApiError } from '../types'
import { LinkBox } from '../components/Widgets'
import { absUrl } from '../urls'
import { useT } from '../i18n'
import { StarHero } from '../components/Decorations'

export default function JoinPage() {
  const { t } = useT()
  const { joinToken = '' } = useParams()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [joined, setJoined] = useState<Awaited<ReturnType<typeof postJoin>> | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      setJoined(await postJoin(joinToken, name.trim()))
    } catch (err) {
      setError(err instanceof ApiError ? err.localizedMessage(t) : t('error_server'))
    } finally {
      setBusy(false)
    }
  }

  if (joined) {
    return (
      <div className="wrap">
        <header className="page">
          <StarHero />
          <h1 className="page-title">{t('join_done_title', { name: joined.participant.name })}</h1>
          <p className="sub">{t('join_done_sub')}</p>
        </header>

        <div className="warn">{t('join_warn')}</div>

        <div className="card">
          <h2 className="section-title">{t('join_your_link')}</h2>
          <LinkBox url={absUrl(joined.personalUrl)} onCopied={() => setLinkCopied(true)} />
          {!linkCopied && (
            <p className="muted" style={{ marginTop: 12 }}>{t('join_copy_first')}</p>
          )}
        </div>

        {linkCopied && (
          <div style={{ textAlign: 'center', marginTop: '2em' }}>
            <Link to={`/p/${joined.personalToken}`} className="btn" style={{ textDecoration: 'none' }}>
              {t('join_next')}
            </Link>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="wrap">
      <header className="page">
        <StarHero />
        <h1 className="page-title">{t('join_title')}</h1>
        <p className="sub">{t('join_sub')}</p>
      </header>

      <div className="card">
        <h2 className="section-title">{t('join_name_label')}</h2>
        <p className="muted" style={{ marginBottom: 6 }}>{t('join_name_hint')}</p>
        <form onSubmit={submit} className="add" style={{ marginTop: 12 }}>
          <input
            type="text" value={name} maxLength={60} required autoFocus
            placeholder={t('join_name_placeholder')}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn" type="submit" disabled={busy || !name.trim()}>
            {busy ? '…' : t('join_submit')}
          </button>
        </form>
        {error && <p className="warn">{error}</p>}
      </div>
    </div>
  )
}
