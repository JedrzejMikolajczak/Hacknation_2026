import request from 'supertest';
import { describe, expect, it } from 'vitest';
import paramsJson from '@shared/params.json';
import type { BenefitBaseInput, ScenarioInput } from '@shared/types';
import { createApp } from '../app';

const app = createApp();

function testScenario(): ScenarioInput {
  return {
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
      insuredSince: '2025-01-01',
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
      insuredSince: '2025-01-01',
      insuranceEndDate: null,
      benefitBase: 8000,
      employerInsuredCount: 25,
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
  };
}

describe('API v1', () => {
  it('GET /api/v1/health returns ok in the envelope', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { status: 'ok' }, error: null });
  });

  it('GET /api/v1/params returns params.json in the envelope', async () => {
    const res = await request(app).get('/api/v1/params');
    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data).toEqual(paramsJson);
    expect(res.body.data.version).toBe(paramsJson.version);
  });

  it('POST /api/v1/eligibility returns eligibility assessment', async () => {
    const res = await request(app).post('/api/v1/eligibility').send(testScenario());
    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data.entitlements).toHaveLength(2);
    expect(res.body.data.entitlements[0].entitled).toBe(true);
  });

  it('POST /api/v1/calculate/maternity calculates leave plan for standard and combined without extra fields', async () => {
    const combined = { ...testScenario(), rateVariant: 'combined' as const };
    const res = await request(app).post('/api/v1/calculate/maternity').send(combined);
    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data.periods.length).toBeGreaterThan(0);
    expect(res.body.data.totalAmount).toBeGreaterThan(0);
    expect(res.body.data.variants).not.toBeNull();
  });

  it('POST /api/v1/calculate/sickness works with pure ScenarioInput from the form', async () => {
    const pregnant = testScenario();
    pregnant.situation = 'pregnant';
    pregnant.birthDate = null;
    pregnant.expectedBirthDate = '2027-03-10';

    const res = await request(app).post('/api/v1/calculate/sickness').send(pregnant);
    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data.entitled).toBe(true);
    expect(res.body.data.employerSickPayDays).toBe(33);
    expect(res.body.data.dailyAmount).toBe(200);
  });

  it('POST /api/v1/calculate/benefit-base accepts pure BenefitBaseInput without optional extra fields', async () => {
    const input: BenefitBaseInput = {
      insuranceTitle: 'employment',
      rightArisesOn: '2026-11-01',
      incomes: [
        { month: '2026-09', grossAmount: 6000, workedDays: null, requiredWorkingDays: null },
        { month: '2026-10', grossAmount: 6000, workedDays: null, requiredWorkingDays: null },
      ],
      contractMonthlySalary: null,
      declaredContributionBase: null,
      previousBenefitEndDate: null,
      previousBenefitBase: null,
    };

    const res = await request(app).post('/api/v1/calculate/benefit-base').send(input);
    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data.benefitBase).toBe(5177.4);
  });

  it('POST /api/v1/documents returns checklist', async () => {
    const res = await request(app).post('/api/v1/documents').send(testScenario());
    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data.documents.length).toBeGreaterThan(0);
  });

  it('POST /api/v1/plan/parental-split validates split', async () => {
    const res = await request(app)
      .post('/api/v1/plan/parental-split')
      .send({
        scenario: testScenario(),
        parts: [
          { parentRole: 'mother', leaveType: 'parentalLeave', startDate: '2027-03-22', weeks: 32 },
          { parentRole: 'father', leaveType: 'parentalLeave', startDate: '2027-11-02', weeks: 9 },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data.valid).toBe(true);
  });

  it('POST /api/v1/plan/parental-with-work calculates extension without rounding combined rate', async () => {
    const res = await request(app)
      .post('/api/v1/plan/parental-with-work')
      .send({
        scenario: { ...testScenario(), rateVariant: 'combined' },
        parentRole: 'mother',
        workTimeFraction: 0.5,
        startDate: '2027-03-22',
        weeks: 10,
      });
    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data.extendedWeeks).toBe(5);
    expect(res.body.data.periods[0].rate).toBeCloseTo(0.4075, 6);
  });

  it('invalid inputs return 422 VALIDATION_ERROR on every calculator route, never 500', async () => {
    const routes = [
      '/api/v1/eligibility',
      '/api/v1/calculate/maternity',
      '/api/v1/calculate/benefit-base',
      '/api/v1/calculate/sickness',
      '/api/v1/plan/parental-split',
      '/api/v1/plan/parental-with-work',
      '/api/v1/documents',
    ];

    for (const route of routes) {
      const res = await request(app).post(route).send({});
      expect(res.status).toBe(422);
      expect(res.body.data).toBeNull();
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(Array.isArray(res.body.error.details)).toBe(true);
    }
  });

  it('CalculationError maps to 422 VALIDATION_ERROR in the envelope', async () => {
    const badInput = testScenario();
    badInput.childrenCount = 0; // Invalid childrenCount

    const res = await request(app).post('/api/v1/calculate/maternity').send(badInput);
    expect(res.status).toBe(422);
    expect(res.body.data).toBeNull();
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('liczbę dzieci');
  });

  it('unknown route returns 404 NOT_FOUND in the envelope', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.data).toBeNull();
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('malformed JSON body returns 422 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send('{bad');
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ data: null, error: { code: 'VALIDATION_ERROR' } });
  });

  it('allows CORS for the local client', async () => {
    const res = await request(app).get('/api/v1/health').set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });
});
