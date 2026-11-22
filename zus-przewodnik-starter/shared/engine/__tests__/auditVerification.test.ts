/// <reference types="node" />

import { describe, expect, it } from 'vitest';
import params from '../../params.json';
import type { CaseInputs, CaseRecord } from '../../types';
import case02 from '../../../data/cases/case-02.json';
import case06 from '../../../data/cases/case-06.json';
import { calculateCasePlan } from '../casePlan';
import { addDays, addMonths, calculateBenefitAmount, daysBetween } from '../core';
import { supplementaryDays } from '../casePeriods';
import { birthInput } from './auditFixtures';


const father = {
  employment_type: 'UOP',
  payer_insured_count_nov_30: '> 20',
  voluntary_sickness_insured: null,
  benefit_base_amount_pln: 4500,
} as const;

const paid = (input: CaseInputs) =>
  calculateCasePlan(input, params).outcome.periods.filter((period) => !period.denied);

// Timestamps are computed independently of the app's calendar helpers.
const calendarLength = (start: string, end: string) =>
  (Date.parse(end + 'T00:00:00Z') - Date.parse(start + 'T00:00:00Z')) / 86_400_000 + 1;

describe('Niezależne punkty odniesienia audytu', () => {
  it.each([
    [1, 140, 224],
    [2, 217, 238],
    [3, 231, 238],
    [4, 245, 238],
    [5, 259, 238],
    [6, 259, 238],
  ])(
    'CAL-01 poród %i dzieci, podstawowy macierzyński i limit jednego rodzica',
    (children, maternity, parental) => {
      const periods = paid(birthInput({ children_count: children }));
      expect(periods.map(({ leave_type, days }) => [leave_type, days])).toEqual([
        ['MATERNITY', maternity],
        ['PARENTAL', parental],
      ]);
    },
  );

  it.each([
    ['2026-07-22', 'COMBINED_81_5', [81.5, 81.5]],
    ['2026-07-23', 'SPLIT_100_70', [100, 70]],
  ] as const)('CAL-02 rzeczywista data wpływu u płatnika %s', (date, variant, rates) => {
    const result = calculateCasePlan(
      birthInput({
        requested_payment_variant: 'COMBINED_81_5',
        application_date: '2026-07-25',
        application_to_payer_date: date,
      }),
      params,
    ).outcome;
    expect(result.applied_payment_variant).toBe(variant);
    expect(result.periods.map((period) => period.rate_percent)).toEqual(rates);
  });

  it('CAL-03 dzielnik 30, stawka 100/70 i suma przy pełnych groszach dziennych', () => {
    const result = calculateCasePlan(birthInput(), params).outcome;
    expect(
      result.periods.map(({ daily_amount_pln, total_amount_pln }) => [
        daily_amount_pln,
        total_amount_pln,
      ]),
    ).toEqual([
      [200, 28000],
      [140, 31360],
    ]);
    expect(result.calculated_amount_pln).toBe(59360);
    expect(result.variants.SPLIT_100_70).toBe(59360);
  });

  it('CAL-04 druga osoba i jej wyłączne 9 tygodni na 70%', () => {
    const periods = paid(
      birthInput({
        co_parenting: true,
        other_parent: father,
        father_parental_weeks: 20,
        requested_payment_variant: 'COMBINED_81_5',
        application_date: '2026-07-09',
      }),
    );
    expect(
      periods
        .filter((row) => row.parent_role === 'FATHER')
        .map((row) => [row.days, row.rate_percent, row.who_pays]),
    ).toEqual([
      [63, 70, 'EMPLOYER'],
      [77, 81.5, 'EMPLOYER'],
    ]);
  });

  it('CAL-05 pół etatu na całej części i na całym wydłużeniu', () => {
    const periods = paid(birthInput({ part_time_work_fraction: 0.5 }));
    expect(
      periods
        .slice(1)
        .map(({ leave_type, days, monthly_amount_pln }) => [leave_type, days, monthly_amount_pln]),
    ).toEqual([
      ['PARENTAL', 224, 2100],
      ['PARENTAL_WORK_EXTENSION', 224, 2100],
    ]);
  });

  it('CAL-06 znana podstawa i brak podstawy są rozróżnione', () => {
    const [maternity] = paid(birthInput({ benefit_base_amount_pln: null }));
    expect(maternity).toMatchObject({
      days: 140,
      monthly_amount_pln: null,
      total_amount_pln: null,
    });
  });

  it('CAL-07 granica 6 tygodni przed porodem', () => {
    const ok = paid(birthInput({ maternity_leave_start_date: '2026-05-20' }));
    const tooEarly = calculateCasePlan(
      birthInput({ maternity_leave_start_date: '2026-05-19' }),
      params,
    );
    expect(ok[0]).toMatchObject({ days: 140, start_date: '2026-05-20', end_date: '2026-10-06' });
    expect(tooEarly.validation_errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'MATERNITY_START' })]),
    );
  });

  it.each([
    ['2024-02-28', '2024-02-29'],
    ['2025-02-28', '2025-03-01'],
    ['2026-03-28', '2026-03-29'],
    ['2026-10-24', '2026-10-25'],
    ['2025-12-31', '2026-01-01'],
  ])('CAL-08 następny dzień po %s', (start, end) => {
    expect(addDays(start, 1)).toBe(end);
    expect(daysBetween(start, end)).toBe(1);
  });

  it('CAL-09 ostatni dzień miesiąca i zmiana roku', () => {
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonths('2025-01-31', 1)).toBe('2025-02-28');
    expect(addMonths('2026-12-31', 2)).toBe('2027-02-28');
  });

  it('CAL-10 dwoje rodziców może korzystać równocześnie w granicach wspólnej puli', () => {
    const periods = paid(
      birthInput({
        co_parenting: true,
        other_parent: father,
        parental_leave_parts: [
          { start_date: '2026-11-19', end_date: '2026-11-25', parent_role: 'MOTHER' },
          { start_date: '2026-11-19', end_date: '2026-11-25', parent_role: 'FATHER' },
        ],
      }),
    );
    expect(
      periods
        .filter((row) => row.leave_type === 'PARENTAL')
        .map((row) => [row.parent_role, row.days, row.start_date]),
    ).toEqual([
      ['MOTHER', 7, '2026-11-19'],
      ['FATHER', 7, '2026-11-19'],
    ]);
  });

  it.each([
    ['przed startem', [{ start_date: '2026-11-20', end_date: '2026-11-19' }], 'PARENTAL_DATES'],
    [
      'nakładanie',
      [
        { start_date: '2026-11-20', end_date: '2026-11-27' },
        { start_date: '2026-11-27', end_date: '2026-12-04' },
      ],
      'PARENTAL_DATES',
    ],
    [
      'pół etatu przekroczone',
      [{ start_date: '2026-11-20', end_date: '2026-11-27', work_fraction: 0.51 }],
      'PARENTAL_WORK',
    ],
    [
      'indywidualna pula przekroczona',
      [{ start_date: '2026-11-18', end_date: '2027-06-30' }],
      'PARENTAL_POOL',
    ],
    [
      'sześć części',
      Array.from({ length: 6 }, (_, index) => ({
        start_date: '2027-0' + (index + 1) + '-01',
        end_date: '2027-0' + (index + 1) + '-07',
      })),
      'PARENTAL_PARTS',
    ],
    ['rok po terminie', [{ start_date: '2033-01-01', end_date: '2033-01-07' }], 'PARENTAL_DATES'],
  ] as const)('CAL-11 odrzuca plan: %s', (_label, parts, code) => {
    const result = calculateCasePlan(
      birthInput({ parental_leave_parts: parts.map((part) => ({ ...part })) }),
      params,
    );
    expect(result.validation_errors.some((error) => error.code === code)).toBe(true);
    expect(result.outcome.periods.some((period) => period.leave_type === 'PARENTAL')).toBe(false);
  });

  it('CAL-12 granica końca roku, w którym dziecko skończy 6 lat', () => {
    const result = calculateCasePlan(
      birthInput({
        parental_leave_parts: [{ start_date: '2032-12-25', end_date: '2032-12-31' }],
      }),
      params,
    );
    expect(result.outcome.parental_deadline).toBe('2032-12-31');
    expect(result.outcome.periods.at(-1)).toMatchObject({ leave_type: 'PARENTAL', days: 7 });
  });

  it.each([
    [48.05, true],
    [48.06, true],
    [48.07, false],
  ])('CAL-13 JDG w 2026 r., zadłużenie %f zł', (debt, expected) => {
    const result = calculateCasePlan(
      birthInput({
        employment_type: 'B2B',
        voluntary_sickness_insured: true,
        debt_amount_pln: debt,
      }),
      params,
    );
    expect(result.outcome.is_qualified).toBe(expected);
  });

  it('CAL-14 brak wyczekiwania na macierzyński przy 1 dniu ubezpieczenia', () => {
    const periods = paid(
      birthInput({
        employment_type: 'B2B',
        voluntary_sickness_insured: true,
        title_start_date: '2026-07-01',
        insurance_duration_days: 0,
      }),
    );
    expect(periods[0]).toMatchObject({ leave_type: 'MATERNITY', who_pays: 'ZUS', days: 140 });
  });

  it.each([
    ['27+6', 1100, 105],
    ['28+0', 1000, 105],
    ['28+0', 1001, 56],
  ])('CAL-15 wcześniactwo %s i masa %i g', (week, grams, expected) => {
    const input = birthInput(
      {
        pregnancy_week_at_birth: week,
        birth_weight_grams: grams,
        newborn_hospitalization_start: '2026-07-01',
        newborn_hospitalization_end: '2026-10-31',
      },
      { premature_or_hospitalized_newborn: true },
    );
    expect(supplementaryDays(input, '2026-07-01', '2026-11-17', params)).toBe(expected);
  });

  it('CAL-16 19.03.2025 włącznie w przepisie przejściowym dla uzupełniającego', () => {
    const input = birthInput(
      {
        pregnancy_week_at_birth: '27+4',
        birth_weight_grams: 900,
        newborn_hospitalization_start: '2024-10-31',
        newborn_hospitalization_end: '2024-11-07',
      },
      { premature_or_hospitalized_newborn: true },
    );
    expect(supplementaryDays(input, '2024-10-31', '2025-03-18', params)).toBe(0);
    expect(supplementaryDays(input, '2024-10-31', '2025-03-19', params)).toBe(14);
  });

  it('CAL-17 case-02 odtwarza dokładnie przedziały z lokalnej transkrypcji', () => {
    const data = case02 as CaseRecord;
    const durations = [
      calendarLength('2024-05-13', '2024-12-15'),
      calendarLength('2024-12-16', '2026-01-11'),
      calendarLength('2026-01-12', '2027-02-07'),
    ];
    expect(durations).toEqual([217, 392, 392]);
    const result = calculateCasePlan(data.inputs, params).outcome;
    expect(result.granted_duration_days).toBe(durations.reduce((sum, days) => sum + days, 0));
    expect(result.periods.map((row) => row.days)).toEqual(durations);
  });

  it('CAL-18 case-06 cztery i osiem pełnych miesięcy oraz stawka miesięczna i dzienna', () => {
    const data = case06 as CaseRecord;
    const result = calculateCasePlan(data.inputs, params).outcome;
    expect(result.benefit_base_pln).toBe(5706.22);
    expect(
      result.periods.map(({ days, rate_percent, monthly_amount_pln, daily_amount_pln }) => [
        days,
        rate_percent,
        monthly_amount_pln,
        daily_amount_pln,
      ]),
    ).toEqual([
      [42, 70, 3994.35, 133.15],
      [61, 70, 3994.35, 133.15],
    ]);
  });

  it('CAL-19 stawka dzienna zaokrąglona przed mnożeniem w pomocniku ogólnym', () => {
    expect(calculateBenefitAmount(5706.22, 0.7, 103)).toEqual({
      dailyAmount: 133.15,
      totalAmount: 13714.45,
    });
  });

  it.each([
    ['', '2026-10-24', true],
    ['złożony w terminie', '2026-10-01', false],
  ] as const)('CAL-20 termin długiego wniosku z przypadkiem %s', (kind, referenceDate, overdue) => {
    const result = calculateCasePlan(
      birthInput({
        due_or_birth_date: '2026-10-01',
        application_date: kind ? '2026-10-04' : null,
        requested_payment_variant: 'COMBINED_81_5',
        reference_date: referenceDate,
      }),
      params,
    );
    if (kind) {
      const combined = result.documents.find((doc) => doc.id === 'COMBINED_RATE');
      expect(combined).toMatchObject({ is_overdue: overdue });
    } else {
      expect(result.outcome.applied_payment_variant).toBe('SPLIT_100_70');
      expect(
        result.outcome.warnings.some((warning) => warning.code === 'COMBINED_RATE_DEADLINE'),
      ).toBe(overdue);
    }
  });
});

describe('Audyt regresji aktualnej wersji silnika', () => {
  it(
    'AUD-01 zakaz naliczania ojcowskiego i rodzicielskiego temu samemu ojcu za te same dni',
    () => {
      const periods = paid(
        birthInput({
          applicant_role: 'FATHER',
          paternity_leave_start_date: '2026-08-03',
          parental_leave_parts: [{ start_date: '2026-08-03', end_date: '2026-08-09' }],
        }),
      );
      const parental = periods.find((row) => row.leave_type === 'PARENTAL');
      const paternity = periods.find((row) => row.leave_type === 'PATERNITY');
      const overlaps = Boolean(
        parental &&
        paternity &&
        paternity.start_date <= parental.end_date &&
        parental.start_date <= paternity.end_date,
      );
      expect(
        overlaps,
        JSON.stringify(
          periods.map(({ leave_type, start_date, end_date, total_amount_pln }) => ({
            leave_type,
            start_date,
            end_date,
            total_amount_pln,
          })),
        ),
      ).toBe(false);
    },
  );

  it('AUD-02 nabycie prawa po wyczekiwaniu w trakcie trwającego e-ZLA', () => {
    const result = calculateCasePlan(
      birthInput(
        {
          stage: 'PREGNANCY',
          title_start_date: '2026-05-01',
          sickness_leave_start_date: '2026-05-25',
          sickness_leave_end_date: '2026-06-05',
        },
        { has_code_b_on_ezla: true },
      ),
      params,
    ).outcome;
    expect(
      result.employer_sick_pay.map((period) => [period.start_date, period.end_date, period.days]),
    ).toEqual([['2026-05-31', '2026-06-05', 6]]);
  });

  it('AUD-03 odrębna podstawa od nowego płatnika, bez wynagrodzenia przed tytułem', () => {
    const result = calculateCasePlan(
      birthInput({
        due_or_birth_date: '2026-09-20',
        title_start_date: '2026-08-01',
        benefit_base_amount_pln: null,
        monthly_bases: [
          { month: '2026-07', amount_pln: 12000 },
          { month: '2026-08', amount_pln: 6000 },
        ],
      }),
      params,
    );
    expect(result.outcome.benefit_base_pln).toBe(5177.4);
  });

  it('AUD-04 historyczny próg zadłużenia 2025 r. to 46,66 zł', () => {
    const result = calculateCasePlan(
      birthInput({
        employment_type: 'B2B',
        voluntary_sickness_insured: true,
        debt_amount_pln: 47,
        due_or_birth_date: '2025-07-01',
      }),
      params,
    );
    expect(result.outcome.is_qualified).toBe(false);
  });

  it('AUD-05 31 grudnia płatny przez pracodawcę, w styczniu nowy limit', () => {
    const result = calculateCasePlan(
      birthInput(
        {
          stage: 'PREGNANCY',
          sickness_leave_start_date: '2025-12-31',
          sickness_leave_end_date: '2026-01-08',
          sick_pay_days_already_used: 32,
        },
        { has_code_b_on_ezla: true },
      ),
      params,
    ).outcome;
    expect(result.employer_sick_pay.reduce((sum, row) => sum + row.days, 0)).toBe(9);
    expect(
      result.periods.filter((row) => row.leave_type === 'SICKNESS' && !row.denied),
    ).toHaveLength(0);
  });

  it('kontynuuje zasiłek w styczniu, gdy przysługiwał już 31 grudnia', () => {
    const { outcome } = calculateCasePlan(
      birthInput({
        stage: 'PREGNANCY',
        sickness_leave_start_date: '2025-12-31',
        sickness_leave_end_date: '2026-01-08',
        sick_pay_days_already_used: 33,
      }),
      params,
    );
    expect(outcome.employer_sick_pay).toEqual([]);
    expect(outcome.periods).toContainEqual(expect.objectContaining({
      leave_type: 'SICKNESS', days: 9, who_pays: 'ZUS', denied: false,
    }));
  });

  it(
    'AUD-06 ZUS jako płatnik po rozwiązaniu umowy z powodu likwidacji przed porodem',
    () => {
      const [maternity] = paid(
        birthInput(
          {
            payer_insured_count_nov_30: '> 20',
            contract_end_date: '2026-06-01',
          },
          { employer_bankruptcy_or_liquidation: true },
        ),
      );
      expect(maternity).toMatchObject({ leave_type: 'MATERNITY', who_pays: 'ZUS' });
    },
  );

  it('AUD-07 ojcowski po zakończeniu limitu wieku dziecka adopcyjnego', () => {
    const periods = paid(
      birthInput(
        {
          applicant_role: 'FATHER',
          stage: 'ADOPTION',
          due_or_birth_date: null,
          adoption_type: 'ADOPTION',
          adopted_or_foster_child_acceptance_date: '2026-01-01',
          paternity_leave_start_date: '2026-09-01',
        },
        { adopted_or_foster_child_age_years: 13.5 },
      ),
    );
    expect(periods.filter((period) => period.leave_type === 'PATERNITY')).toHaveLength(0);
  });

  it('uwzględnia jednocześnie 14. urodziny i 12 miesięcy od prawomocności', () => {
    const input = birthInput(
      {
        applicant_role: 'FATHER',
        stage: 'ADOPTION',
        due_or_birth_date: null,
        adoption_type: 'ADOPTION',
        adopted_or_foster_child_acceptance_date: '2026-01-01',
        adopted_or_foster_child_birth_date: '2012-08-20',
        adoption_order_final_date: '2026-08-01',
        paternity_leave_start_date: '2026-08-06',
      },
    );
    expect(paid(input)).toContainEqual(expect.objectContaining({
      leave_type: 'PATERNITY', end_date: '2026-08-19',
    }));
    expect(paid({ ...input, paternity_leave_start_date: '2026-08-07' }))
      .not.toContainEqual(expect.objectContaining({ leave_type: 'PATERNITY' }));
  });

  it('AUD-08 hospitalizacja donoszonego dziecka na granicy 28. dnia', () => {
    const input = birthInput(
      {
        pregnancy_week_at_birth: '39+0',
        birth_weight_grams: 3200,
        newborn_hospitalization_start: '2026-07-28',
        newborn_hospitalization_end: '2026-07-29',
      },
      { premature_or_hospitalized_newborn: true },
    );
    expect(supplementaryDays(input, '2026-07-01', '2026-11-17', params)).toBe(7);
  });

  it('AUD-09 nie stosuje obecnej stawki do długiego wniosku sprzed reformy', () => {
    const { outcome } = calculateCasePlan(
      birthInput({
        due_or_birth_date: '2020-01-01',
        application_date: '2020-01-10',
        requested_payment_variant: 'COMBINED_81_5',
      }),
      params,
    );
    expect(outcome.periods).toEqual([]);
    expect(outcome.calculated_amount_pln).toBeNull();
    expect(outcome.warnings).toContainEqual(expect.objectContaining({ code: 'HISTORICAL_MATERNITY_RULES' }));
  });

  it('AUD-10 case-06 suma 103 dni zgodna z dziennymi kwotami w groszach', () => {
    const result = calculateCasePlan((case06 as CaseRecord).inputs, params).outcome;
    expect(result.periods.map((row) => row.total_amount_pln)).toEqual([5592.3, 8122.15]);
    expect(result.calculated_amount_pln).toBe(13714.45);
  });

  it('AUD-11 zwykła niezdolność do pracy poza ciążą ma limit 182 dni', () => {
    const result = calculateCasePlan(
      birthInput(
        {
          stage: 'PLANNING',
          due_or_birth_date: null,
          sickness_leave_start_date: '2026-01-01',
          sickness_leave_end_date: '2026-07-19',
        },
        { has_code_b_on_ezla: false },
      ),
      params,
    ).outcome;
    const benefit = result.periods.filter((row) => row.leave_type === 'SICKNESS' && !row.denied);
    expect(
      benefit.reduce((sum, row) => sum + row.days, 0) +
        result.employer_sick_pay.reduce((sum, row) => sum + row.days, 0),
    ).toBe(182);
  });

  it(
    'AUD-12 przejęcie zasiłku po śmierci nieubezpieczonej matki z długim wnioskiem w terminie',
    () => {
      const result = calculateCasePlan(
        birthInput(
          {
            applicant_role: 'FATHER',
            other_parent_insured: false,
            father_takeover_date: '2026-07-05',
            application_date: '2026-07-10',
            requested_payment_variant: 'COMBINED_81_5',
          },
          { mother_deceased: true },
        ),
        params,
      ).outcome;
      expect(result.periods.find((row) => row.leave_type === 'MATERNITY')?.rate_percent).toBe(81.5);
    },
  );

  it('AUD-13 rodzicielski po ukończeniu wieku granicznego przy adopcji', () => {
    const result = calculateCasePlan(
      birthInput(
        {
          stage: 'ADOPTION',
          due_or_birth_date: null,
          adoption_type: 'ADOPTION',
          adopted_or_foster_child_acceptance_date: '2026-01-01',
          parental_leave_parts: [{ start_date: '2026-09-01', end_date: '2026-09-07' }],
        },
        { adopted_or_foster_child_age_years: 13.5 },
      ),
      params,
    );
    expect(result.outcome.periods.filter((row) => row.leave_type === 'PARENTAL')).toHaveLength(0);
  });

  it('AUD-14 uzupełniający również po przyjęciu dziecka na wychowanie', () => {
    const periods = paid(
      birthInput(
        {
          stage: 'ADOPTION',
          due_or_birth_date: null,
          adoption_type: 'FOSTER_FAMILY',
          adopted_or_foster_child_acceptance_date: '2026-07-01',
          adopted_or_foster_child_birth_date: '2026-06-29',
          pregnancy_week_at_birth: '27+0',
          birth_weight_grams: 950,
          newborn_hospitalization_start: '2026-07-02',
          newborn_hospitalization_end: '2026-07-08',
        },
        { adopted_or_foster_child_age_years: 0, premature_or_hospitalized_newborn: true },
      ),
    );
    expect(periods.find((row) => row.leave_type === 'SUPPLEMENTARY_MATERNITY')?.days).toBe(7);
  });

  it('AUD-15 zmiana stawki w ramach jednej części nie mnoży wniosków ojca', () => {
    const plan = calculateCasePlan(
      birthInput({
        co_parenting: true,
        other_parent: father,
        father_parental_weeks: 20,
        requested_payment_variant: 'COMBINED_81_5',
        application_date: '2026-07-09',
      }),
      params,
    );
    const forms = plan.documents.filter(
      (doc) => doc.id === 'PARENTAL_REQUEST' && doc.parent_role === 'FATHER',
    );
    expect(forms).toHaveLength(1);
  });
});
