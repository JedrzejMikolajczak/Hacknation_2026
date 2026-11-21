import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScenarioProvider, type ScenarioDraft } from '../../../app/ScenarioContext';
import { SupportPage } from '../SupportPage';

function renderSupport(initialScenario?: ScenarioDraft) {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={['/plan/support']}>
      <ScenarioProvider initialScenario={initialScenario}>
        <Routes>
          <Route path="/plan/support" element={<SupportPage />} />
          <Route path="/plan/:tab" element={<div>Inna zakładka</div>} />
          <Route path="/guide" element={<div>Przewodnik</div>} />
        </Routes>
      </ScenarioProvider>
    </MemoryRouter>,
  );
  return { user };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SupportPage', () => {
  it('renders sections in requested order: assistant, risks, special situations, human help', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

    renderSupport();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Wsparcie i ostrzeżenia' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Wsparcie' })).toHaveAttribute('aria-current', 'page');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Zapytaj przewodnika ZUS/i })).toBeInTheDocument();
    });

    const h2Titles = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent);
    expect(h2Titles).toEqual([
      'Zapytaj przewodnika ZUS',
      'Na co musisz uważać',
      'Sytuacje szczególne i trudne',
      'Gdzie załatwić sprawę i skonsultować się z człowiekiem',
    ]);

    expect(screen.getByText('Wspierane przez AI')).toBeInTheDocument();
    expect(screen.getByText(/Widok korzysta z danych demonstracyjnych/i)).toBeInTheDocument();
  });

  it('tailors risks specifically to logged-in self-employed user with debt', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

    renderSupport({
      situation: 'pregnant',
      rateVariant: 'standard',
      mother: {
        role: 'mother',
        insuranceTitle: 'selfEmployed',
        sicknessInsurance: 'voluntary',
        insuredSince: '2026-11-01',
        insuranceEndDate: null,
        benefitBase: 5000,
        employerInsuredCount: null,
        age: 31,
        contributionDebt: 300,
        wantsLeave: true,
      },
      father: null,
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Zaległość w składkach ZUS \(działalność gospodarcza\)/i),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Okres wyczekiwania na zasiłek chorobowy w ciąży/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Prowadzisz działalność \(JDG\)/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Umowa zlecenie – ubezpieczenie chorobowe jest dobrowolne/i),
    ).not.toBeInTheDocument();
  });

  it('tailors special situations to user profile and hides unrelated ones behind optional toggle', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

    const { user } = renderSupport({
      situation: 'adoption',
      adoptionType: 'adoption',
    });

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 3, name: 'Adopcja lub rodzina zastępcza' }),
      ).toBeInTheDocument();
    });

    // Inne sytuacje są ukryte, dopóki użytkownik ich sam nie rozwinie.
    expect(screen.queryByLabelText(/Wybierz inną sytuację szczególną/i)).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: /Sprawdź instrukcję na wypadek innej sytuacji/i }),
    );
    const select = screen.getByLabelText(/Wybierz inną sytuację szczególną/i);
    await user.selectOptions(select, 'zaZyciem');
    expect(screen.getByText(/wydłuża się z 41 do 65 tygodni/i)).toBeInTheDocument();
  });

  it('allows clicking a suggested question and asking a custom question to the assistant', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

    const { user } = renderSupport();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Co jeśli spóźnię się z wnioskiem o 81,5%\?/i }),
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole('button', { name: /Co jeśli spóźnię się z wnioskiem o 81,5%\?/i }),
    );

    await waitFor(() => {
      expect(screen.getByText(/najpóźniej w ciągu 21 dni po porodzie/i)).toBeInTheDocument();
      expect(screen.getByText(/Źródła:/i)).toBeInTheDocument();
    });

    const input = screen.getByLabelText('Twoje pytanie');
    await user.type(input, 'Czy dług JDG blokuje zasiłek?');
    await user.click(screen.getByRole('button', { name: 'Zapytaj' }));

    await waitFor(() => {
      expect(screen.getByText(/zadłużenie przekraczające 1% płacy minimalnej/i)).toBeInTheDocument();
    });
  });

  it('uses API response directly when /eligibility and /assistant/ask succeed', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/params')) {
        return new Response(
          JSON.stringify({
            data: (await import('@shared/params.json')).default,
            error: null,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.endsWith('/eligibility')) {
        return new Response(
          JSON.stringify({
            data: {
              entitlements: [],
              warnings: [
                {
                  code: 'SELF_EMPLOYED_DEBT',
                  message: 'Wykryto zadłużenie składkowe na JDG.',
                  legalBasis: 'Ustawa zasiłkowa art. 2a',
                },
              ],
            },
            error: null,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.endsWith('/assistant/ask')) {
        return new Response(
          JSON.stringify({
            data: {
              answer: 'Odpowiedź prosto z backendu ZUS.',
              sources: ['Poradnik ZUS 2026'],
            },
            error: null,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(null, { status: 404 });
    });

    const { user } = renderSupport();

    await waitFor(() => {
      expect(screen.getByText('Wykryto zadłużenie składkowe na JDG.')).toBeInTheDocument();
    });
    expect(screen.queryByText(/Widok korzysta z danych demonstracyjnych/i)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Twoje pytanie'), 'Test API');
    await user.click(screen.getByRole('button', { name: 'Zapytaj' }));

    await waitFor(() => {
      expect(screen.getByText('Odpowiedź prosto z backendu ZUS.')).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalled();
  });

  it('displays calm loss guidance automatically in sensitive scenario', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

    renderSupport({
      situation: 'afterBirth',
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

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 3, name: 'Utrata ciąży lub śmierć dziecka' }),
      ).toBeInTheDocument();
    });
  });
});
