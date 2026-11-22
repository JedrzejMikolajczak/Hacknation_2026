import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { CaseEvaluation, CasePlan, CaseRecord, CaseSummary } from '@shared/types';
import { createApp } from '../app';

const app = createApp();
const api = '/api/v1';

describe('Katalog przykładowych spraw', () => {
  it('podaje sześć przykładowych spraw i zgodny wynik wzorcowy', async () => {
    const { body } = await request(app).get(`${api}/cases`).expect(200);
    const summaries: CaseSummary[] = body.data;
    expect(summaries.map(({ case_id }) => case_id)).toEqual([
      'case-01',
      'case-02',
      'case-03',
      'case-04',
      'case-05',
      'case-06',
    ]);
    for (const { case_id } of summaries) {
      const response = await request(app).get(`${api}/cases/${case_id}`).expect(200);
      const detail: CaseRecord = response.body.data;
      expect(detail.case_id).toBe(case_id);
      expect(detail.inputs.applicant_role).toBe('MOTHER');
      const evaluation: CaseEvaluation = (
        await request(app).post(`${api}/cases/${case_id}/evaluate`).send({}).expect(200)
      ).body.data;
      expect(evaluation.case_id).toBe(case_id);
      expect(evaluation.outcome.is_qualified).toBe(true);
      expect(evaluation.differences).toEqual([]);
      expect(evaluation.matches).toBe(true);
    }
  });

  it('obsługuje POST /plan dla obojga rodziców z wariantem 81,5% bez daty wniosku oraz monthly_bases drugiego rodzica', async () => {
    const { body } = await request(app)
      .post(`${api}/plan`)
      .send({
        applicant_role: 'MOTHER',
        stage: 'POST_BIRTH',
        co_parenting: true,
        other_parent_insured: true,
        employment_type: 'UOP',
        contract_type: null,
        contract_end_date: null,
        payer_insured_count_nov_30: '> 20',
        voluntary_sickness_insured: false,
        insurance_duration_days: null,
        has_b2b_arrears: null,
        applicant_age_50_plus: false,
        benefit_base_amount_pln: 6903.2,
        due_or_birth_date: '2026-11-10',
        application_date: null,
        days_from_birth_to_application: null,
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
          benefit_base_amount_pln: null,
          voluntary_sickness_insured: false,
          contract_end_date: null,
          title_start_date: '2019-01-01',
          monthly_bases: [{ month: '2026-10', amount_pln: 6000 }],
        },
        paternity_leave_start_date: '2026-11-28',
        reference_date: '2026-11-21',
      })
      .expect(200);

    const plan: CasePlan = body.data;
    expect(plan.outcome.applied_payment_variant).toBe('COMBINED_81_5');
    expect(
      plan.outcome.warnings.some(
        (w) => w.code === 'COMBINED_RATE_DEADLINE' && w.message_pl.includes('01.12.2026'),
      ),
    ).toBe(true);
    const fatherPeriods = plan.outcome.periods.filter((p) => p.parent_role === 'FATHER');
    expect(fatherPeriods).toHaveLength(2);
    expect(fatherPeriods[0].benefit_base_pln).toBe(5177.4);
  });

  it('zwraca 404 w kopercie dla nieznanej sprawy', async () => {
    const path = `${api}/cases/case-07`;
    const get = await request(app).get(path).expect(404);
    const post = await request(app).post(`${path}/evaluate`).expect(404);
    expect(get.body.error.code).toBe('NOT_FOUND');
    expect(post.body.data).toBeNull();
  });
});
