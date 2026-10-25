import { Link } from 'react-router-dom'
import { useT } from '../i18n'

export default function HomePage() {
  const { t } = useT()
  return (
    <div className="wrap">
      <header className="page">
        <div className="flakes">{'\u2744\u2744\u2744'}</div>
        <h1 className="page-title">{t('app_name')}</h1>
        <p className="sub">{t('home_sub')}</p>
      </header>

      <div className="card" style={{ textAlign: 'center', padding: '28px 22px' }}>
        <p style={{ fontSize: 15, color: 'var(--fg-muted)' }}>{t('home_pitch')}</p>
        <Link to="/create" className="btn" style={{ display: 'inline-block', marginTop: 18, textDecoration: 'none' }}>
          {t('home_create')}
        </Link>
      </div>

      <p className="muted" style={{ textAlign: 'center', marginTop: 24 }}>
        {t('home_link_hint')}
      </p>
    </div>
  )
}
