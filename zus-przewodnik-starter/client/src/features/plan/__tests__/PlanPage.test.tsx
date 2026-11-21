import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from '../../../app/App';
import { ScenarioProvider } from '../../../app/ScenarioContext';

function LocationSpy() {
  const loc = useLocation();
  return <div data-testid="loc">{`${loc.pathname}${loc.search}`}</div>;
}

function renderPlan(initialEntry = '/plan') {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ScenarioProvider>
        <App />
        <LocationSpy />
      </ScenarioProvider>
    </MemoryRouter>,
  );
  return { user };
}

describe('Twój plan (/plan/:tab) – wszystkie 6 zakładek i przeliczanie na żywo', () => {
  it('na /plan pokazuje 6 kafelków sekcji, każdy prowadzi do swojej zakładki z zachowaniem scenariusza', () => {
    renderPlan('/plan?zatrudnienie=uop&dzieci=2');

    expect(screen.getByTestId('loc')).toHaveTextContent('/plan?zatrudnienie=uop&dzieci=2');
    expect(
      screen.getByRole('heading', { level: 2, name: 'Czym chcesz się teraz zająć?' }),
    ).toBeInTheDocument();
    const hub = within(screen.getByRole('region', { name: 'Czym chcesz się teraz zająć?' }));
    const tiles = hub.getAllByRole('link');
    expect(tiles).toHaveLength(6);
    const expected: [string, string][] = [
      ['Uprawnienia', 'entitlements'],
      ['Kalkulator', 'calculator'],
      ['Plan urlopów', 'leave-plan'],
      ['Dokumenty i terminy', 'documents'],
      ['Wnioski', 'applications'],
      ['Wsparcie', 'support'],
    ];
    expected.forEach(([label, id], index) => {
      expect(tiles[index]).toHaveTextContent(label);
      expect(tiles[index]).toHaveAttribute('href', `/plan/${id}?zatrudnienie=uop&dzieci=2`);
    });
    // na ekranie kafelków nie ma jeszcze zakładek ani panelu sekcji
    expect(
      screen.queryByRole('navigation', { name: 'Zakładki Twojego planu' }),
    ).not.toBeInTheDocument();
  });

  it('nieznana sekcja wraca do kafelków, a z sekcji można wrócić do listy sekcji', async () => {
    const { user } = renderPlan('/plan/nie-ma-takiej?dzieci=1');
    expect(screen.getByTestId('loc')).toHaveTextContent('/plan?dzieci=1');

    await user.click(screen.getByRole('link', { name: /^Kalkulator/ }));
    expect(screen.getByTestId('loc')).toHaveTextContent('/plan/calculator?dzieci=1');
    expect(screen.getByRole('navigation', { name: 'Zakładki Twojego planu' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: '← Wszystkie sekcje planu' }));
    expect(screen.getByTestId('loc')).toHaveTextContent(/^\/plan\?/);
    expect(screen.getAllByRole('link', { name: /Przejdź|Uprawnienia/ }).length).toBeGreaterThan(0);
  });

  it('kafelek Uprawnienia otwiera karty uprawnień oraz ostrzeżenia', async () => {
    const { user } = renderPlan('/plan?zatrudnienie=jdg&zadluzenie=500&dzieci=1&porod=2026-11-10');

    await user.click(screen.getByRole('link', { name: /^Uprawnienia/ }));
    expect(screen.getByTestId('loc')).toHaveTextContent('/plan/entitlements');
    expect(
      screen.getByRole('heading', { level: 1, name: /Twój plan zasiłkowy i urlopowy/i }),
    ).toBeInTheDocument();

    // Ostrzeżenie o zadłużeniu JDG ponad 1% minimalnego wynagrodzenia
    expect(screen.getByText(/Zadłużenie składkowe \(JDG\)/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Nie przysługuje/i).length).toBeGreaterThanOrEqual(1);
  });

  it('przelicza kalkulator na żywo po zmianie wariantu (81,5% vs 100%+70%) i liczby dzieci oraz aktualizuje URL', async () => {
    const { user } = renderPlan(
      '/plan/calculator?zatrudnienie=uop&dzieci=1&podstawa=6000&wariant=combined',
    );

    expect(
      screen.getByRole('heading', { level: 2, name: /Przełączniki kalkulatora/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /100% \+ 70%/i }));
    expect(screen.getByTestId('loc')).toHaveTextContent('wariant=standard');

    await user.selectOptions(screen.getByLabelText(/Liczba dzieci w kalkulatorze/i), '2');
    expect(screen.getByTestId('loc')).toHaveTextContent('dzieci=2');
    expect(screen.getAllByText(/31 tyg\./i).length).toBeGreaterThanOrEqual(1);
  });

  it('wyświetla oś czasu, waliduje podział urlopu rodzicielskiego i liczy łączenie urlopu z pracą', async () => {
    const { user } = renderPlan(
      '/plan/leave-plan?zatrudnienie=uop&dzieci=1&podstawa=6000&ojciec=1',
    );

    expect(
      screen.getByRole('heading', { level: 2, name: /Oś czasu urlopów obojga rodziców/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Oś czasu urlopów matki/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Oś czasu urlopów drugiego rodzica/i)).toBeInTheDocument();

    expect(await screen.findByText(/Podział zgodny z Kodeksem pracy/i)).toBeInTheDocument();
    expect(await screen.findByText(/Wydłużenie urlopu rodzicielskiego/i)).toBeInTheDocument();

    // Zmień wymiar etatu na 1/4
    await user.selectOptions(screen.getByLabelText(/Wymiar etatu podczas urlopu/i), '0.25');
    expect(await screen.findByText(/\+3 tyg\./i)).toBeInTheDocument();
  });

  it('pozwala odhaczać dokumenty w zakładce Dokumenty i terminy oraz pokazuje płatnika i terminy', async () => {
    const { user } = renderPlan('/plan/documents?zatrudnienie=uop&porod=2026-11-10&platnik=12');

    expect(
      screen.getByRole('heading', { level: 2, name: /Lista dokumentów do skompletowania/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Skompletowano: 0 z/i)).toBeInTheDocument();

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]);
    expect(screen.getByText(/Skompletowano: 1 z/i)).toBeInTheDocument();
    expect(screen.getAllByText(/01\.12\.2026/i).length).toBeGreaterThanOrEqual(1);
  });

  it('w zakładce Wnioski automatycznie wypełnia formularze (w tym odpis aktu urodzenia) i symuluje wysyłkę z UPO', async () => {
    const { user } = renderPlan(
      '/plan/applications?zatrudnienie=uop&porod=2026-11-10&podstawa=6000',
    );

    expect(
      screen.getByText(/Wniosek o skrócony odpis aktu urodzenia dziecka/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Wniosek o zasiłek macierzyński \(ZUS ZAM\)/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Wyślij wniosek ZUS ZAM/i }));
    const receipt = screen.getByRole('region', { name: /Potwierdzenie wysłania ZUS ZAM/i });
    expect(within(receipt).getByText(/UPO – Potwierdzenie złożenia/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Wyślij wszystkie wnioski/i }));
    expect(screen.getByRole('button', { name: /Wszystkie wnioski wysłane/i })).toBeDisabled();
  });

  it('w zakładce Wsparcie udostępnia organizacje pomocowe, pytanie do PUE/eZUS oraz Asystenta AI z etykietą AI', async () => {
    const { user } = renderPlan('/plan/support');

    expect(screen.getByText(/Wspierane przez AI/i)).toBeInTheDocument();
    expect(screen.getByText(/Fundacja Rodzić po Ludzku/i)).toBeInTheDocument();

    // Zapytanie do Asystenta AI
    await user.click(screen.getByRole('button', { name: /Kiedy opłaca się wariant 81,5%/i }));
    expect(await screen.findByText(/ujednoliconą stawkę 81,5%/i)).toBeInTheDocument();

    // Wysłanie pytania do PUE / eZUS
    await user.type(
      screen.getByLabelText(/Treść pytania do doradcy ZUS/i),
      'Proszę o potwierdzenie terminu złożenia ZAM.',
    );
    await user.click(screen.getByRole('button', { name: /Wyślij pytanie do PUE \/ eZUS/i }));
    expect(screen.getByText(/Zapytanie zostało wysłane/i)).toBeInTheDocument();
  });
});
