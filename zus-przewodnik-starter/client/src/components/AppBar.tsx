import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/** Znak aplikacji: zielony kafelek z sercem (dziecko) i ciepłą kropką (data/termin). Własny, nie logo ZUS. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 36 36" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient
          id="brand-mark-gradient"
          x1="4"
          y1="2"
          x2="32"
          y2="34"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#25b868" />
          <stop offset="1" stopColor="#007834" />
        </linearGradient>
      </defs>
      <rect width="36" height="36" rx="11" fill="url(#brand-mark-gradient)" />
      <path
        d="M18 26.5s-7.6-4.6-7.6-10.2A4.2 4.2 0 0 1 18 13.7a4.2 4.2 0 0 1 7.6 2.6c0 5.6-7.6 10.2-7.6 10.2z"
        fill="#fff"
      />
      <circle cx="27" cy="9" r="2.6" fill="#fab856" />
    </svg>
  );
}

interface AppBarProps {
  /** Akcje po prawej stronie paska, np. „Zmień odpowiedzi”. */
  actions?: ReactNode;
  /** Pasek nie przykleja się do góry (gdy strona ma własny, przyklejony element). */
  isStatic?: boolean;
  /** Znak aplikacji jest linkiem na start; na samej stronie startowej – zwykłym podpisem. */
  brandLink?: boolean;
}

/**
 * Wspólny, odchudzony pasek każdej strony: wiadomo, gdzie jestem (znak aplikacji = powrót na
 * start) i że to wersja demonstracyjna. Nie jest landmarkiem – strona opakowuje go w <header>.
 */
export function AppBar({ actions, isStatic = false, brandLink = true }: AppBarProps) {
  const brand = (
    <>
      <BrandMark className="ui-brand__mark" />
      <span className="ui-brand__name">Przewodnik Przyszłego Rodzica</span>
    </>
  );
  return (
    <div className={isStatic ? 'ui-appbar ui-appbar--static' : 'ui-appbar'}>
      <div className="ui-appbar__inner">
        {brandLink ? (
          <Link to="/" className="ui-brand">
            {brand}
          </Link>
        ) : (
          <span className="ui-brand">{brand}</span>
        )}
        <span className="ui-appbar__spacer" />
        <span className="ui-demo-pill">
          <span className="ui-demo-pill__long">Wersja demonstracyjna</span>
          <span className="ui-demo-pill__short">Demo</span>
        </span>
        {actions && <div className="ui-appbar__actions">{actions}</div>}
      </div>
      <div className="ui-appbar__progress" aria-hidden="true" />
    </div>
  );
}
