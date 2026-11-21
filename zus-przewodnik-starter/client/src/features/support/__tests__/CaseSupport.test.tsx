import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { calculateCasePlan } from '@shared/engine/casePlan';
import params from '@shared/params.json';
import type { CaseInputs } from '@shared/types';
import { ScenarioProvider } from '../../../app/ScenarioContext';
import { CaseSupport } from '../../plan/tabs/CaseSupport';

function buildInput(overrides: Partial<CaseInputs> = {}): CaseInputs {
  return {
    applicant_role: 'MOTHER',
    stage: 'POST_BIRTH',
    co_parenting: true,
    other_parent_insured: true,
    employment_type: 'UOP',
    contract_type: 'INDEFINITE',
    contract_end_date: null,
    payer_insured_count_nov_30: '> 20',
    voluntary_sickness_insured: false,
    insurance_duration_days: null,
    has_b2b_arrears: false,
    applicant_age_50_plus: false,
    benefit_base_amount_pln: 6500,
    due_or_birth_date: '2026-11-10',
    application_date: '2026-11-15',
    days_from_birth_to_application: 5,
    children_count: 1,
    requested_payment_variant: 'COMBINED_81_5',
    father_parental_weeks: 9,
    part_time_work_fraction: 0,
    reference_date: '2026-11-21',
    special_circumstances: {
      has_code_b_on_ezla: null,
      premature_or_hospitalized_newborn: false,
      za_zyciem_certificate: false,
      stillbirth_or_child_death: 'NONE',
      mother_hospitalized_or_incapable: false,
      employer_bankruptcy_or_liquidation: false,
      adopted_or_foster_child_age_years: null,
      is_professional_foster_family: false,
    },
    ...overrides,
  };
}

function renderSupport(input: CaseInputs) {
  const plan = calculateCasePlan(input, params);
  return render(
    <MemoryRouter initialEntries={['/plan/support?situation=afterBirth']}>
      <ScenarioProvider>
        <CaseSupport input={input} plan={plan} params={params} />
      </ScenarioProvider>
    </MemoryRouter>,
  );
}

describe('CaseSupport', () => {
  it('pokazuje ryzyka planu (JDG dług), linki urzędowe, PUE/USC i uczciwe „Najczęstsze pytania” bez AI', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ data: null, error: { code: 'NOT_FOUND', message: 'not found' } }),
            { status: 404 },
          ),
      ),
    );

    const input = buildInput({
      employment_type: 'B2B',
      voluntary_sickness_insured: true,
      has_b2b_arrears: true,
      debt_amount_pln: 500,
    });
    renderSupport(input);

    expect(screen.getByRole('heading', { name: 'Wsparcie', level: 2 })).toBeInTheDocument();
    expect(screen.getByText('Najważniejsze dla Ciebie')).toBeInTheDocument();
    expect(screen.getByText('Zadłużenie składkowe (JDG)')).toBeInTheDocument();

    // Uczciwość AI (pkt 4)
    expect(screen.queryByText(/Wspierane przez AI/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/asystent AI/i)).not.toBeInTheDocument();
    expect(screen.getByText('Najczęstsze pytania')).toBeInTheDocument();
    expect(screen.getByText(/bez użycia modelu AI/)).toBeInTheDocument();

    // Kliknięcie gotowego pytania działa z lokalną bazą wiedzy
    fireEvent.click(
      screen.getByRole('button', { name: /Co jeśli spóźnię się z wnioskiem o 81,5%\?/ }),
    );
    expect(await screen.findByText(/21 dni po porodzie/)).toBeInTheDocument();

    // Linki urzędowe i organizacje charytatywne
    expect(screen.getByRole('link', { name: /www\.zus\.pl/ })).toHaveAttribute(
      'href',
      'https://www.zus.pl',
    );
    expect(screen.getByRole('link', { name: /Ministerstwo Rodziny/ })).toHaveAttribute(
      'href',
      'https://www.gov.pl/web/rodzina/urlop-rodzicielski',
    );
    expect(screen.getByRole('link', { name: /Państwowa Inspekcja Pracy/ })).toHaveAttribute(
      'href',
      'https://www.pip.gov.pl/dla-pracodawcow/porady-prawne/rodzicielstwo',
    );

    // Symulacja PUE: podgląd konta pokazuje prawdziwe dane (500 zł długu)
    fireEvent.click(screen.getByRole('button', { name: /Sprawdź dane na koncie/ }));
    expect(screen.getByText(/500,00/)).toBeInTheDocument();

    // Powrót do planu
    expect(screen.getByRole('link', { name: 'Wróć do planu ›' })).toHaveAttribute(
      'href',
      '/plan?situation=afterBirth',
    );
  });

  it('w trudnej sytuacji (martwe urodzenie) stosuje spokojny ton bez wykrzykników i otwiera organizacje charytatywne', () => {
    const input = buildInput({
      living_children_count: 0,
      special_circumstances: {
        has_code_b_on_ezla: null,
        premature_or_hospitalized_newborn: false,
        za_zyciem_certificate: false,
        stillbirth_or_child_death: 'BEFORE_8_WEEKS',
        mother_hospitalized_or_incapable: false,
        employer_bankruptcy_or_liquidation: false,
        adopted_or_foster_child_age_years: null,
        is_professional_foster_family: false,
      },
    });
    const { container } = renderSupport(input);

    const answerBox = container.querySelector('.support-answer--empathetic');
    expect(answerBox).not.toBeNull();
    expect(answerBox?.textContent ?? '').not.toContain('!');
    expect(answerBox?.textContent ?? '').not.toMatch(/gratulac/i);
    expect(screen.getByText('Martwe urodzenie lub zgon dziecka')).toBeInTheDocument();

    // Organizacje charytatywne otwarte domyślnie w trudnej sytuacji
    const orgsDetails = screen
      .getByText('Organizacje charytatywne – bezpłatna pomoc')
      .closest('details');
    expect(orgsDetails).toHaveAttribute('open');
    expect(screen.getByText('Fundacja Nagle Sami')).toBeInTheDocument();
    expect(screen.getByText('Fundacja Ernesta')).toBeInTheDocument();
  });
});
