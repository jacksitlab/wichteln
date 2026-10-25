import { useT } from '../i18n'

/**
 * Seiten-Footer: GitHub-Link + kurzer Datenschutz-Hinweis (Datensparsamkeit).
 * Reagiert auf den Sprachumschalter; liegt im Seitenfluss unter dem Inhalt.
 */
export function Footer() {
  const { t } = useT()
  return (
    <footer className="site-footer">
      <p>{t('footer_privacy')}</p>
      <p>
        <a href="https://github.com/jacksitlab/wichtel" target="_blank" rel="noopener noreferrer">
          {'\u2726'} {t('footer_code')}
        </a>
      </p>
      <style>{`
        .site-footer {
          position: relative; z-index: 1;
          max-width: 640px; margin: 0 auto;
          padding: 8px 20px 110px; /* unten Platz für die wachsende Schneedecke */
          text-align: center;
          font-size: 12px; line-height: 1.7;
          color: var(--fg-muted);
        }
        .site-footer p { margin: 0; }
        .site-footer a {
          color: var(--gold); text-decoration: none;
          border-bottom: 1px dotted var(--gold);
        }
        .site-footer a:hover { opacity: 0.8; }
      `}</style>
    </footer>
  )
}
