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
  it('na /plan pokazuje 6 kafelków sekcji, każdy prowadzi do swojej zakładki z zachowaniem scenariusza', () => {
    renderPlan('/plan?zatrudnienie=uop&dzieci=2&porod=2026-11-10');

    expect(screen.getByTestId('loc')).toHaveTextContent(
      '/plan?zatrudnienie=uop&dzieci=2&porod=2026-11-10',
    );
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
      expect(tiles[index]).toHaveAttribute(
        'href',
        `/plan/${id}?zatrudnienie=uop&dzieci=2&porod=2026-11-10`,
      );
    });
    expect(
      screen.queryByRole('navigation', { name: 'Zakładki Twojego planu' }),
    ).not.toBeInTheDocument();
  });

  it('nieznana sekcja wraca do kafelków, a z sekcji można wrócić do listy sekcji', async () => {
    const { user } = renderPlan('/plan/nie-ma-takiej?dzieci=1&porod=2026-11-10&zatrudnienie=uop');
    expect(screen.getByTestId('loc')).toHaveTextContent(
      '/plan?dzieci=1&porod=2026-11-10&zatrudnienie=uop',
    );

    await user.click(screen.getByRole('link', { name: /^Kalkulator/ }));
    expect(screen.getByTestId('loc')).toHaveTextContent('/plan/calculator');
    expect(screen.getByRole('navigation', { name: 'Zakładki Twojego planu' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: '← Wszystkie sekcje planu' }));
    expect(screen.getByTestId('loc')).toHaveTextContent(/^\/plan\?/);
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

  it('wyświetla oś czasu, kalendarz, waliduje podział urlopu rodzicielskiego i liczy łączenie urlopu z pracą', async () => {
    const { user } = renderPlan(
      '/plan/leave-plan?zatrudnienie=uop&dzieci=1&porod=2026-11-10&podstawa=6000&ojciec=1&podstawaOjca=7500',
    );

    expect(
      screen.getByRole('heading', { level: 2, name: /Oś czasu urlopów obojga rodziców/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /Kalendarz miesięczny/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Oś czasu urlopów matki/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Oś czasu urlopów drugiego rodzica/i)).toBeInTheDocument();

    expect(await screen.findByText(/Podział zgodny z Kodeksem pracy/i)).toBeInTheDocument();

    // Włącz łączenie z pracą na 1/4 etatu dla pierwszej części urlopu rodzicielskiego (32 tyg. → +8 tyg.)
    const workSelects = screen.getAllByLabelText(/Praca w trakcie urlopu:/i);
    await user.selectOptions(workSelects[0], '0.25');
    expect(await screen.findByText(/Wydłużenie urlopu rodzicielskiego:/i)).toBeInTheDocument();
    expect((await screen.findAllByText(/\+8 tyg\./i)).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Powrót do pracy po tej części:/i)).toBeInTheDocument();
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
    // 2026-11-10 + 21 dni = 01.12.2026
    expect(screen.getAllByText(/01\.12\.2026/i).length).toBeGreaterThanOrEqual(1);
    // Urlop rodzicielski: 2026-11-10 + 140 dni - 21 dni = 09.03.2027
    expect(screen.getAllByText(/09\.03\.2027/i).length).toBeGreaterThanOrEqual(1);
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

    await user.click(screen.getByRole('button', { name: /Kiedy opłaca się wariant 81,5%/i }));
    expect(await screen.findByText(/ujednoliconą stawkę 81,5%/i)).toBeInTheDocument();

    await user.type(
      screen.getByLabelText(/Treść pytania do doradcy ZUS/i),
      'Proszę o potwierdzenie terminu złożenia ZAM.',
    );
    await user.click(screen.getByRole('button', { name: /Wyślij pytanie do PUE \/ eZUS/i }));
    expect(screen.getByText(/Zapytanie zostało wysłane/i)).toBeInTheDocument();
  });
});
