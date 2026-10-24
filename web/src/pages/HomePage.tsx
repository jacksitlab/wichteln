import { Link } from 'react-router-dom'

export default function HomePage() {
  return (
    <div className="wrap">
      <header className="page">
        <div className="flakes">{'\u2744\u2744\u2744'}</div>
        <h1 className="page-title">Wichteln</h1>
        <p className="sub">Die Wichtelrunde der Familie — ganz ohne Anmeldung</p>
      </header>

      <div className="card" style={{ textAlign: 'center', padding: '28px 22px' }}>
        <p style={{ fontSize: 15, color: 'var(--fg-muted)' }}>
          Erstelle eine Wichtelrunde, teile den Beitrittslink mit der Familie,
          trage Wünsche ein — und wenn der Tag da ist, werden die Wichtel ausgelost.
        </p>
        <Link to="/create" className="btn" style={{ display: 'inline-block', marginTop: 18, textDecoration: 'none' }}>
          Neue Wichtelrunde erstellen
        </Link>
      </div>

      <p className="muted" style={{ textAlign: 'center', marginTop: 24 }}>
        Du hast einen Link erhalten? Dann öffne ihn einfach direkt.
      </p>
    </div>
  )
}
