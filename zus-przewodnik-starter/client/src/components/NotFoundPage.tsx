import { StatusPage } from './StatusPage';

export function NotFoundPage() {
  return (
    <StatusPage
      code="404"
      title="Nie znaleziono strony"
      text="Sprawdź adres albo wróć na stronę startową – stamtąd w kilka kliknięć dojdziesz do swojego planu."
    />
  );
}
