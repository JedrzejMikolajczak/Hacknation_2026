import { Link } from 'react-router-dom';
import './PlaceholderPage.css';

export function NotFoundPage() {
  return (
    <main id="main" tabIndex={-1} className="placeholder-page">
      <h1 className="placeholder-page__title">Nie znaleziono strony</h1>
      <p className="placeholder-page__text">Sprawdź adres lub wróć na stronę startową.</p>
      <Link className="placeholder-page__link" to="/">
        Wróć na stronę startową
      </Link>
    </main>
  );
}
