import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ScenarioProvider,
  MANUAL_FORM_STORAGE_KEY,
  SCENARIO_STORAGE_KEY,
} from '../../../app/ScenarioContext';
import { App } from '../../../app/App';

const memory = new Map<string, string>();

beforeEach(() => {
  memory.clear();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
    },
  });
});
afterEach(cleanup);

function renderWizard(situation = 'pregnant') {
  const view = render(
    <MemoryRouter initialEntries={[`/wizard?situation=${situation}`]}>
      <ScenarioProvider>
        <App />
      </ScenarioProvider>
    </MemoryRouter>,
  );
  const user = userEvent.setup();
  const next = () => user.click(screen.getByRole('button', { name: /^Dalej/ }));
  const choice = async (name: string | RegExp) => {
    await user.click(screen.getByRole('radio', { name }));
    await next();
  };
  const skip = async () => {
    await user.click(screen.getByRole('checkbox'));
    await next();
  };
  const input = async (value: string) => {
    const field = screen.queryByRole('spinbutton') ?? screen.getByPlaceholderText('DD/MM/YYYY');
    await user.type(
      field,
      /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split('-').reverse().join('/') : value,
    );
    await next();
  };
  return { ...view, user, next, choice, skip, input };
}

describe('family wizard', () => {
  it('saves separate parents, preserves unknowns and resumes the current question', async () => {
    let view = renderWizard();
    await view.choice(/^Dwoje rodziców/);
    const date = screen.getByPlaceholderText('DD/MM/YYYY');
    await view.user.type(date, '01042');
    expect(date).toHaveValue('01/04/2');
    await view.user.type(date, '{Backspace}2027');
    expect(date).toHaveValue('01/04/2027');
    await view.next();
    await view.user.click(screen.getByRole('button', { name: 'Wstecz' }));
    expect(screen.getByPlaceholderText('DD/MM/YYYY')).toHaveValue('01/04/2027');
    await view.next();
    await view.input('2');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Za życiem');
    await view.choice('Nie');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('dotyczy mamy');
    await view.choice('Nie dotyczy');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('sytuacja zawodowa mamy');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40');
    await view.choice('Umowa o pracę');
    await view.input('2025-01-01');
    view.unmount();
    view = renderWizard();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('data końca umowy mamy');
    await view.skip();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Ile osób pracodawca mamy');
    await view.input('150');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Ile lat ma mama');
    await view.input('31');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('upadłości lub likwidacji');
    await view.choice('Nie');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('zwolnieniu lekarskim');
    await view.choice('Tak');
    await view.input('2026-10-01');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('aż do porodu');
    await view.choice('Tak');
    await view.choice('Działalność gospodarcza');
    await view.choice('Nie wiem / uzupełnię później');
    await view.skip();
    await view.choice('Tak');
    await view.skip();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'wynagrodzenie brutto mamy',
    );
    await view.input('8000');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('według umowy');
    await view.input('8200');
    await view.choice('Nie wiem / uzupełnię później');
    await view.input('5000');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('zasiłek macierzyński');
    await view.choice(/^81,5%/);
    expect(screen.getByRole('heading', { name: 'Sprawdźcie odpowiedzi' })).toBeInTheDocument();
    expect(screen.getByText('01/04/2027')).toBeInTheDocument();
    await view.user.click(screen.getByRole('button', { name: 'Zapisz odpowiedzi' }));
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    const stored = JSON.parse(memory.get(SCENARIO_STORAGE_KEY) ?? '{}');
    expect(stored).toMatchObject({
      situation: 'pregnant',
      childrenCount: 2,
      expectedBirthDate: '2027-04-01',
      birthDate: null,
      rateVariant: 'combined',
      mother: {
        role: 'mother',
        insuranceTitle: 'employment',
        sicknessInsurance: 'mandatory',
        insuredSince: '2025-01-01',
        benefitBase: null,
        employerInsuredCount: 150,
        age: 31,
        wantsLeave: true,
      },
      father: {
        role: 'father',
        insuranceTitle: 'selfEmployed',
        contributionDebt: null,
        benefitBase: 5000,
      },
      special: {
        zaZyciemCertificate: false,
        motherHospitalized: false,
        motherIncapableOfIndependentLiving: false,
        motherDeceased: false,
        employerBankruptcyOrLiquidation: false,
      },
    });
    // nieznana podstawa mamy → dane do wyliczenia podstawy z zarobków
    expect(stored.pregnancySickLeave).toEqual({
      startDate: '2026-10-01',
      untilBirth: true,
      endDate: '2027-03-31',
    });
    expect(stored.benefitBaseInputs.mother).toMatchObject({
      insuranceTitle: 'employment',
      rightArisesOn: '2027-04-01',
      contractMonthlySalary: 8200,
      declaredContributionBase: null,
      // zwolnienie do porodu → silnik może przejąć podstawę zasiłku chorobowego
      previousBenefitEndDate: '2027-03-31',
    });
    expect(stored.sicknessBenefitBaseInput).toMatchObject({
      rightArisesOn: '2026-10-01',
      previousBenefitEndDate: null,
    });
    expect(stored.sicknessBenefitBaseInput.incomes[0].month).toBe('2025-10');
    expect(stored.sicknessBenefitBaseInput.incomes).toHaveLength(12);
    expect(stored.benefitBaseInputs.mother.incomes).toHaveLength(12);
    expect(stored.benefitBaseInputs.mother.incomes[0]).toMatchObject({
      month: '2026-04',
      grossAmount: 8000,
    });
    expect(stored.benefitBaseInputs).not.toHaveProperty('father');
    expect(stored.father).not.toHaveProperty('sicknessInsurance');
    expect(stored.father).not.toHaveProperty('wantsLeave');
    expect(
      JSON.parse(memory.get(MANUAL_FORM_STORAGE_KEY) ?? '{}').answers['father.wantsLeave'],
    ).toBe('unknown');
  });

  it('completes the postbirth path for a single father without inventing a mother', async () => {
    const view = renderWizard('afterBirth');
    await view.choice(/^Samodzielnie — tata/);
    await view.input('2026-01-10');
    await view.input('1');
    await view.choice('Nie dotyczy');
    await view.choice('Tak');
    await view.input('35');
    await view.input('2100');
    await view.input('8');
    await view.choice('Nie');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('dotyczy mamy');
    await view.choice('Mama zmarła');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('sytuacja zawodowa taty');
    await view.choice('Brak tytułu do ubezpieczenia chorobowego');
    await view.choice('Tak');
    await view.choice('Jeszcze nie wiemy – pokażcie porównanie');
    expect(screen.getByRole('heading', { name: 'Sprawdźcie odpowiedzi' })).toBeInTheDocument();
    await view.user.click(screen.getByRole('button', { name: 'Zapisz odpowiedzi' }));
    const stored = JSON.parse(memory.get(SCENARIO_STORAGE_KEY) ?? '{}');
    expect(stored.mother).toBeNull();
    expect(stored.father).toMatchObject({ role: 'father', wantsLeave: true });
    expect(stored.special).toMatchObject({
      pregnancyWeekAtBirth: 35,
      birthWeightGrams: 2100,
      hospitalizationDays: 8,
      zaZyciemCertificate: false,
      stillbirth: false,
      childDeathDate: null,
      motherDeceased: true,
    });
    expect(stored).not.toHaveProperty('rateVariant');
  });

  it('after a stillbirth skips hospital, „Za życiem” and rate questions and records it', async () => {
    const view = renderWizard('afterBirth');
    await view.choice(/^Samodzielnie — mama/);
    await view.input('2026-01-10');
    await view.input('1');
    await view.choice('Dziecko urodziło się martwe');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('sytuacja zawodowa mamy');
    await view.choice('Brak tytułu do ubezpieczenia chorobowego');
    await view.choice('Tak');
    expect(screen.getByRole('heading', { name: 'Sprawdźcie odpowiedzi' })).toBeInTheDocument();
    await view.user.click(screen.getByRole('button', { name: 'Zapisz odpowiedzi' }));
    const stored = JSON.parse(memory.get(SCENARIO_STORAGE_KEY) ?? '{}');
    expect(stored.special).toEqual({ stillbirth: true, childDeathDate: null });
  });

  it('removes hidden parent data when the family selection is edited', async () => {
    const view = renderWizard('planning');
    await view.choice(/^Dwoje rodziców/);
    await view.skip();
    await view.skip();
    await view.choice('Brak tytułu do ubezpieczenia chorobowego');
    await view.choice('Brak tytułu do ubezpieczenia chorobowego');
    await view.choice('Tak');
    await view.choice('Nie');
    await view.choice('Jeszcze nie wiemy – pokażcie porównanie');
    await view.user.click(screen.getByRole('button', { name: 'Zmień: Rodzina' }));
    await view.user.click(screen.getByRole('radio', { name: /^Samodzielnie — mama/ }));
    await view.user.click(screen.getByRole('button', { name: /Wróć do podsumowania/ }));
    expect(screen.queryByText('Zatrudnienie taty')).not.toBeInTheDocument();
    expect(JSON.parse(memory.get(SCENARIO_STORAGE_KEY) ?? '{}').father).toBeNull();
    expect(JSON.parse(memory.get(MANUAL_FORM_STORAGE_KEY) ?? '{}').answers).not.toHaveProperty(
      'father.insuranceTitle',
    );
  });

  it('validates required questions and lets users go back without losing answers', async () => {
    const view = renderWizard();
    await view.next();
    expect(screen.getByRole('alert')).toHaveTextContent('Odpowiedz na pytanie');
    await view.choice(/^Samodzielnie — mama/);
    await view.skip();
    await view.input('0');
    expect(screen.getByRole('alert')).toHaveTextContent('nie mniejszą niż 1');
    await view.user.click(screen.getByRole('button', { name: 'Wstecz' }));
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('clears answers and starts from family selection for a different situation', async () => {
    const view = renderWizard();
    await view.choice(/^Samodzielnie — mama/);
    await view.skip();
    await view.user.click(screen.getByRole('link', { name: /Strona startowa/ }));
    await view.user.click(screen.getByRole('radio', { name: 'Adopcja lub rodzina zastępcza' }));
    await view.user.click(screen.getByRole('button', { name: 'Kontynuuj bez logowania' }));
    expect(
      screen.getByRole('heading', { name: 'Dla kogo przygotowujemy plan?' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
    expect(memory.has(MANUAL_FORM_STORAGE_KEY)).toBe(false);
  });

  it('requires confirmation to delete all saved answers', async () => {
    const view = renderWizard();
    await view.choice(/^Samodzielnie — tata/);
    await view.user.click(screen.getByRole('button', { name: 'Usuń zapisane odpowiedzi' }));
    expect(memory.has(MANUAL_FORM_STORAGE_KEY)).toBe(true);
    await view.user.click(screen.getByRole('button', { name: 'Tak, usuń odpowiedzi' }));
    expect(memory.has(SCENARIO_STORAGE_KEY)).toBe(false);
    expect(memory.has(MANUAL_FORM_STORAGE_KEY)).toBe(false);
    expect(screen.getByRole('heading', { name: 'W jakiej jesteś sytuacji?' })).toBeInTheDocument();
  });

  it('keeps the form usable and reports when persistent storage is blocked', async () => {
    window.localStorage.setItem = () => {
      throw new Error('Storage blocked');
    };
    const view = renderWizard();
    await view.choice(/^Samodzielnie — mama/);
    expect(screen.getByRole('status')).toHaveTextContent('Zapis na urządzeniu jest niedostępny');
    expect(
      screen.getByRole('heading', { name: 'Jaki jest przewidywany termin porodu?' }),
    ).toBeInTheDocument();
  });
});
