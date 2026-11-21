import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockProfileSummary, ZusData } from '@shared/types';
import { ScenarioProvider } from '../../../app/ScenarioContext';
import { WizardPage } from '../../wizard/WizardPage';
import { LoginPage } from '../LoginPage';

const profilesFixture: MockProfileSummary[] = [
  {
    profileId: 'katarzyna-jdg-dlug',
    label: 'Katarzyna Kowalska – działalność gospodarcza (JDG), zaległość składkowa',
  },
  {
    profileId: 'anna-uop',
    label: 'Anna Nowak – umowa o pracę (> 20 osób), zwolnienie e-ZLA (kod „B”)',
  },
];

const katarzynaZusData: ZusData = {
  profile: {
    profileId: 'katarzyna-jdg-dlug',
    firstName: 'Katarzyna',
    lastName: 'Kowalska',
    pesel: '93071900042',
    birthDate: '1993-07-19',
    mother: {
      role: 'mother',
      insuranceTitle: 'selfEmployed',
      sicknessInsurance: 'voluntary',
      insuredSince: '2024-01-01',
      insuranceEndDate: null,
      benefitBase: null,
      employerInsuredCount: null,
      age: 33,
      contributionDebt: 680.5,
      wantsLeave: true,
    },
  },
  incomes: [
    { month: '2026-08', grossAmount: 5203.8, workedDays: null, requiredWorkingDays: null },
    { month: '2026-09', grossAmount: 5203.8, workedDays: null, requiredWorkingDays: null },
  ],
  sickLeaveCertificates: [
    {
      id: 'EZLA-2026-10-3310',
      startDate: '2026-10-01',
      endDate: '2026-11-05',
      pregnancyCode: true,
    },
  ],
  contributionDebt: 680.5,
};

function stubMockApi() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.endsWith('/api/v1/mock/profiles')) {
      return new Response(JSON.stringify({ data: profilesFixture, error: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.endsWith('/api/v1/mock/login')) {
      return new Response(
        JSON.stringify({
          data: { sessionToken: 'mock-token-123', profile: katarzynaZusData.profile },
          error: null,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    if (url.endsWith('/api/v1/mock/zus-data')) {
      const headers = new Headers(init?.headers);
      if (headers.get('Authorization') !== 'Bearer mock-token-123') {
        return new Response(
          JSON.stringify({
            data: null,
            error: { code: 'UNAUTHORIZED', message: 'Brak tokenu' },
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({ data: katarzynaZusData, error: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(
      JSON.stringify({ data: null, error: { code: 'NOT_FOUND', message: 'Not found' } }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    );
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('LoginPage – symulacja mObywatela, danych ZUS, zadłużenia JDG i e-ZLA', () => {
  it('pobiera profile, loguje z Bearer tokenem, pokazuje zaświadczenie o zadłużeniu i e-ZLA kod B, a w formularzu wyświetla etykiety źródeł', async () => {
    const fetchMock = stubMockApi();
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/login?situation=pregnant']}>
        <ScenarioProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/wizard" element={<WizardPage />} />
          </Routes>
        </ScenarioProvider>
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(/Katarzyna Kowalska – działalność gospodarcza/),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Zaloguj przez mObywatela (symulacja)' }),
    );

    // Pobrano dane z ZUS z nagłówkiem Bearer
    expect(await screen.findByText(/Pobrano dane z ZUS: Katarzyna Kowalska/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/mock/zus-data',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer mock-token-123' }),
      }),
    );

    // Zaświadczenie o stanie zadłużenia składkowego (symulacja) dla JDG
    expect(
      screen.getByRole('heading', { name: 'Zaświadczenie o stanie zadłużenia składkowego' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/680,50 zł/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Przekracza próg/)).toBeInTheDocument();

    // Podgląd e-ZLA z kodem „B” (symulacja)
    expect(screen.getByText('EZLA-2026-10-3310')).toBeInTheDocument();
    expect(screen.getByText(/Kod „B” \(ciąża – 100%\)/)).toBeInTheDocument();

    // Przejście do formularza z danymi z ZUS
    await user.click(screen.getByRole('button', { name: /Przejdź do formularza z danymi ZUS/ }));

    expect(
      await screen.findByText(/Połączono z ZUS przez mObywatela \(symulacja\):/),
    ).toBeInTheDocument();
    // Pierwsze pytanie ('family') zostało wypełnione z mObywatela
    expect(screen.getByText('mObywatel')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^Samodzielnie — mama/ })).toBeChecked();
  });

  it('w formularzu nie nadpisuje ręcznych wpisów użytkownika i pyta przy konflikcie z ZUS', async () => {
    stubMockApi();
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/wizard?situation=pregnant']}>
        <ScenarioProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/wizard" element={<WizardPage />} />
          </Routes>
        </ScenarioProvider>
      </MemoryRouter>,
    );

    // Użytkownik ręcznie wybiera Samodzielnie — mama, wpisuje termin, liczbę dzieci, Za życiem i Umowę o pracę
    await user.click(screen.getByRole('radio', { name: /^Samodzielnie — mama/ }));
    await user.click(screen.getByRole('button', { name: /^Dalej/ }));
    await user.click(screen.getByRole('checkbox')); // Nie znamy terminu
    await user.click(screen.getByRole('button', { name: /^Dalej/ }));
    await user.type(screen.getByRole('spinbutton'), '1');
    await user.click(screen.getByRole('button', { name: /^Dalej/ }));
    await user.click(screen.getByRole('radio', { name: 'Nie' })); // Za życiem
    await user.click(screen.getByRole('button', { name: /^Dalej/ }));
    await user.click(screen.getByRole('radio', { name: 'Umowa o pracę' }));
    expect(screen.getByText('Ty')).toBeInTheDocument();

    // W trakcie wypełniania loguje się profilem JDG z ZUS
    await user.click(
      screen.getByRole('link', { name: /Pobierz dane z ZUS przez mObywatela \(symulacja\)/ }),
    );
    await screen.findByText(/Katarzyna Kowalska/);
    await user.click(
      screen.getByRole('button', { name: 'Zaloguj przez mObywatela (symulacja)' }),
    );
    await screen.findByText(/Wykryto 1 rozbieżność/);
    await user.click(screen.getByRole('button', { name: /Przejdź do formularza z danymi ZUS/ }));

    // W formularzu widoczny konflikt — Umowa o pracę NIE została nadpisana!
    expect(screen.getByText(/Wykryto rozbieżność z danymi z ZUS/)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Umowa o pracę' })).toBeChecked();

    // Użytkownik decyduje się przyjąć dane z ZUS
    await user.click(screen.getByRole('button', { name: 'Użyj danych z ZUS' }));
    expect(screen.getByRole('radio', { name: 'Działalność gospodarcza' })).toBeChecked();
    expect(screen.getByText('ZUS')).toBeInTheDocument();
  });
});
