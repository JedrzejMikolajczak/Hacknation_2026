import { Link } from 'react-router-dom';
import { AppBar } from './AppBar';
import { AppFooter, type FooterLink } from './AppFooter';
import './PlaceholderPage.css';

const FOOTER_LINKS: FooterLink[] = [
  { to: '/guide', label: 'Przewodnik' },
  { to: '/cases', label: 'Przykładowe sprawy' },
];

interface StatusPageProps {
  title: string;
  text: string;
  /** Duży, dekoracyjny kod strony (np. „404”). */
  code?: string;
}

/** Prosta strona „nic tu nie ma”: mówi, co się stało, i od razu pokazuje drogę dalej. */
export function StatusPage({ title, text, code }: StatusPageProps) {
  return (
    <div className="status-page">
      <header>
        <AppBar isStatic />
      </header>
      <main id="main" tabIndex={-1} className="status-page__main">
        {code && (
          <p className="status-page__code" aria-hidden="true">
            {code}
          </p>
        )}
        <h1 className="status-page__title">{title}</h1>
        <p className="status-page__text">{text}</p>
        <div className="status-page__actions">
          <Link className="ui-btn ui-btn--cta" to="/">
            Wróć na stronę startową
          </Link>
          <Link className="ui-btn ui-btn--ghost" to="/guide">
            Zajrzyj do przewodnika
          </Link>
        </div>
      </main>
      <AppFooter links={FOOTER_LINKS} />
    </div>
  );
}
