import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { calculateCasePlan } from '@shared/engine/casePlan';
import params from '@shared/params.json';
import type { CaseInputs } from '@shared/types';
import { CasePlanner } from '../../plan/tabs/CasePlanner';

function makeCoupleInputs(overrides: Partial<CaseInputs> = {}): CaseInputs {
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
    benefit_base_amount_pln: 6903.2,
    due_or_birth_date: '2026-11-10',
    application_date: '2026-11-15',
    days_from_birth_to_application: 5,
    children_count: 1,
    requested_payment_variant: 'COMBINED_81_5',
    father_parental_weeks: 9,
    part_time_work_fraction: 0,
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
    other_parent: {
      employment_type: 'UOP',
      payer_insured_count_nov_30: '<= 20',
      benefit_base_amount_pln: 5000,
      voluntary_sickness_insured: false,
      contract_end_date: null,
    },
    reference_date: '2026-11-21',
    ...overrides,
  };
}

function renderPlanner(input: CaseInputs, update = vi.fn(), search = '?situation=afterBirth') {
  const plan = calculateCasePlan(input, params);
  render(
    <MemoryRouter initialEntries={[`/plan/leave-plan${search}`]}>
      <CasePlanner input={input} plan={plan} params={params} update={update} />
    </MemoryRouter>,
  );
  return { plan, update };
}

describe('CasePlanner', () => {
  it('pokazuje podsumowanie, oś czasu obojga rodziców, 5 gotowych scenariuszy i zwinięte szczegóły', () => {
    renderPlanner(makeCoupleInputs());

    expect(screen.getByRole('heading', { name: 'Plan urlopów', level: 2 })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Plan urlopów w skrócie', level: 3 }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Mama: urlop od 10\.11\.2026/)).toBeInTheDocument();
    expect(screen.getByText(/Tata: urlop od/)).toBeInTheDocument();
    expect(screen.getByText(/Najbliższy termin:/)).toBeInTheDocument();

    // Oś czasu dla obu rodziców
    expect(screen.getByLabelText('Oś czasu urlopów mamy')).toBeInTheDocument();
    expect(screen.getByLabelText('Oś czasu urlopów taty')).toBeInTheDocument();

    // 5 presetów
    for (const label of [
      'Najpierw mama, potem tata',
      'Po połowie',
      'Jednocześnie',
      'Tylko mama',
      'Tylko tata',
    ]) {
      expect(screen.getByRole('button', { name: new RegExp(label) })).toBeEnabled();
    }

    // Sekcje <details> domyślnie zwinięte
    const calendarDetails = screen
      .getByText('Pokaż kalendarz dzień po dniu')
      .closest('details') as HTMLDetailsElement;
    const manualDetails = screen
      .getByText('Ułóż ręcznie / połącz z pracą')
      .closest('details') as HTMLDetailsElement;
    const periodsDetails = screen
      .getByText('Zobacz okresy i kwoty')
      .closest('details') as HTMLDetailsElement;

    expect(calendarDetails.open).toBe(false);
    expect(manualDetails.open).toBe(false);
    expect(periodsDetails.open).toBe(false);

    // Link do kolejnego kroku zachowuje parametry URL
    const nextLink = screen.getByRole('link', { name: 'Dalej: Dokumenty i terminy ›' });
    expect(nextLink).toHaveAttribute('href', '/plan/documents?situation=afterBirth');
  });

  it('wywołuje update z nowymi częściami po kliknięciu gotowego scenariusza', () => {
    const update = vi.fn();
    renderPlanner(makeCoupleInputs(), update);

    fireEvent.click(screen.getByRole('button', { name: /Po połowie/ }));
    expect(update).toHaveBeenCalledTimes(1);
    const patch = update.mock.calls[0][0] as Partial<CaseInputs>;
    expect(patch.parental_leave_parts).toHaveLength(2);
    expect(patch.parental_leave_parts?.[0].parent_role).toBe('MOTHER');
    expect(patch.parental_leave_parts?.[1].parent_role).toBe('FATHER');

    fireEvent.click(screen.getByRole('button', { name: /Jednocześnie/ }));
    const simPatch = update.mock.calls[1][0] as Partial<CaseInputs>;
    expect(simPatch.parental_leave_parts?.[0].start_date).toBe(
      simPatch.parental_leave_parts?.[1].start_date,
    );
  });

  it('pokazuje komunikaty walidacji poza <details>, gdy złamana jest reguła ustawowa', () => {
    const input = makeCoupleInputs({
      paternity_leave_start_date: '2027-11-05',
      parental_leave_parts: [
        {
          parent_role: 'MOTHER',
          start_date: '2027-03-30',
          end_date: '2027-06-07',
          work_fraction: 0.6,
        },
      ],
    });
    renderPlanner(input);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/1\/2 etatu/);
    expect(alert).toHaveTextContent(/12 miesięcy/);
    expect(alert.closest('details')).toBeNull();
  });

  it('pokazuje ostrzeżenie „Termin minął”, gdy minęły terminy wniosków', () => {
    renderPlanner(makeCoupleInputs({ reference_date: '2028-05-01' }));
    expect(screen.getByText(/Termin minął\. Sprawdź pozycje/)).toBeInTheDocument();
  });

  it('pokazuje stan brakujących danych bez wymyślania daty, gdy brakuje daty porodu', () => {
    renderPlanner(makeCoupleInputs({ due_or_birth_date: null, stage: 'PREGNANCY' }));
    expect(screen.getByText('Uzupełnij dane do planu urlopów')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Uzupełnij dane ›' })).toHaveAttribute(
      'href',
      '/wizard?situation=pregnant',
    );
  });

  it('zachowuje spokojny ton bez wykrzykników i ukrywa podział rodzicielskiego przy stracie jedynego dziecka', () => {
    const input = makeCoupleInputs({
      children_count: 1,
      living_children_count: 0,
      father_parental_weeks: 0,
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
    const { container } = render(
      <MemoryRouter initialEntries={['/plan/leave-plan']}>
        <CasePlanner
          input={input}
          plan={calculateCasePlan(input, params)}
          params={params}
          update={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(container.textContent).not.toContain('!');
    expect(screen.queryByRole('button', { name: /Po połowie/ })).not.toBeInTheDocument();
    expect(screen.getAllByText(/Urlop rodzicielski nie przysługuje/i).length).toBeGreaterThan(0);
  });
});
