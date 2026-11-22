import { Link } from 'react-router-dom';

export interface FooterLink {
  label: string;
  /** Link wewnątrz aplikacji. */
  to?: string;
  /** Link zewnętrzny – otwiera się w nowej karcie. */
  href?: string;
}

interface AppFooterProps {
  links: FooterLink[];
  /** Nazwa nawigacji dla czytników ekranu. */
  navLabel?: string;
  /** Dodatkowa informacja pod linkami (np. o prywatności). */
  note?: string;
}

const DEMO_NOTE = 'Wersja demonstracyjna – integracje z ZUS i logowanie są symulowane.';

/** Wspólna stopka: te same linki pomocnicze i zawsze widoczna informacja o wersji demonstracyjnej. */
export function AppFooter({ links, navLabel = 'Dodatkowa nawigacja', note }: AppFooterProps) {
  return (
    <footer className="ui-footer">
      <div className="ui-container">
        <nav aria-label={navLabel}>
          <ul className="ui-footer__links">
            {links.map((link) => (
              <li key={link.label}>
                {link.href ? (
                  <a href={link.href} target="_blank" rel="noopener noreferrer">
                    {link.label}
                    <span className="visually-hidden"> (otwiera się w nowej karcie)</span>
                  </a>
                ) : (
                  <Link to={link.to ?? '/'}>{link.label}</Link>
                )}
              </li>
            ))}
          </ul>
        </nav>
        {note && <p className="ui-footer__note">{note}</p>}
        <p className="ui-footer__note">{DEMO_NOTE}</p>
      </div>
    </footer>
  );
}
