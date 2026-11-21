import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import type { DocumentChecklist, ScenarioInput } from '@shared/types';
import { getRequiredDocuments } from '@shared/engine';
import { DEFAULT_PARAMS } from '../../../app/benefitParams';
import { DocumentsTab } from '../../plan/tabs/DocumentsTab';

function makeScenario(overrides: Partial<ScenarioInput> = {}): ScenarioInput {
  return {
    situation: 'afterBirth',
    referenceDate: '2026-11-21',
    expectedBirthDate: null,
    birthDate: '2026-11-10',
    childrenCount: 1,
    adoptionType: null,
    childAcceptanceDate: null,
    childAgeYears: null,
    schoolObligationDeferred: false,
    rateVariant: 'combined',
    mother: {
      role: 'mother',
      insuranceTitle: 'employment',
      sicknessInsurance: 'mandatory',
      insuredSince: '2020-01-01',
      insuranceEndDate: null,
      benefitBase: 6903.2,
      employerInsuredCount: 150,
      age: 31,
      contributionDebt: null,
      wantsLeave: true,
    },
    father: {
      role: 'father',
      insuranceTitle: 'employment',
      sicknessInsurance: 'mandatory',
      insuredSince: '2019-01-01',
      insuranceEndDate: null,
      benefitBase: 5000,
      employerInsuredCount: 10,
      age: 33,
      contributionDebt: null,
      wantsLeave: true,
    },
    special: {
      zaZyciemCertificate: false,
      pregnancyWeekAtBirth: null,
      birthWeightGrams: null,
      hospitalizationDays: null,
      stillbirth: false,
      childDeathDate: null,
      motherHospitalized: false,
      motherIncapableOfIndependentLiving: false,
      motherDeceased: false,
      employerBankruptcyOrLiquidation: false,
    },
    ...overrides,
  };
}

function renderTab(props: {
  scenario?: ScenarioInput;
  checklist?: DocumentChecklist;
  missingFields?: string[];
  wizardHref?: string;
  initialEntry?: string;
}) {
  const scenario = props.scenario;
  const checklist =
    props.checklist ??
    (scenario
      ? getRequiredDocuments(scenario, DEFAULT_PARAMS)
      : { payer: 'zus', documents: [], deadlines: [] });

  return render(
    <MemoryRouter initialEntries={[props.initialEntry ?? '/plan/documents?situation=afterBirth']}>
      <DocumentsTab
        checklist={checklist}
        scenario={scenario}
        params={DEFAULT_PARAMS}
        missingFields={props.missingFields}
        wizardHref={props.wizardHref}
      />
    </MemoryRouter>,
  );
}

afterEach(() => {
  window.localStorage.clear();
});

describe('DocumentsTab – dokumenty, terminy, płatnik per rodzic i stany szczególne', () => {
  it('pokazuje płatnika i sposób złożenia osobno dla matki (>20: pracodawca) i ojca (<=20: ZUS), grupuje listę z silnika i aktualizuje pasek postępu', async () => {
    const user = userEvent.setup();
    const scenario = makeScenario();
    renderTab({ scenario });

    const payersSection = screen
      .getByRole('heading', { level: 2, name: /Co zrobić teraz/i })
      .closest('section') as HTMLElement;
    expect(within(payersSection).getByText(/Matka składa dokumenty/i)).toBeInTheDocument();
    expect(
      within(payersSection).getByText(/U pracodawcy \(wypłaca zasiłek\)/i),
    ).toBeInTheDocument();
    expect(within(payersSection).getByText(/Ojciec składa dokumenty/i)).toBeInTheDocument();
    expect(
      within(payersSection).getByText(/W ZUS \(najwygodniej przez PUE\/eZUS\)/i),
    ).toBeInTheDocument();
    expect(
      within(payersSection).getAllByText(/PUE\/eZUS \(symulacja\)/i).length,
    ).toBeGreaterThanOrEqual(1);

    // Grupy dokumentów z silnika
    expect(screen.getByRole('heading', { level: 3, name: /Dokumenty matki/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: /Dokumenty ojca/i })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: /Załączniki i dokumenty stanu cywilnego/i }),
    ).toBeInTheDocument();

    // Postęp i odhaczanie + czyszczenie
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '0');
    const resetBtn = screen.getByRole('button', { name: /Wyczyść zaznaczenia/i });
    expect(resetBtn).toBeDisabled();

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]);
    expect(Number(progressBar.getAttribute('aria-valuenow'))).toBeGreaterThan(0);
    expect(resetBtn).toBeEnabled();

    await user.click(resetBtn);
    expect(progressBar).toHaveAttribute('aria-valuenow', '0');
    expect(resetBtn).toBeDisabled();

    // Transparentna informacja o domyślnym planie i link do Planu urlopów
    const leavePlanLink = screen.getByRole('link', {
      name: /Zmień podział w sekcji Plan urlopów/i,
    });
    expect(leavePlanLink).toHaveAttribute('href', '/plan/leave-plan?situation=afterBirth');

    // Zakończenie linkiem Dalej: Wnioski
    expect(screen.getByRole('link', { name: /Dalej: Wnioski/i })).toHaveAttribute(
      'href',
      '/plan/applications?situation=afterBirth',
    );
  });

  it('oznacza przekroczone terminy względem scenario.referenceDate w kroku głównym, alercie, checkliście i liście terminów', () => {
    const scenario = makeScenario({
      referenceDate: '2026-12-10', // po 01.12.2026 (21 dni od 10.11.2026)
      birthDate: '2026-11-10',
    });
    renderTab({ scenario });

    const hero = screen
      .getByRole('heading', { level: 2, name: /Co zrobić teraz/i })
      .closest('section') as HTMLElement;
    expect(within(hero).getByText('Termin minął')).toBeInTheDocument();
    expect(within(hero).getByText(/01\.12\.2026 już minął/i)).toBeInTheDocument();

    const alerts = screen.getAllByRole('alert');
    expect(alerts.some((el) => /Jeden z terminów już minął/i.test(el.textContent ?? ''))).toBe(
      true,
    );
    expect(screen.getAllByText(/\(po terminie\)/i).length).toBeGreaterThanOrEqual(2);
  });

  it('wyświetla dokumenty chorobowe w ciąży (e-ZLA kod „B” automatycznie oraz ścieżki pracodawca / ZUS: Z-3 + ZAS-12, Z-3a, ZAS-53)', () => {
    // 1. Etat w małej firmie (ZUS wypłaca: e-ZLA + Z-3 / ZAS-12)
    const smallEmpPregnant = makeScenario({
      situation: 'pregnant',
      birthDate: null,
      expectedBirthDate: '2027-03-10',
      father: null,
      mother: {
        role: 'mother',
        insuranceTitle: 'employment',
        sicknessInsurance: 'mandatory',
        insuredSince: '2025-01-01',
        insuranceEndDate: null,
        benefitBase: 6000,
        employerInsuredCount: 10,
        age: 30,
        contributionDebt: null,
        wantsLeave: true,
      },
    });
    const { unmount } = renderTab({ scenario: smallEmpPregnant });
    expect(
      screen.getByRole('heading', {
        level: 3,
        name: /Zwolnienie lekarskie w ciąży \(e-ZLA, kod „B”\)/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Automatycznie \(e-ZLA\)/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/ZUS Z-3 \(oraz ZAS-12 na dalszy okres\)/i)).toBeInTheDocument();
    unmount();

    // 2. JDG w ciąży (e-ZLA + ZAS-53, formularze po 24.10.2026 bez Z-3b)
    const jdgPregnant = makeScenario({
      situation: 'pregnant',
      birthDate: null,
      expectedBirthDate: '2027-03-10',
      father: null,
      mother: {
        role: 'mother',
        insuranceTitle: 'selfEmployed',
        sicknessInsurance: 'voluntary',
        insuredSince: '2025-01-01',
        insuranceEndDate: null,
        benefitBase: 5500,
        employerInsuredCount: null,
        age: 32,
        contributionDebt: 0,
        wantsLeave: true,
      },
    });
    renderTab({ scenario: jdgPregnant });
    expect(screen.getByText(/Wniosek o zasiłek chorobowy ZUS ZAS-53/i)).toBeInTheDocument();
    expect(
      screen.getAllByText(/Wniosek o zasiłek macierzyński \(formularz ZUS ZAM\)/i).length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Zmiany w formularzach ZUS \(od 24\.10\.2026\)/i)).toBeInTheDocument();
  });

  it('obsługuje umowę zlecenie (Z-3a / zleceniodawca), nieznaną wielkość firmy i przejęcie urlopu przy zgonie matki', () => {
    const mandatePregnant = makeScenario({
      situation: 'pregnant',
      birthDate: null,
      expectedBirthDate: '2027-03-10',
      father: null,
      mother: {
        role: 'mother',
        insuranceTitle: 'mandateContract',
        sicknessInsurance: 'voluntary',
        insuredSince: '2025-01-01',
        insuranceEndDate: null,
        benefitBase: 4500,
        employerInsuredCount: null,
        age: 29,
        contributionDebt: null,
        wantsLeave: true,
      },
    });
    const { unmount } = renderTab({ scenario: mandatePregnant });
    expect(
      screen.getByText(/W ZUS \(nie podano liczby ubezpieczonych – przyjęto ZUS\)/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Zaświadczenie płatnika składek ZUS Z-3a do zasiłku chorobowego/i),
    ).toBeInTheDocument();
    unmount();

    const motherDeceased = makeScenario({
      special: {
        zaZyciemCertificate: false,
        pregnancyWeekAtBirth: null,
        birthWeightGrams: null,
        hospitalizationDays: null,
        stillbirth: false,
        childDeathDate: null,
        motherHospitalized: false,
        motherIncapableOfIndependentLiving: false,
        motherDeceased: true,
        employerBankruptcyOrLiquidation: false,
      },
    });
    const { container } = renderTab({ scenario: motherDeceased });
    expect(screen.queryByText(/Matka składa dokumenty/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Ojciec składa dokumenty/i)).toBeInTheDocument();
    expect(container.textContent).not.toContain('!');
  });

  it('pokazuje załączniki z silnika („Za życiem”, szpital dla urlopu uzupełniającego) oraz spokojny komunikat bez wykrzykników przy martwym urodzeniu', () => {
    // 1. Za życiem + hospitalizacja
    const specialScenario = makeScenario({
      father: null,
      special: {
        zaZyciemCertificate: true,
        pregnancyWeekAtBirth: 30,
        birthWeightGrams: 1400,
        hospitalizationDays: 21,
        stillbirth: false,
        childDeathDate: null,
        motherHospitalized: false,
        motherIncapableOfIndependentLiving: false,
        motherDeceased: false,
        employerBankruptcyOrLiquidation: false,
      },
    });
    const { unmount } = renderTab({ scenario: specialScenario });
    expect(screen.getByText(/Zaświadczenie lekarskie „Za życiem”/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Zaświadczenie ze szpitala o okresie hospitalizacji/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Skrócony odpis aktu urodzenia dziecka/i)).toBeInTheDocument();
    unmount();

    // 2. Martwe urodzenie – spokojny ton, brak wykrzykników, brak terminów rodzicielskiego
    const stillbirthScenario = makeScenario({
      father: null,
      special: {
        zaZyciemCertificate: false,
        pregnancyWeekAtBirth: null,
        birthWeightGrams: null,
        hospitalizationDays: null,
        stillbirth: true,
        childDeathDate: null,
        motherHospitalized: false,
        motherIncapableOfIndependentLiving: false,
        motherDeceased: false,
        employerBankruptcyOrLiquidation: false,
      },
    });
    const { container } = renderTab({ scenario: stillbirthScenario });
    expect(screen.getAllByText(/adnotacją o martwym urodzeniu/i).length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText(/nie występują odrębne terminy na urlop rodzicielski ani ojcowski/i),
    ).toBeInTheDocument();
    expect(container.textContent).not.toContain('!');
  });

  it('pokazuje wyraźny stan brakujących danych oraz pustej listy dokumentów bez zmyślania pozycji', () => {
    const { unmount } = renderTab({
      missingFields: ['Data porodu', 'Forma zatrudnienia / tytuł ubezpieczenia matki'],
      wizardHref: '/wizard?situation=afterBirth',
    });
    expect(
      screen.getByRole('heading', { level: 2, name: /Uzupełnij dane do listy dokumentów/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('Data porodu')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Uzupełnij dane/i })).toHaveAttribute(
      'href',
      '/wizard?situation=afterBirth',
    );
    unmount();

    // Pusta lista dokumentów z silnika
    renderTab({
      checklist: { payer: 'zus', documents: [], deadlines: [] },
      wizardHref: '/wizard?situation=afterBirth',
    });
    expect(
      screen.getByRole('heading', { level: 2, name: /Brak dokumentów do złożenia/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Wszystkie dokumenty z listy masz odhaczone/i),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Uzupełnij dane/i })).toHaveAttribute(
      'href',
      '/wizard?situation=afterBirth',
    );
  });
});
