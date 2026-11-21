import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from '../../../app/App';
import { ScenarioProvider, type ScenarioDraft } from '../../../app/ScenarioContext';

function LocationSpy() {
  const loc = useLocation();
  return <div data-testid="loc">{`${loc.pathname}${loc.search}`}</div>;
}

function renderPlan(initialEntry = '/plan', initialScenario?: ScenarioDraft) {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ScenarioProvider initialScenario={initialScenario}>
        <App />
        <LocationSpy />
      </ScenarioProvider>
    </MemoryRouter>,
  );
  return { user };
}

describe('Twój plan (/plan/:tab) – wszystkie 6 zakładek, realne dane z kreatora i stany braków', () => {
  it('na /plan pokazuje wskazówkę kolejności, wyróżniony pierwszy kafelek i 6 sekcji z zachowaniem scenariusza', () => {
    renderPlan('/plan?zatrudnienie=uop&dzieci=2&porod=2026-11-10');

    expect(screen.getByTestId('loc')).toHaveTextContent(
      '/plan?zatrudnienie=uop&dzieci=2&porod=2026-11-10',
    );
    expect(
      screen.getByRole('heading', { level: 2, name: 'Czym chcesz się teraz zająć?' }),
    ).toBeInTheDocument();
    const hub = within(screen.getByRole('region', { name: 'Czym chcesz się teraz zająć?' }));
    expect(hub.getByText(/Od czego zacząć\?/i)).toBeInTheDocument();
    const tiles = hub.getAllByRole('link');
    expect(tiles).toHaveLength(6);
    expect(tiles[0]).toHaveClass('plan-hub__tile--recommended');
    expect(within(tiles[0]).getByText('Zacznij tutaj')).toBeInTheDocument();
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
      expect(tiles[index]).toHaveAttribute(
        'href',
        `/plan/${id}?zatrudnienie=uop&dzieci=2&porod=2026-11-10`,
      );
    });
    expect(
      screen.queryByRole('navigation', { name: 'Zakładki Twojego planu' }),
    ).not.toBeInTheDocument();
  });

  it('nieznana sekcja wraca do kafelków, a okruszki pozwalają wrócić do listy sekcji i do kreatora', async () => {
    const { user } = renderPlan('/plan/nie-ma-takiej?dzieci=1&porod=2026-11-10&zatrudnienie=uop');
    expect(screen.getByTestId('loc')).toHaveTextContent(
      '/plan?dzieci=1&porod=2026-11-10&zatrudnienie=uop',
    );

    await user.click(screen.getByRole('link', { name: /^Kalkulator/ }));
    expect(screen.getByTestId('loc')).toHaveTextContent('/plan/calculator');
    expect(screen.getByRole('navigation', { name: 'Zakładki Twojego planu' })).toBeInTheDocument();

    const breadcrumb = within(screen.getByRole('navigation', { name: 'Ścieżka nawigacji' }));
    expect(breadcrumb.getByText('Kalkulator')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Zmień odpowiedzi' })).toHaveAttribute(
      'href',
      '/wizard?situation=afterBirth',
    );

    await user.click(breadcrumb.getByRole('link', { name: '← Twój plan' }));
    expect(screen.getByTestId('loc')).toHaveTextContent(/^\/plan\?/);
  });

  it('na stronie sekcji pokazuje zwinięte podsumowanie danych, a po rozwinięciu przelicza, aktualizuje URL i kopiuje link', async () => {
    const { user } = renderPlan(
      '/plan/calculator?zatrudnienie=uop&dzieci=1&porod=2026-11-10&podstawa=6000&wariant=combined',
    );

    const summaryRegion = within(screen.getByRole('region', { name: 'Twoje dane planu' }));
    expect(
      summaryRegion.getByText(/Urodziło się dziecko · umowa o pracę · 1 dziecko · 81,5%/i),
    ).toBeInTheDocument();

    const toggle = summaryRegion.getByRole('button', { name: 'Zmień dane' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(
      summaryRegion.queryByRole('button', { name: /Kopiuj link do planu/i }),
    ).not.toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await user.selectOptions(summaryRegion.getByLabelText('Liczba dzieci'), '2');
    expect(screen.getByTestId('loc')).toHaveTextContent('dzieci=2');
    expect(
      summaryRegion.getByText(/Urodziło się dziecko · umowa o pracę · 2 dzieci · 81,5%/i),
    ).toBeInTheDocument();

    await user.click(summaryRegion.getByRole('button', { name: 'Kopiuj link do planu' }));
    expect(
      summaryRegion.getByRole('button', { name: /Skopiowano link do planu/i }),
    ).toBeInTheDocument();
  });

  it('w pustym stanie nie zmyśla formy zatrudnienia w pasku podsumowania danych', () => {
    renderPlan('/plan/calculator');
    const summaryRegion = within(screen.getByRole('region', { name: 'Twoje dane planu' }));
    expect(
      summaryRegion.getByText(
        /Urodziło się dziecko · brak danych o ubezpieczeniu · 1 dziecko · 81,5%/i,
      ),
    ).toBeInTheDocument();
  });

  it('pokazuje wyraźny stan "Uzupełnij dane" z linkiem do kreatora zamiast zmyślonych domyślnych', () => {
    renderPlan('/plan/calculator');

    const heading = screen.getByRole('heading', {
      level: 2,
      name: /Uzupełnij dane, aby wyliczyć zasiłek/i,
    });
    expect(heading).toBeInTheDocument();
    const missingBox = heading.closest('.plan-missing-data') as HTMLElement;
    expect(within(missingBox).getByText(/Data porodu/i)).toBeInTheDocument();
    expect(
      within(missingBox).getByText(/Forma zatrudnienia \/ tytuł ubezpieczenia matki/i),
    ).toBeInTheDocument();
    const wizardLink = within(missingBox).getByRole('link', { name: /Uzupełnij dane/i });
    expect(wizardLink).toHaveAttribute('href', '/wizard?situation=afterBirth');
    expect(
      screen.getByText(/tryb demonstracyjny – obliczenia w przeglądarce/i),
    ).toBeInTheDocument();
  });

  it('kafelek Uprawnienia otwiera odpowiedź najpierw, ostrzeżenia dla JDG z zadłużeniem i link Dalej: Kalkulator', async () => {
    const { user } = renderPlan('/plan?zatrudnienie=jdg&zadluzenie=500&dzieci=1&porod=2026-11-10');

    await user.click(screen.getByRole('link', { name: /^Uprawnienia/ }));
    expect(screen.getByTestId('loc')).toHaveTextContent('/plan/entitlements');
    expect(
      screen.getByRole('heading', { level: 1, name: /Twój plan zasiłkowy i urlopowy/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /Twoje uprawnienia/i }),
    ).toBeInTheDocument();

    expect(screen.getByText(/Zadłużenie składkowe \(JDG\)/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Nie przysługuje/i).length).toBeGreaterThanOrEqual(1);
    const nextLink = screen.getByRole('link', { name: /Dalej: Kalkulator/i });
    expect(nextLink).toHaveAttribute('href', expect.stringContaining('/plan/calculator'));
  });

  it('Uprawnienia pokazują w bloku odpowiedzi status i płatnika dla obojga rodziców', () => {
    const bothDraft: ScenarioDraft = {
      situation: 'afterBirth',
      referenceDate: '2026-11-21',
      birthDate: '2026-11-10',
      childrenCount: 1,
      rateVariant: 'combined',
      mother: {
        role: 'mother',
        insuranceTitle: 'employment',
        sicknessInsurance: 'mandatory',
        insuredSince: '2020-01-01',
        benefitBase: 6903.2,
        employerInsuredCount: 150,
        wantsLeave: true,
      },
      father: {
        role: 'father',
        insuranceTitle: 'employment',
        sicknessInsurance: 'mandatory',
        insuredSince: '2019-01-01',
        benefitBase: 5000,
        employerInsuredCount: 10,
        wantsLeave: true,
      },
      special: {},
    };

    renderPlan('/plan/entitlements', bothDraft);

    const answerRegion = screen.getByRole('heading', {
      level: 2,
      name: /Twoje uprawnienia/i,
    }).parentElement as HTMLElement;
    expect(
      within(answerRegion).getByText(/Przysługuje zasiłek macierzyński – wypłaca pracodawca\./i),
    ).toBeInTheDocument();
    expect(
      within(answerRegion).getByText(/Przysługuje zasiłek macierzyński – wypłaca ZUS\./i),
    ).toBeInTheDocument();
  });

  it('przelicza kalkulator na żywo po zmianie wariantu (81,5% vs 100%+70%) i liczby dzieci oraz aktualizuje URL', async () => {
    const { user } = renderPlan(
      '/plan/calculator?zatrudnienie=uop&dzieci=1&porod=2026-11-10&podstawa=6000&wariant=combined',
    );

    expect(
      screen.getByRole('heading', { level: 2, name: /Twój szacowany zasiłek/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Otrzymasz ok\..+miesięcznie przez 52 tygodnie/i)).toBeInTheDocument();
    expect(screen.getByText(/Wariant 100% \+ 70%: łącznie/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Dalej: Plan urlopów/i })).toHaveAttribute(
      'href',
      expect.stringContaining('/plan/leave-plan'),
    );

    await user.click(screen.getByRole('button', { name: /100% \+ 70%/i }));
    expect(screen.getByTestId('loc')).toHaveTextContent('wariant=standard');
    expect(screen.getByText(/Wariant 81,5%: łącznie/i)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/Liczba dzieci w kalkulatorze/i), '2');
    expect(screen.getByTestId('loc')).toHaveTextContent('dzieci=2');
    await user.click(screen.getByText(/Zobacz okresy i kwoty/i));
    expect(await screen.findByText(/31 tyg\./i)).toBeInTheDocument();
  });

  it('automatycznie liczy podstawę z benefitBaseInputs i ciągłość ze zwolnieniem w ciąży (art. 43)', async () => {
    const draft: ScenarioDraft = {
      situation: 'pregnant',
      referenceDate: '2026-11-21',
      expectedBirthDate: '2027-03-10',
      birthDate: null,
      childrenCount: 1,
      rateVariant: 'combined',
      mother: {
        role: 'mother',
        insuranceTitle: 'employment',
        sicknessInsurance: 'mandatory',
        insuredSince: '2026-09-01',
        insuranceEndDate: null,
        benefitBase: null,
        employerInsuredCount: 30,
        age: 31,
        contributionDebt: null,
        wantsLeave: true,
      },
      father: null,
      special: { zaZyciemCertificate: false },
      pregnancySickLeave: {
        startDate: '2026-11-01',
        endDate: '2027-03-09',
        untilBirth: true,
      },
      sicknessBenefitBaseInput: {
        insuranceTitle: 'employment',
        rightArisesOn: '2026-11-01',
        incomes: [
          { month: '2026-09', grossAmount: 6000, workedDays: null, requiredWorkingDays: null },
          { month: '2026-10', grossAmount: 6000, workedDays: null, requiredWorkingDays: null },
        ],
        contractMonthlySalary: 6000,
        declaredContributionBase: null,
        previousBenefitEndDate: null,
        previousBenefitBase: null,
      },
      benefitBaseInputs: {
        mother: {
          insuranceTitle: 'employment',
          rightArisesOn: '2027-03-10',
          incomes: [],
          contractMonthlySalary: 6000,
          declaredContributionBase: null,
          previousBenefitEndDate: '2027-03-09',
          previousBenefitBase: null,
        },
      },
    };

    const { user } = renderPlan('/plan/calculator', draft);

    // Podstawa 6000 * (1 - 0.1371) = 5177,40 zł przeniesiona przez ciągłość art. 43
    expect(await screen.findByText(/Podstawę wyliczono z podanych zarobków/i)).toBeInTheDocument();
    expect(screen.getAllByText(/5\s?177,40\s?zł/i).length).toBeGreaterThanOrEqual(1);
    await user.click(screen.getByText(/Zobacz szczegóły podstawy/i));
    expect(screen.getByText(/Ustawa zasiłkowa art\. 43/i)).toBeInTheDocument();
  });

  it('obsługuje scenariusze szczególne z kreatora: hospitalizacja matki z ojcem, strata dziecka i rodzina zastępcza', async () => {
    // 1. Hospitalizacja matki + ojciec w planie (bez błędu 422)
    const hospDraft: ScenarioDraft = {
      situation: 'afterBirth',
      referenceDate: '2026-11-21',
      birthDate: '2026-11-01',
      childrenCount: 1,
      rateVariant: 'standard',
      mother: {
        role: 'mother',
        insuranceTitle: 'employment',
        sicknessInsurance: 'mandatory',
        insuredSince: '2024-05-01',
        benefitBase: 6000,
        employerInsuredCount: 25,
        wantsLeave: true,
      },
      father: {
        role: 'father',
        insuranceTitle: 'employment',
        sicknessInsurance: 'mandatory',
        insuredSince: '2024-05-01',
        benefitBase: 7000,
        employerInsuredCount: 15,
        wantsLeave: true,
      },
      special: { motherHospitalized: true },
    };

    const { unmount } = render(
      <MemoryRouter initialEntries={['/plan/calculator']}>
        <ScenarioProvider initialScenario={hospDraft}>
          <App />
        </ScenarioProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText(/pobyt matki w szpitalu/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Ojciec \/ drugi rodzic/i).length).toBeGreaterThanOrEqual(1);
    unmount();

    // 2. Rodzina zastępcza z odroczeniem obowiązku szkolnego (dziecko 8 lat < 10)
    const fosterDraft: ScenarioDraft = {
      situation: 'adoption',
      referenceDate: '2026-11-21',
      adoptionType: 'fosterFamily',
      childAcceptanceDate: '2026-11-10',
      childAgeYears: 8,
      schoolObligationDeferred: true,
      childrenCount: 1,
      rateVariant: 'standard',
      mother: {
        role: 'mother',
        insuranceTitle: 'employment',
        sicknessInsurance: 'mandatory',
        insuredSince: '2024-01-01',
        benefitBase: 5500,
        employerInsuredCount: 30,
        wantsLeave: true,
      },
      father: null,
      special: {},
    };

    render(
      <MemoryRouter initialEntries={['/plan/calculator']}>
        <ScenarioProvider initialScenario={fosterDraft}>
          <App />
        </ScenarioProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText(/Urlop na warunkach macierzyńskiego/i)).toBeInTheDocument();
    expect(screen.getByText(/nieprzenoszalną część drugiego rodzica/i)).toBeInTheDocument();
  });

  it('wyświetla kluczową odpowiedź, oś czasu, zwinięty kalendarz i liczy łączenie urlopu z pracą', async () => {
    const { user } = renderPlan(
      '/plan/leave-plan?zatrudnienie=uop&dzieci=1&porod=2026-11-10&podstawa=6000&ojciec=1&podstawaOjca=7500',
    );

    expect(
      screen.getByRole('heading', { level: 2, name: /Plan urlopów w skrócie/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /Oś czasu urlopów/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Oś czasu urlopów matki/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Oś czasu urlopów drugiego rodzica/i)).toBeInTheDocument();

    expect(await screen.findByText(/Podział zgodny z Kodeksem pracy/i)).toBeInTheDocument();
    expect(
      screen.getByText('Pokaż kalendarz dzień po dniu').closest('details'),
    ).not.toHaveAttribute('open');

    // Rozwiń ręczne układanie i włącz łączenie z pracą na 1/4 etatu dla pierwszej części urlopu rodzicielskiego (32 tyg. → +8 tyg.)
    await user.click(screen.getByText('Ułóż ręcznie / połącz z pracą'));
    const workSelects = screen.getAllByLabelText(/Praca w trakcie urlopu:/i);
    await user.selectOptions(workSelects[0], '0.25');
    expect(await screen.findByText(/Wydłużenie urlopu rodzicielskiego:/i)).toBeInTheDocument();
    expect((await screen.findAllByText(/\+8 tyg\./i)).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Powrót do pracy po tej części:/i)).toBeInTheDocument();
  });

  it('pozwala odhaczać dokumenty w zakładce Dokumenty i terminy, pokazuje płatnika dla rodziców, pasek postępu, założenia planu i link dalej', async () => {
    window.localStorage.clear();
    const bothParentsDraft: ScenarioDraft = {
      situation: 'afterBirth',
      referenceDate: '2026-11-21',
      birthDate: '2026-11-10',
      childrenCount: 1,
      rateVariant: 'combined',
      mother: {
        role: 'mother',
        insuranceTitle: 'employment',
        sicknessInsurance: 'mandatory',
        insuredSince: '2020-01-01',
        benefitBase: 6903.2,
        employerInsuredCount: 150,
        wantsLeave: true,
      },
      father: {
        role: 'father',
        insuranceTitle: 'employment',
        sicknessInsurance: 'mandatory',
        insuredSince: '2019-01-01',
        benefitBase: 5000,
        employerInsuredCount: 10,
        wantsLeave: true,
      },
      special: {},
    };

    const { user } = renderPlan('/plan/documents?situation=afterBirth', bothParentsDraft);

    expect(screen.getByRole('heading', { level: 2, name: /Co zrobić teraz/i })).toBeInTheDocument();
    expect(screen.getByText(/Następny krok:/i)).toBeInTheDocument();
    expect(screen.getByText(/U pracodawcy \(wypłaca zasiłek\)/i)).toBeInTheDocument();
    expect(screen.getByText(/W ZUS \(najwygodniej przez PUE\/eZUS\)/i)).toBeInTheDocument();

    expect(
      screen.getByRole('heading', { level: 2, name: /Lista dokumentów/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Skompletowano: 0 z/i)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]);
    expect(screen.getByText(/Skompletowano: 1 z/i)).toBeInTheDocument();

    // Najbliższy termin wyróżniony (2026-11-10 + 21 dni = 01.12.2026), pozostałe na liście (09.03.2027)
    expect(screen.getByText(/Najbliższy termin/i)).toBeInTheDocument();
    expect(screen.getAllByText(/01\.12\.2026/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/09\.03\.2027/i).length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByRole('link', { name: /Zmień podział w sekcji Plan urlopów/i }),
    ).toHaveAttribute('href', '/plan/leave-plan?situation=afterBirth');

    // Uwagi i podstawy prawne zwinięte w <details>
    const detailSummaries = screen.getAllByText(/Szczegóły i wskazówki/i);
    expect(detailSummaries[0].closest('details')).not.toHaveAttribute('open');
    expect(screen.getByText(/Podstawa prawna terminów/i).closest('details')).not.toHaveAttribute(
      'open',
    );

    const nextLink = screen.getByRole('link', { name: /Dalej: Wnioski/i });
    expect(nextLink).toHaveAttribute('href', '/plan/applications?situation=afterBirth');
  });

  it('w zakładce Dokumenty i terminy oznacza przekroczony termin i pokazuje stan brakujących danych bez zmyślonych wpisów', () => {
    window.localStorage.clear();
    const overdueDraft: ScenarioDraft = {
      situation: 'afterBirth',
      referenceDate: '2026-12-10',
      birthDate: '2026-11-10',
      childrenCount: 1,
      rateVariant: 'combined',
      mother: {
        role: 'mother',
        insuranceTitle: 'employment',
        sicknessInsurance: 'mandatory',
        insuredSince: '2020-01-01',
        benefitBase: 6903.2,
        employerInsuredCount: 150,
        wantsLeave: true,
      },
      father: null,
      special: {},
    };

    const { unmount } = render(
      <MemoryRouter initialEntries={['/plan/documents?situation=afterBirth']}>
        <ScenarioProvider initialScenario={overdueDraft}>
          <App />
        </ScenarioProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText(/Jeden z terminów już minął/i)).toBeInTheDocument();
    expect(screen.getAllByText(/\(po terminie\)/i).length).toBeGreaterThanOrEqual(1);
    unmount();

    // Pusty stan bez danych w localStorage / URL
    renderPlan('/plan/documents');
    expect(
      screen.getByRole('heading', { level: 2, name: /Uzupełnij dane do listy dokumentów/i }),
    ).toBeInTheDocument();
  });

  it('w zakładce Wnioski nie ma zmyślonych danych osobowych, waliduje puste pola, zwija podgląd i symuluje wysyłkę z UPO', async () => {
    const { user } = renderPlan(
      '/plan/applications?zatrudnienie=uop&porod=2026-11-10&podstawa=6000',
    );

    expect(
      screen.getByText(/Wniosek o skrócony odpis aktu urodzenia dziecka/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Wniosek o zasiłek macierzyński \(ZUS ZAM\)/i)).toBeInTheDocument();

    // Brak zmyślonych danych osobowych i obecność informacji o mObywatelu / ręcznym wpisie
    expect(screen.queryByDisplayValue(/Anna Kowalska/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Anna Kowalska/i)).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue(/940512/i)).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue(/PL 61/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(
        /Dane osobowe uzupełnisz po zalogowaniu przez mObywatela \(symulacja\) albo wpiszesz ręcznie – nie wysyłamy ich na serwer\./i,
      ),
    ).toBeInTheDocument();

    const nameInput = screen.getByLabelText(/Imię i nazwisko wnioskodawcy/i);
    const peselInput = screen.getByLabelText(/PESEL \(symulacja\)/i);
    const bankInput = screen.getByLabelText(/Numer rachunku do wypłaty zasiłku/i);
    expect(nameInput).toHaveValue('');
    expect(peselInput).toHaveValue('');
    expect(bankInput).toHaveValue('');

    // Podgląd wniosku zwinięty w <details>
    const previews = screen.getAllByText(/Podgląd wniosku/i);
    expect(previews.length).toBeGreaterThanOrEqual(2);
    expect(previews[0].closest('details')).not.toHaveAttribute('open');

    // Próba wysłania z pustymi danymi prosi o uzupełnienie i nie kończy się błędem
    await user.click(screen.getByRole('button', { name: /Wyślij ZUS ZAM/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/uzupełnij dane osobowe/i);
    expect(screen.queryByRole('region', { name: /Potwierdzenie wysłania ZUS ZAM/i })).toBeNull();

    // Po uzupełnieniu danych osobowych wysyłka pojedyncza i zbiorcza działają
    await user.type(nameInput, 'Janina Nowak');
    await user.type(peselInput, '90010112345');
    await user.type(bankInput, '12345678901234567890123456');

    await user.click(screen.getByRole('button', { name: /Wyślij ZUS ZAM/i }));
    const receipt = screen.getByRole('region', { name: /Potwierdzenie wysłania ZUS ZAM/i });
    expect(within(receipt).getByText(/UPO – Potwierdzenie złożenia/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Wyślij wszystkie/i }));
    expect(screen.getByRole('button', { name: /Wszystkie wnioski wysłane/i })).toBeDisabled();

    const nextLink = screen.getByRole('link', { name: /Dalej: Wsparcie/i });
    expect(nextLink).toHaveAttribute(
      'href',
      '/plan/support?zatrudnienie=uop&porod=2026-11-10&podstawa=6000',
    );
  });

  it('w zakładce Wsparcie pokazuje najpierw organizacje i linki, potem kontakt z ZUS, a na końcu Najczęstsze pytania bez etykiety AI', async () => {
    const { user } = renderPlan('/plan/support?situation=afterBirth');

    // Brak nieprawdziwego oznaczenia AI
    expect(screen.queryByText(/Wspierane przez AI/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/asystent.*AI/i)).not.toBeInTheDocument();

    // Właściwa kolejność sekcji: organizacje -> linki -> PUE/eZUS -> Najczęstsze pytania
    const orgsHeading = screen.getByRole('heading', { level: 2, name: /Organizacje pomocowe/i });
    const linksHeading = screen.getByRole('heading', {
      level: 2,
      name: /Oficjalne strony urzędowe/i,
    });
    const pueHeading = screen.getByRole('heading', {
      level: 2,
      name: /Kontakt z ZUS przez PUE \/ eZUS/i,
    });
    const faqHeading = screen.getByRole('heading', { level: 2, name: /Najczęstsze pytania/i });

    expect(orgsHeading.compareDocumentPosition(linksHeading)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(linksHeading.compareDocumentPosition(pueHeading)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(pueHeading.compareDocumentPosition(faqHeading)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    expect(screen.getByText(/Fundacja Rodzić po Ludzku/i)).toBeInTheDocument();

    // Gotowe odpowiedzi nadal działają
    await user.click(screen.getByRole('button', { name: /Kiedy opłaca się wariant 81,5%/i }));
    expect(await screen.findByText(/ujednoliconą stawkę 81,5%/i)).toBeInTheDocument();

    // Formularz PUE / eZUS nadal działa
    await user.type(
      screen.getByLabelText(/Treść pytania do doradcy ZUS/i),
      'Proszę o potwierdzenie terminu złożenia ZAM.',
    );
    await user.click(screen.getByRole('button', { name: /Wyślij pytanie do PUE \/ eZUS/i }));
    expect(screen.getByText(/Zapytanie zostało wysłane/i)).toBeInTheDocument();

    const backLink = screen.getByRole('link', { name: /Wróć do planu/i });
    expect(backLink).toHaveAttribute('href', '/plan?situation=afterBirth');
  });
});
