import { Link } from 'react-router-dom';
import './PlaceholderPage.css';

export function PlaceholderPage() {
  return (
    <main id="main" tabIndex={-1} className="placeholder-page">
      <h1 className="placeholder-page__title">Ta sekcja jest w przygotowaniu</h1>
      <p className="placeholder-page__text">Pracujemy nad nią. Zajrzyj tu wkrótce.</p>
      <Link className="placeholder-page__link" to="/">
        Wróć na stronę startową
      </Link>
    </main>
  );
}
