import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { CaseInputs, CasePlan } from '@shared/types';
import { createApp } from '../app';

const app = createApp();
const endpoint = '/api/v1/plan';

function application(overrides: Partial<CaseInputs> = {}): CaseInputs {
  return {
    applicant_role: 'MOTHER',
    stage: 'POST_BIRTH',
    co_parenting: false,
    other_parent_insured: null,
    employment_type: 'UOP',
    contract_type: 'INDEFINITE',
    contract_end_date: null,
    payer_insured_count_nov_30: '> 20',
    voluntary_sickness_insured: null,
    insurance_duration_days: null,
    has_b2b_arrears: null,
    applicant_age_50_plus: false,
    benefit_base_amount_pln: 6000,
    due_or_birth_date: '2026-10-30',
    application_date: null,
    days_from_birth_to_application: null,
    children_count: 1,
    requested_payment_variant: 'SPLIT_100_70',
    father_parental_weeks: 0,
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
    ...overrides,
  };
}

describe('rozszerzony kontrakt spraw rodzicielskich', () => {
  it('wylicza płatnika i kwotę niezależnie dla dwóch potwierdzonych tytułów', async () => {
    const input = application({
      additional_insurance_titles: [{
        employment_type: 'ZLECENIE',
        payer_insured_count_nov_30: '<= 20',
        sickness_insured: true,
        voluntary_sickness_insured: true,
        title_start_date: '2025-01-01',
        benefit_base_amount_pln: 3000,
      }],
    });

    const { body } = await request(app).post(endpoint).send(input).expect(200);
    const plan: CasePlan = body.data;

    const primary = plan.outcome.periods.find((period) => period.leave_type === 'MATERNITY');
    const additional = plan.additional_title_outcomes?.[0];
    const extraPeriod = additional?.outcome.periods.find((period) => period.leave_type === 'MATERNITY');
    expect(primary).toMatchObject({ benefit_base_pln: 6000, who_pays: 'EMPLOYER' });
    expect(additional?.employment_type).toBe('ZLECENIE');
    expect(extraPeriod).toMatchObject({
      benefit_base_pln: 3000,
      who_pays: 'ZUS',
      days: primary?.days,
      start_date: primary?.start_date,
    });
    expect(additional?.documents.map((document) => document.id)).toContain('Z-3a');
  });

  it('zachowuje dodatkowy tytuł z nieznanym ubezpieczeniem bez naliczania wypłaty', async () => {
    const input = application({
      additional_insurance_titles: [{
        employment_type: 'UOP',
        payer_insured_count_nov_30: '> 20',
        sickness_insured: null,
        voluntary_sickness_insured: null,
        benefit_base_amount_pln: 8000,
      }],
    });
    const { body } = await request(app).post(endpoint).send(input).expect(200);
    const plan: CasePlan = body.data;

    expect(plan.outcome.is_qualified).toBe(true);
    expect(plan.additional_title_outcomes?.[0].outcome).toMatchObject({
      is_qualified: false,
      who_pays: null,
      calculated_amount_pln: null,
    });
  });

  it('odrzuca niespójne liczby dzieci po porodzie mnogim', async () => {
    const original = application();
    await request(app).post(endpoint).send({
      ...original,
      children_count: 3,
      living_children_count: 2,
      deceased_children_count: 2,
      special_circumstances: {
        ...original.special_circumstances,
        stillbirth_or_child_death: 'BEFORE_8_WEEKS',
      },
    }).expect(422);
  });

  it.each([
    { insured: true, usedDays: 56, expectedStart: '2026-12-25' },
    { insured: false, usedDays: undefined, expectedStart: '2026-11-13' },
    { insured: undefined, usedDays: undefined, expectedStart: null },
    { insured: true, usedDays: 30, expectedStart: null },
  ])('ocenia przejęcie po porzuceniu przy ubezpieczeniu matki $insured i wykorzystanych dniach $usedDays', async ({ insured, usedDays, expectedStart }) => {
    const input = application({
      applicant_role: 'FATHER',
      mother_abandonment_date: '2026-11-12',
      mother_was_insured_at_abandonment: insured,
      mother_maternity_days_used: usedDays,
    });
    const { body } = await request(app).post(endpoint).send(input).expect(200);
    const plan: CasePlan = body.data;
    const takeover = plan.outcome.periods.find((period) => period.leave_type === 'MATERNITY');

    if (expectedStart) {
      expect(takeover).toMatchObject({ parent_role: 'FATHER', start_date: expectedStart });
      expect(plan.documents.map((doc) => doc.id)).toContain('ABANDONMENT_STATEMENT');
      expect(plan.documents.some((doc) => doc.id === 'MOTHER_MATERNITY_PERIOD_CERTIFICATE')).toBe(insured);
    } else {
      expect(takeover).toBeUndefined();
      expect(plan.outcome.warnings.map((warning) => warning.code)).toContain('FATHER_TAKEOVER_ABANDONMENT');
    }
  });

  it('dla potwierdzonego wyroku kieruje wniosek do ZUS i liczy zasiłek od dnia porodu', async () => {
    const original = application();
    const input = application({
      contract_end_date: '2026-09-15',
      maternity_leave_start_date: '2026-10-10',
      special_circumstances: {
        ...original.special_circumstances,
        unlawful_termination_confirmed_by_court: true,
      },
    });
    const { body } = await request(app).post(endpoint).send(input).expect(200);
    const plan: CasePlan = body.data;

    expect(plan.outcome.periods).toContainEqual(expect.objectContaining({
      leave_type: 'MATERNITY',
      start_date: '2026-10-30',
      who_pays: 'ZUS',
    }));
    expect(plan.documents).toContainEqual(expect.objectContaining({ id: 'ZAM', submit_to: 'ZUS' }));
    expect(plan.documents.map((doc) => doc.id)).toContain('COURT_RULING_UNLAWFUL_TERMINATION');
  });

  it('liczy wymiar według dzieci pozostałych przy życiu i rozpoznaje zgon w dniu porodu', async () => {
    const original = application();
    const input = application({
      children_count: 3,
      deceased_children_count: 2,
      child_death_date: '2026-10-30',
      special_circumstances: {
        ...original.special_circumstances,
        stillbirth_or_child_death: 'BEFORE_8_WEEKS',
      },
    });
    const { body } = await request(app).post(endpoint).send(input).expect(200);
    const plan: CasePlan = body.data;

    expect(plan.outcome.periods).toContainEqual(expect.objectContaining({
      leave_type: 'MATERNITY',
      weeks: 20,
    }));
    expect(plan.documents.map((doc) => doc.id)).toContain('DEATH_CERTIFICATE');
    expect(plan.documents.map((doc) => doc.id)).not.toContain('STILLBIRTH_CERTIFICATE');
  });

  it('przyjmuje wniosek samotnego ojca bez rekordu ubezpieczenia matki', async () => {
    const input = application({
      applicant_role: 'FATHER',
      paternity_leave_start_date: '2026-11-05',
    });
    const { body } = await request(app).post(endpoint).send(input).expect(200);
    const plan: CasePlan = body.data;

    expect(plan.outcome.periods).toContainEqual(expect.objectContaining({
      parent_role: 'FATHER',
      leave_type: 'PATERNITY',
      denied: false,
    }));
  });
});
