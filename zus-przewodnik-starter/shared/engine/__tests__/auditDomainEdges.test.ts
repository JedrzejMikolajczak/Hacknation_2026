import { describe, expect, it } from 'vitest';
import params from '../../params.json';
import { calculateCasePlan } from '../casePlan';
import { birthInput } from './auditFixtures';

describe('Dodatkowe granice merytoryczne', () => {
  it.each([
    ['ADOPTION', 13.99, false, false, true],
    ['ADOPTION', 14, false, false, false],
    ['FOSTER_FAMILY', 6.99, false, false, true],
    ['FOSTER_FAMILY', 7, false, false, false],
    ['FOSTER_FAMILY', 9, true, false, true],
    ['FOSTER_FAMILY', 10, true, false, false],
    ['FOSTER_FAMILY', 1, false, true, false],
  ] as const)(
    'CAL-21 przyjęcie: %s, wiek %f, odroczenie %s, zawodowa %s',
    (type, age, deferred, professional, expected) => {
      const result = calculateCasePlan(
        birthInput(
          {
            stage: 'ADOPTION',
            due_or_birth_date: null,
            adoption_type: type,
            school_obligation_deferred: deferred,
            adopted_or_foster_child_acceptance_date: '2026-07-01',
          },
          { adopted_or_foster_child_age_years: age, is_professional_foster_family: professional },
        ),
        params,
      );
      const hasMaternity = result.outcome.periods.some(
        (row) => row.leave_type === 'ADOPTION_MATERNITY' && !row.denied,
      );
      expect(hasMaternity).toBe(expected);
    },
  );

  it.each([
    ['2027-06-17', true],
    ['2027-06-18', false],
  ] as const)(
    'CAL-22 biologiczny ojcowski, cały blok przed końcem 12. miesiąca: %s',
    (start, expected) => {
      const result = calculateCasePlan(
        birthInput({
          applicant_role: 'FATHER',
          paternity_leave_start_date: start,
        }),
        params,
      );
      const duration = result.outcome.periods.find((row) => row.leave_type === 'PATERNITY')?.days;
      expect(duration).toBe(expected ? 14 : undefined);
    },
  );

  it.each([
    [0, 0, 0],
    [6200.0125, 6200.01, 206.67],
  ])(
    'CAL-23 rozróżnienie zerowej podstawy kwoty i precyzji z >2 miejscami: %d',
    (base, cents, daily) => {
      const result = calculateCasePlan(
        birthInput({ benefit_base_amount_pln: base }),
        params,
      ).outcome;
      expect(result.benefit_base_pln).toBe(cents);
      expect(result.periods[0].daily_amount_pln).toBe(daily);
    },
  );

  it('CAL-24 JDG, 90 dni dobrowolnego i pierwszy dzień prawa do chorobowego', () => {
    const outcome = calculateCasePlan(
      birthInput(
        {
          stage: 'PREGNANCY',
          employment_type: 'B2B',
          voluntary_sickness_insured: true,
          title_start_date: '2026-01-01',
          debt_amount_pln: 48.06,
          sickness_leave_start_date: '2026-04-01',
          sickness_leave_end_date: '2026-04-01',
        },
        { has_code_b_on_ezla: true },
      ),
      params,
    ).outcome;
    expect(outcome.employer_sick_pay).toEqual([]);
    expect(outcome.periods[0]).toMatchObject({
      leave_type: 'SICKNESS',
      days: 1,
      who_pays: 'ZUS',
      rate_percent: 100,
      total_amount_pln: 200,
    });
  });

  it('CAL-25 proste odcinki o podanej dacie legalnie ustalonej zmiany podstawy', () => {
    const input = birthInput(
      {
        benefit_base_amount_pln: 3000,
        stage: 'PREGNANCY',
        sick_pay_days_already_used: 33,
        sickness_leave_start_date: '2026-05-01',
        sickness_leave_end_date: '2026-05-30',
        sickness_base_changes: [{ effective_date: '2026-05-16', amount_pln: 6000 }],
      },
      { has_code_b_on_ezla: true },
    );
    const [sickness] = calculateCasePlan(input, params).outcome.periods;
    expect(sickness.total_amount_pln).toBe(4500);
    expect(
      sickness.amount_segments?.map((row) => [row.start_date, row.end_date, row.daily_amount_pln]),
    ).toEqual([
      ['2026-05-01', '2026-05-15', 100],
      ['2026-05-16', '2026-05-30', 200],
    ]);
  });

  it('CAL-26 użyty limit 270 dni nie daje kolejnego płatnego dnia w ciąży', () => {
    const input = birthInput(
      {
        sickness_leave_start_date: '2026-06-20',
        sickness_leave_end_date: '2026-06-20',
        sickness_benefit_days_already_used: 270,
      },
      { has_code_b_on_ezla: true },
    );
    const outcome = calculateCasePlan(input, params).outcome;
    expect(outcome.employer_sick_pay).toEqual([]);
    expect(outcome.periods[0]).toMatchObject({
      leave_type: 'SICKNESS',
      denied: true,
      total_amount_pln: null,
    });
  });

  it('CAL-27 14 dni wynagrodzenia i kolejny dzień zasiłku przy podanym spełnieniu kryterium wieku', () => {
    const input = birthInput(
      {
        applicant_age_50_plus: true,
        sickness_leave_start_date: '2026-05-01',
        sickness_leave_end_date: '2026-05-15',
      },
      { has_code_b_on_ezla: true },
    );
    const { outcome } = calculateCasePlan(input, params);
    expect(outcome.employer_sick_pay[0]).toMatchObject({ days: 14, end_date: '2026-05-14' });
    expect(outcome.periods[0]).toMatchObject({
      days: 1,
      start_date: '2026-05-15',
      who_pays: 'ZUS',
    });
  });
});
