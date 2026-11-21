import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CasesPage } from '../CasesPage';

const SAMPLE_CASE = {
  caseId: 'wgrana-testowa',
  title: 'Wgrana sprawa testowa',
  scenario: {
    situation: 'afterBirth',
    referenceDate: '2026-11-21',
    expectedBirthDate: null,
    birthDate: '2026-11-01',
    childrenCount: 1,
    adoptionType: null,
    childAcceptanceDate: null,
    childAgeYears: null,
    schoolObligationDeferred: false,
    rateVariant: 'standard',
    mother: {
      role: 'mother',
      insuranceTitle: 'employment',
      sicknessInsurance: 'mandatory',
      insuredSince: '2026-10-01',
      insuranceEndDate: null,
      benefitBase: 8629,
      employerInsuredCount: 25,
      age: 30,
      contributionDebt: null,
      wantsLeave: true,
    },
    father: null,
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
  },
  benefitBaseInput: null,
  zusDecision: {
    granted: true,
    benefitBase: 8629,
    amount: 85368.36,
    note: 'Wyliczenie testowe.',
  },
};

function renderCases(initialEntry = '/cases') {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/cases/:caseId?" element={<CasesPage />} />
      </Routes>
    </MemoryRouter>,
  );
  return { user };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('CasesPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('pokazuje listę spraw oraz formularz wgrania własnego pliku JSON i przelicza wgraną sprawę', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/v1/cases')) {
        return jsonResponse({
          data: [{ caseId: 'etat-po-porodzie', title: 'Umowa o pracę i jedno dziecko', expectedGranted: true }],
          error: null,
        });
      }
      if (url.endsWith('/api/v1/cases/evaluate')) {
        return jsonResponse({
          data: {
            caseId: 'wgrana-testowa',
            eligibility: {
              entitlements: [
                {
                  benefit: 'maternityBenefit',
                  parentRole: 'mother',
                  entitled: true,
                  reason: { message: 'Matka podlega ubezpieczeniu.', legalBasis: 'KP art. 180' },
                  payer: 'employer',
                },
              ],
              warnings: [],
            },
            calculation: {
              periods: [
                {
                  leaveType: 'maternityLeave',
                  parentRole: 'mother',
                  startDate: '2026-11-01',
                  endDate: '2027-03-20',
                  weeks: 20,
                  days: 140,
                  rate: 1,
                  monthlyAmount: 8629,
                  totalAmount: 40268.2,
                },
              ],
              totalAmount: 85368.36,
              variants: null,
              explanations: [],
              warnings: [],
            },
            benefitBase: null,
            matchesZusDecision: true,
            differences: [],
          },
          error: null,
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const { user } = renderCases();
    expect(await screen.findByText('Umowa o pracę i jedno dziecko')).toBeInTheDocument();

    const fileInput = screen.getByLabelText('Wybierz plik JSON');
    const file = new File([JSON.stringify(SAMPLE_CASE)], 'sprawa.json', {
      type: 'application/json',
    });
    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(screen.getByText('Wgrana sprawa testowa')).toBeInTheDocument();
      expect(screen.getByText('Wynik zgodny z oczekiwaniem.')).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/cases/evaluate',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('wyświetla błąd dla niepoprawnego pliku JSON bez wywołania API', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ data: [], error: null }),
    );

    const { user } = renderCases();
    const fileInput = screen.getByLabelText('Wybierz plik JSON');
    const badFile = new File(['{not valid json'], 'zepsuty.json', { type: 'application/json' });
    await user.upload(fileInput, badFile);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Nie udało się odczytać pliku JSON',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('pokazuje komunikat walidacji z API dla błędnej struktury sprawy', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/v1/cases')) {
        return jsonResponse({ data: [], error: null });
      }
      return jsonResponse(
        {
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'scenario.birthDate: Wymagany format daty RRRR-MM-DD.',
          },
        },
        422,
      );
    });

    const { user } = renderCases();
    const fileInput = screen.getByLabelText('Wybierz plik JSON');
    const file = new File([JSON.stringify(SAMPLE_CASE)], 'bledna-data.json', {
      type: 'application/json',
    });
    await user.upload(fileInput, file);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'scenario.birthDate: Wymagany format daty RRRR-MM-DD.',
    );
  });
});
