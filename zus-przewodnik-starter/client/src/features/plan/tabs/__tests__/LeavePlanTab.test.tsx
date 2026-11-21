import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MaternityCalculationResult, ScenarioInput } from '@shared/types';
// Te same czyste funkcje silnika, których planApi używa w trybie awaryjnym (jedno źródło obliczeń).
import {
  calculateMaternity,
  calculateParentalLeaveWithWork,
  planParentalSplit,
} from '@shared/engine';
import { DEFAULT_PARAMS } from '../../../../app/benefitParams';
import * as planApi from '../../planApi';
import { LeavePlanTab } from '../LeavePlanTab';

function makeScenario(overrides: Partial<ScenarioInput> = {}): ScenarioInput {
  return {
    situation: 'afterBirth',
    referenceDate: '2026-11-21',
    expectedBirthDate: '2026-11-10',
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
      insuredSince: '2024-01-01',
      insuranceEndDate: null,
      benefitBase: 6000,
      employerInsuredCount: 25,
      age: 30,
      contributionDebt: null,
      wantsLeave: true,
    },
    father: {
      role: 'father',
      insuranceTitle: 'employment',
      sicknessInsurance: 'mandatory',
      insuredSince: '2024-01-01',
      insuranceEndDate: null,
      benefitBase: 7500,
      employerInsuredCount: 30,
      age: 32,
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

/** Jak planApi: przy brakujących danych silnik zgłasza błąd, a zakładka dostaje pusty wynik z komunikatem. */
function maternityFor(scenario: ScenarioInput): MaternityCalculationResult {
  try {
    return calculateMaternity(scenario, DEFAULT_PARAMS);
  } catch (error) {
    return {
      periods: [],
      totalAmount: 0,
      variants: null,
      explanations: [
        { message: error instanceof Error ? error.message : String(error), legalBasis: null },
      ],
      warnings: [],
    };
  }
}

function renderTab(scenario: ScenarioInput, usingApi?: boolean) {
  const maternity = maternityFor(scenario);
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={['/plan/leave-plan']}>
      <LeavePlanTab
        scenario={scenario}
        params={DEFAULT_PARAMS}
        maternity={maternity}
        usingApi={usingApi}
      />
    </MemoryRouter>,
  );
  return { user, maternity };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('LeavePlanTab – zakładka „Plan urlopów” wewnątrz /plan', () => {
  it('renderuje oś czasu, kalendarz i planer bez własnego nagłówka strony ani duplikatu zakładek', async () => {
    vi.spyOn(planApi, 'fetchParentalSplit').mockImplementation(async (input, params) =>
      planParentalSplit(input, params),
    );

    renderTab(makeScenario(), false);

    expect(
      screen.getByRole('heading', { level: 2, name: /Oś czasu urlopów obojga rodziców/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /Kalendarz miesięczny/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /Zaplanuj podział urlopów/i }),
    ).toBeInTheDocument();

    // Brak własnego <h1> i brak własnego paska zakładek
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: /Sekcje planu/i })).not.toBeInTheDocument();

    // Notatka usingApi: false
    expect(screen.getByText(/trybie lokalnym/i)).toBeInTheDocument();

    expect(await screen.findByText(/Podział zgodny z Kodeksem pracy/i)).toBeInTheDocument();
  });

  it('nie liczy podwójnie okresów urlopu rodzicielskiego i pokazuje realne „Pozostały rodzicielski”', async () => {
    vi.spyOn(planApi, 'fetchParentalSplit').mockImplementation(async (input, params) =>
      planParentalSplit(input, params),
    );

    const { user, maternity } = renderTab(makeScenario());
    // Upewniamy się, że wynik `maternity` zawierał okresy rodzicielskie
    expect(maternity.periods.some((p) => p.leaveType === 'parentalLeave')).toBe(true);

    await screen.findByText(/Podział zgodny z Kodeksem pracy/i);

    // W klasycznym planie (Mama 32 + Tata 9) na liście okresów powinno być dokładnie 2 części rodzicielskiego (nie 4!)
    const periodList = screen.getByRole('list', { name: /Szczegółowa lista okresów urlopu/i });
    const parentalItems = within(periodList).getAllByText(/^Urlop rodzicielski$/i);
    expect(parentalItems).toHaveLength(2);

    // Przełącz na „Tylko Mama” (32 tyg.) -> Pozostały rodzicielski – Ojciec MUSI wynosić 9 tyg., nie 0!
    await user.click(screen.getByRole('button', { name: /Tylko Mama/i }));
    await waitFor(() => {
      expect(within(periodList).getAllByText(/^Urlop rodzicielski$/i)).toHaveLength(1);
    });

    const summary = screen.getByRole('region', { name: /Podsumowanie planu urlopów/i });
    expect(within(summary).getByText('9 tyg.')).toBeInTheDocument();
  });

  it('obsługuje błąd API (np. 422) bez nieskończonego ładowania i pozwala ponowić próbę', async () => {
    const splitSpy = vi
      .spyOn(planApi, 'fetchParentalSplit')
      .mockRejectedValueOnce(new Error('HTTP 422: Nieprawidłowe dane'))
      .mockImplementation(async (input, params) => planParentalSplit(input, params));

    const { user } = renderTab(makeScenario());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/HTTP 422: Nieprawidłowe dane/i);
    // Ładowanie MUSI się zakończyć
    expect(screen.queryByText(/Przeliczanie planu urlopów/i)).not.toBeInTheDocument();

    // Kliknięcie „Spróbuj ponownie” pobiera wynik poprawnie
    await user.click(screen.getByRole('button', { name: /Spróbuj ponownie/i }));
    expect(await screen.findByText(/Podział zgodny z Kodeksem pracy/i)).toBeInTheDocument();
    expect(splitSpy).toHaveBeenCalledTimes(2);
  });

  it('pokazuje stan „uzupełnij dane” z linkiem do /wizard?situation=… gdy brakuje daty lub ubezpieczenia', () => {
    const missingDateScenario = makeScenario({
      situation: 'pregnant',
      birthDate: null,
      expectedBirthDate: null,
    });

    renderTab(missingDateScenario);

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /Uzupełnij dane, aby przygotować plan urlopów/i,
      }),
    ).toBeInTheDocument();
    const wizardLink = screen.getByRole('link', { name: /Uzupełnij dane w kreatorze/i });
    expect(wizardLink).toHaveAttribute('href', '/wizard?situation=pregnant');
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
  });

  it('pokazuje ostrzeżenie z linkiem do kreatora i nie wymyśla kwot, gdy brakuje podstawy wymiaru', async () => {
    vi.spyOn(planApi, 'fetchParentalSplit').mockImplementation(async (input, params) =>
      planParentalSplit(input, params),
    );

    const noBaseScenario = makeScenario({
      mother: { ...makeScenario().mother, benefitBase: null },
    });

    renderTab(noBaseScenario);

    expect(await screen.findByText(/Brak podstawy wymiaru zasiłku dla Matki/i)).toBeInTheDocument();
    const wizardLink = screen.getByRole('link', { name: /Uzupełnij dane w kreatorze/i });
    expect(wizardLink).toHaveAttribute('href', '/wizard?situation=afterBirth');
  });

  it('przy łączeniu urlopu rodzicielskiego z pracą pokazuje obie części (praca + wydłużenie) i datę powrotu do pracy', async () => {
    vi.spyOn(planApi, 'fetchParentalSplit').mockImplementation(async (input, params) =>
      planParentalSplit(input, params),
    );
    vi.spyOn(planApi, 'fetchParentalWithWork').mockImplementation(async (input, params) =>
      calculateParentalLeaveWithWork(input, params),
    );

    const { user } = renderTab(makeScenario());
    await screen.findByText(/Podział zgodny z Kodeksem pracy/i);

    const workSelects = screen.getAllByLabelText(/Praca w trakcie urlopu:/i);
    await user.selectOptions(workSelects[0], '0.5');

    expect(await screen.findByText(/Część 1 – praca 1\/2 etatu/i)).toBeInTheDocument();
    expect(screen.getByText(/Część 2 – proporcjonalne wydłużenie/i)).toBeInTheDocument();
    expect(screen.getByText(/Powrót do pracy po tej części:/i)).toBeInTheDocument();
    // Okres wydłużenia pojawia się też na szczegółowej liście okresów osi czasu
    expect(screen.getAllByText(/wydłużenie po pracy/i).length).toBeGreaterThanOrEqual(1);
  });

  it('w trudnej sytuacji (martwe urodzenie 1 dziecka) nie pokazuje urlopu rodzicielskiego ani wykrzykników', async () => {
    vi.spyOn(planApi, 'fetchParentalSplit').mockImplementation(async (input, params) =>
      planParentalSplit(input, params),
    );

    const sensitiveScenario = makeScenario({
      special: { ...makeScenario().special, stillbirth: true },
    });

    renderTab(sensitiveScenario);

    expect(
      screen.getAllByText(/Urlop rodzicielski nie przysługuje/i).length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole('button', { name: /Najpierw Mama/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Gratulacje/i)).not.toBeInTheDocument();
  });

  it('oznacza minione terminy na osi czasu oraz w szczegółach dnia w kalendarzu', async () => {
    vi.spyOn(planApi, 'fetchParentalSplit').mockImplementation(async (input, params) =>
      planParentalSplit(input, params),
    );

    // Poród 2026-10-01, referenceDate 2026-11-21 -> termin 21 dni (22.10.2026) już minął
    const pastDeadlineScenario = makeScenario({
      birthDate: '2026-10-01',
      referenceDate: '2026-11-21',
    });

    const { user } = renderTab(pastDeadlineScenario);
    await screen.findByText(/Podział zgodny z Kodeksem pracy/i);

    const milestonesBox = screen.getByLabelText(/Ważne daty i terminy wniosków/i);
    const pastChip = within(milestonesBox).getByRole('button', { name: /Termin minął.*81,5%/i });
    expect(pastChip).toBeInTheDocument();

    await user.click(pastChip);
    expect(
      screen.getByText(/Ten termin \(22\.10\.2026\) przypadł przed datą odniesienia/i),
    ).toBeInTheDocument();
  });

  it('obsługuje adopcję (urlop na warunkach macierzyńskiego i walidację limitu wieku)', async () => {
    vi.spyOn(planApi, 'fetchParentalSplit').mockImplementation(async (input, params) =>
      planParentalSplit(input, params),
    );

    const adoptionScenario = makeScenario({
      situation: 'adoption',
      birthDate: null,
      expectedBirthDate: null,
      adoptionType: 'fosterFamily',
      childAcceptanceDate: '2026-11-10',
      childAgeYears: 8,
      schoolObligationDeferred: false,
    });

    renderTab(adoptionScenario);

    expect(
      await screen.findByText(/Wiek dziecka \(8 lat\) osiąga lub przekracza limit ustawowy/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Przyjęcie dziecka/i })).toBeInTheDocument();
  });
});
