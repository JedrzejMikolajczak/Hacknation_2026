import { describe, expect, it } from 'vitest';
import type { LeavePartRequest, MaternityCalculationResult, ScenarioInput } from '@shared/types';
import { DEFAULT_PARAMS } from '../../../app/benefitParams';
import {
  buildMilestones,
  getParentalDeadlineDate,
  getPaternityDeadlineDate,
  validateAdoptionAgeLimits,
  validateMaternityOptions,
  validateParentalParts,
  validatePaternityPlan,
  validateSupplementaryLeave,
  type MaternityPlanOptions,
} from '../leavePlanValidation';

function makeScenario(overrides: Partial<ScenarioInput> = {}): ScenarioInput {
  return {
    situation: 'afterBirth',
    referenceDate: '2026-11-21',
    expectedBirthDate: '2026-11-10',
    birthDate: '2026-11-10',
    childrenCount: 1,
    adoptionType: null,
    childAcceptanceDate: null,
    childAgeYears: null,
    schoolObligationDeferred: false,
    rateVariant: 'combined',
    mother: {
      role: 'mother',
      insuranceTitle: 'employment',
      sicknessInsurance: 'mandatory',
      insuredSince: '2024-01-01',
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
      insuredSince: '2024-01-01',
      insuranceEndDate: null,
      benefitBase: 7000,
      employerInsuredCount: 30,
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
    ...overrides,
  };
}

function makeMaternityResult(
  periods: MaternityCalculationResult['periods'] = [
    {
      leaveType: 'maternityLeave',
      parentRole: 'mother',
      startDate: '2026-11-10',
      endDate: '2027-03-29',
      weeks: 20,
      days: 140,
      rate: 0.815,
      monthlyAmount: 4890,
      totalAmount: 22820,
    },
  ],
): MaternityCalculationResult {
  return {
    periods,
    totalAmount: periods.reduce((sum, p) => sum + p.totalAmount, 0),
    variants: null,
    explanations: [],
    warnings: [],
  };
}

const DEFAULT_MAT_OPTIONS: MaternityPlanOptions = {
  weeksBeforeBirth: 0,
  transferToFather: false,
  motherWeeksAfterBirth: DEFAULT_PARAMS.maternityLeave.motherMandatoryWeeksAfterBirth,
  supplementaryParent: 'mother',
};

describe('leavePlanValidation – reguły ustawowe z params.json', () => {
  describe('urlop macierzyński', () => {
    it('pozwala rozpocząć do 6 tygodni przed porodem i zgłasza błąd powyżej 6 tygodni', () => {
      const scenario = makeScenario({
        situation: 'pregnant',
        birthDate: null,
        expectedBirthDate: '2027-03-10',
      });
      const mat = makeMaternityResult();

      const validIssues = validateMaternityOptions(
        scenario,
        mat,
        { ...DEFAULT_MAT_OPTIONS, weeksBeforeBirth: 6 },
        DEFAULT_PARAMS,
      );
      expect(validIssues).toHaveLength(0);

      const errorIssues = validateMaternityOptions(
        scenario,
        mat,
        { ...DEFAULT_MAT_OPTIONS, weeksBeforeBirth: 7 },
        DEFAULT_PARAMS,
      );
      expect(errorIssues.some((i) => i.code === 'MATERNITY_BEFORE_BIRTH_EXCEEDED')).toBe(true);
    });

    it('wymaga min. 14 tygodni po porodzie dla matki zanim ojciec przejmie pozostałą część', () => {
      const scenario = makeScenario();
      const mat = makeMaternityResult();

      const tooEarly = validateMaternityOptions(
        scenario,
        mat,
        { ...DEFAULT_MAT_OPTIONS, transferToFather: true, motherWeeksAfterBirth: 10 },
        DEFAULT_PARAMS,
      );
      expect(tooEarly.some((i) => i.code === 'MATERNITY_MOTHER_MANDATORY_14_WEEKS')).toBe(true);

      const okAt14 = validateMaternityOptions(
        scenario,
        mat,
        { ...DEFAULT_MAT_OPTIONS, transferToFather: true, motherWeeksAfterBirth: 14 },
        DEFAULT_PARAMS,
      );
      expect(okAt14.filter((i) => i.severity === 'error')).toHaveLength(0);
    });

    it('dopuszcza wcześniejsze przejęcie macierzyńskiego przez ojca w sytuacjach szczególnych', () => {
      const mat = makeMaternityResult();

      // Hospitalizacja matki – ostrzeżenie informacyjne, brak błędu blokującego
      const hospScenario = makeScenario({
        special: { ...makeScenario().special, motherHospitalized: true },
      });
      const hospIssues = validateMaternityOptions(
        hospScenario,
        mat,
        { ...DEFAULT_MAT_OPTIONS, transferToFather: true, motherWeeksAfterBirth: 8 },
        DEFAULT_PARAMS,
      );
      expect(hospIssues.filter((i) => i.severity === 'error')).toHaveLength(0);
      expect(hospIssues.some((i) => i.code === 'MATERNITY_TRANSFER_HOSPITALIZED_INFO')).toBe(true);

      // Niezdolność do samodzielnej egzystencji – dopuszczalne od 8 tyg., błąd poniżej 8 tyg.
      const incapScenario = makeScenario({
        special: { ...makeScenario().special, motherIncapableOfIndependentLiving: true },
      });
      expect(
        validateMaternityOptions(
          incapScenario,
          mat,
          { ...DEFAULT_MAT_OPTIONS, transferToFather: true, motherWeeksAfterBirth: 8 },
          DEFAULT_PARAMS,
        ).filter((i) => i.severity === 'error'),
      ).toHaveLength(0);
      expect(
        validateMaternityOptions(
          incapScenario,
          mat,
          { ...DEFAULT_MAT_OPTIONS, transferToFather: true, motherWeeksAfterBirth: 6 },
          DEFAULT_PARAMS,
        ).some((i) => i.code === 'MATERNITY_TRANSFER_INCAPACITY_MIN'),
      ).toBe(true);

      // Zgon matki – natychmiastowe przejęcie od 0 tyg.
      const deceasedScenario = makeScenario({
        special: { ...makeScenario().special, motherDeceased: true },
      });
      expect(
        validateMaternityOptions(
          deceasedScenario,
          mat,
          { ...DEFAULT_MAT_OPTIONS, transferToFather: true, motherWeeksAfterBirth: 0 },
          DEFAULT_PARAMS,
        ).filter((i) => i.severity === 'error'),
      ).toHaveLength(0);
    });

    it('przy martwym urodzeniu / zgonie jedynego dziecka informuje o skróconym macierzyńskim i blokuje rodzicielski', () => {
      const scenario = makeScenario({
        special: { ...makeScenario().special, stillbirth: true },
      });
      const shortenedMat = makeMaternityResult([
        {
          leaveType: 'maternityLeave',
          parentRole: 'mother',
          startDate: '2026-11-10',
          endDate: '2027-01-04',
          weeks: 8,
          days: 56,
          rate: 1.0,
          monthlyAmount: 6000,
          totalAmount: 11200,
        },
      ]);

      const matIssues = validateMaternityOptions(
        scenario,
        shortenedMat,
        DEFAULT_MAT_OPTIONS,
        DEFAULT_PARAMS,
      );
      expect(matIssues.some((i) => i.code === 'CHILD_LOSS_SHORTENED_MATERNITY')).toBe(true);

      const parentalIssues = validateParentalParts(
        scenario,
        [
          {
            parentRole: 'mother',
            leaveType: 'parentalLeave',
            startDate: '2027-01-05',
            weeks: 10,
          },
        ],
        {},
        {},
        DEFAULT_PARAMS,
      );
      expect(parentalIssues.some((i) => i.code === 'PARENTAL_NOT_ALLOWED_CHILD_LOSS')).toBe(true);
    });
  });

  describe('uzupełniający urlop macierzyński', () => {
    it('wymusza 1 część, bezpośrednio po macierzyńskim i dla jednego rodzica', () => {
      const scenario = makeScenario();

      expect(
        validateSupplementaryLeave(
          { partsCount: 1, hasGapAfterMaternity: false, usedByBothParents: false },
          scenario,
        ),
      ).toHaveLength(0);

      const invalid = validateSupplementaryLeave(
        { partsCount: 2, hasGapAfterMaternity: true, usedByBothParents: true },
        scenario,
      );
      expect(invalid.some((i) => i.code === 'SUPPLEMENTARY_SINGLE_PART_ONLY')).toBe(true);
      expect(invalid.some((i) => i.code === 'SUPPLEMENTARY_MUST_FOLLOW_MATERNITY')).toBe(true);
      expect(invalid.some((i) => i.code === 'SUPPLEMENTARY_ONE_PARENT_ONLY')).toBe(true);
    });
  });

  describe('urlop ojcowski', () => {
    it('akceptuje 1 część 2 tyg. lub 2 części po 1 tyg. do 12. miesiąca życia dziecka', () => {
      const scenario = makeScenario({ birthDate: '2026-11-10' });

      expect(
        validatePaternityPlan(scenario, [{ startDate: '2026-11-24', weeks: 2 }], DEFAULT_PARAMS),
      ).toHaveLength(0);
      expect(
        validatePaternityPlan(
          scenario,
          [
            { startDate: '2026-11-24', weeks: 1 },
            { startDate: '2027-05-01', weeks: 1 },
          ],
          DEFAULT_PARAMS,
        ),
      ).toHaveLength(0);
    });

    it('wykrywa przekroczenie liczby części, wymiaru tygodni oraz terminu 12 miesięcy', () => {
      const scenario = makeScenario({ birthDate: '2026-11-10' });

      expect(
        validatePaternityPlan(
          scenario,
          [
            { startDate: '2026-11-24', weeks: 1 },
            { startDate: '2026-12-10', weeks: 1 },
            { startDate: '2027-01-10', weeks: 1 },
          ],
          DEFAULT_PARAMS,
        ).some((i) => i.code === 'PATERNITY_MAX_PARTS'),
      ).toBe(true);

      expect(
        validatePaternityPlan(
          scenario,
          [{ startDate: '2026-11-24', weeks: 3 }],
          DEFAULT_PARAMS,
        ).some((i) => i.code === 'PATERNITY_MAX_WEEKS'),
      ).toBe(true);

      expect(
        validatePaternityPlan(
          scenario,
          [{ startDate: '2027-11-05', weeks: 2 }],
          DEFAULT_PARAMS,
        ).some((i) => i.code === 'PATERNITY_DEADLINE_EXCEEDED'),
      ).toBe(true);
    });

    it('przy adopcji pilnuje terminu 12 mies. od przyjęcia oraz wieku dziecka poniżej 14 lat', () => {
      const adoptionOk = makeScenario({
        situation: 'adoption',
        birthDate: null,
        expectedBirthDate: null,
        adoptionType: 'adoption',
        childAcceptanceDate: '2026-11-10',
        childAgeYears: 10,
      });
      expect(getPaternityDeadlineDate(adoptionOk, DEFAULT_PARAMS)).toBe('2027-11-10');
      expect(
        validatePaternityPlan(adoptionOk, [{ startDate: '2026-12-01', weeks: 2 }], DEFAULT_PARAMS),
      ).toHaveLength(0);

      const adoptionTooOld = makeScenario({
        situation: 'adoption',
        birthDate: null,
        expectedBirthDate: null,
        adoptionType: 'adoption',
        childAcceptanceDate: '2026-11-10',
        childAgeYears: 14,
      });
      expect(
        validatePaternityPlan(
          adoptionTooOld,
          [{ startDate: '2026-12-01', weeks: 2 }],
          DEFAULT_PARAMS,
        ).some((i) => i.code === 'PATERNITY_ADOPTION_AGE_EXCEEDED'),
      ).toBe(true);
    });
  });

  describe('urlop rodzicielski i łączenie z pracą', () => {
    it('waliduje pulę 41/43 (65/67 z Za życiem), 9 tyg. nieprzenoszalnych, max 5 części oraz jednoczesne korzystanie', () => {
      const scenario = makeScenario({ childrenCount: 1 });

      // Jednoczesne korzystanie matki i ojca (ta sama data startu) jest DOZWOLONE
      const simultaneousParts: LeavePartRequest[] = [
        { parentRole: 'mother', leaveType: 'parentalLeave', startDate: '2027-03-30', weeks: 32 },
        { parentRole: 'father', leaveType: 'parentalLeave', startDate: '2027-03-30', weeks: 9 },
      ];
      expect(
        validateParentalParts(scenario, simultaneousParts, {}, {}, DEFAULT_PARAMS),
      ).toHaveLength(0);

      // Przekroczenie 32 tyg. dla jednego rodzica (9 tyg. nieprzenoszalne)
      const exceedsSingle = validateParentalParts(
        scenario,
        [{ parentRole: 'mother', leaveType: 'parentalLeave', startDate: '2027-03-30', weeks: 33 }],
        {},
        {},
        DEFAULT_PARAMS,
      );
      expect(exceedsSingle.some((i) => i.code === 'PARENTAL_MOTHER_NON_TRANSFERABLE')).toBe(true);

      // Za życiem: pula 65 tyg. dla 1 dziecka -> 56 tyg. dla mamy + 9 tyg. dla taty jest poprawne
      const zaZyciemScenario = makeScenario({
        childrenCount: 1,
        special: { ...makeScenario().special, zaZyciemCertificate: true },
      });
      expect(
        validateParentalParts(
          zaZyciemScenario,
          [
            {
              parentRole: 'mother',
              leaveType: 'parentalLeave',
              startDate: '2027-03-30',
              weeks: 56,
            },
            { parentRole: 'father', leaveType: 'parentalLeave', startDate: '2028-04-25', weeks: 9 },
          ],
          {},
          {},
          DEFAULT_PARAMS,
        ),
      ).toHaveLength(0);

      // Ponad 5 części -> błąd
      const sixParts: LeavePartRequest[] = Array.from({ length: 6 }, (_, i) => ({
        parentRole: i % 2 === 0 ? 'mother' : 'father',
        leaveType: 'parentalLeave',
        startDate: `2027-0${i + 4}-01`,
        weeks: 2,
      }));
      expect(
        validateParentalParts(scenario, sixParts, {}, {}, DEFAULT_PARAMS).some(
          (i) => i.code === 'PARENTAL_MAX_PARTS',
        ),
      ).toBe(true);
    });

    it('pilnuje granicy końca roku kalendarzowego, w którym dziecko kończy 6 lat', () => {
      const scenario = makeScenario({ birthDate: '2026-11-10' });
      expect(getParentalDeadlineDate(scenario, DEFAULT_PARAMS)).toBe('2032-12-31');

      const tooLate = validateParentalParts(
        scenario,
        [{ parentRole: 'father', leaveType: 'parentalLeave', startDate: '2032-12-15', weeks: 4 }],
        {},
        {},
        DEFAULT_PARAMS,
      );
      expect(tooLate.some((i) => i.code === 'PARENTAL_DEADLINE_EXCEEDED')).toBe(true);
    });

    it('waliduje wymiar pracy w trakcie urlopu rodzicielskiego (≤ 1/2 etatu)', () => {
      const scenario = makeScenario();
      const parts: LeavePartRequest[] = [
        { parentRole: 'mother', leaveType: 'parentalLeave', startDate: '2027-03-30', weeks: 12 },
      ];

      expect(validateParentalParts(scenario, parts, { 0: 0.5 }, {}, DEFAULT_PARAMS)).toHaveLength(
        0,
      );
      expect(
        validateParentalParts(scenario, parts, { 0: 0.6 }, {}, DEFAULT_PARAMS).some(
          (i) => i.code === 'PARENTAL_WORK_FRACTION_EXCEEDED',
        ),
      ).toBe(true);
    });

    it('waliduje limity wieku dziecka dla adopcji (14 lat) i rodziny zastępczej (7 / 10 lat)', () => {
      const foster7 = makeScenario({
        situation: 'adoption',
        adoptionType: 'fosterFamily',
        childAcceptanceDate: '2026-11-10',
        childAgeYears: 7,
        schoolObligationDeferred: false,
      });
      expect(
        validateAdoptionAgeLimits(foster7, DEFAULT_PARAMS).some(
          (i) => i.code === 'ADOPTION_CHILD_AGE_EXCEEDED',
        ),
      ).toBe(true);

      const fosterDeferred = makeScenario({
        situation: 'adoption',
        adoptionType: 'fosterFamily',
        childAcceptanceDate: '2026-11-10',
        childAgeYears: 9,
        schoolObligationDeferred: true,
      });
      expect(validateAdoptionAgeLimits(fosterDeferred, DEFAULT_PARAMS)).toHaveLength(0);

      const adoption14 = makeScenario({
        situation: 'adoption',
        adoptionType: 'adoption',
        childAcceptanceDate: '2026-11-10',
        childAgeYears: 14,
      });
      expect(
        validateAdoptionAgeLimits(adoption14, DEFAULT_PARAMS).some(
          (i) => i.code === 'ADOPTION_CHILD_AGE_EXCEEDED',
        ),
      ).toBe(true);
    });
  });

  describe('terminy wniosków i oznaczanie terminów minionych', () => {
    it('generuje termin 21 dni (81,5%), 21 dni przed rodzicielskim, 7 dni przed ojcowskim i oznacza przeterminowane względem referenceDate', () => {
      // Poród 2026-10-01, referenceDate 2026-11-21 -> termin 21 dni po porodzie (2026-10-22) już minął!
      const scenario = makeScenario({
        birthDate: '2026-10-01',
        referenceDate: '2026-11-21',
        rateVariant: 'combined',
      });
      const periods = [
        {
          leaveType: 'maternityLeave' as const,
          parentRole: 'mother' as const,
          startDate: '2026-10-01',
          endDate: '2027-02-17',
          weeks: 20,
          days: 140,
          rate: 0.815,
          monthlyAmount: 4890,
          totalAmount: 22820,
        },
        {
          leaveType: 'parentalLeave' as const,
          parentRole: 'mother' as const,
          startDate: '2027-02-18',
          endDate: '2027-09-29',
          weeks: 32,
          days: 224,
          rate: 0.815,
          monthlyAmount: 4890,
          totalAmount: 36512,
        },
        {
          leaveType: 'paternityLeave' as const,
          parentRole: 'father' as const,
          startDate: '2026-10-15',
          endDate: '2026-10-28',
          weeks: 2,
          days: 14,
          rate: 1.0,
          monthlyAmount: 7000,
          totalAmount: 3266.67,
        },
      ];

      const milestones = buildMilestones(scenario, periods, DEFAULT_MAT_OPTIONS, DEFAULT_PARAMS);

      const combinedDeadline = milestones.find((m) => m.label.includes('81,5%'));
      expect(combinedDeadline).toBeDefined();
      expect(combinedDeadline?.date).toBe('2026-10-22');
      expect(combinedDeadline?.isPast).toBe(true);

      const paternityDeadline = milestones.find((m) => m.label.includes('ojcowski'));
      expect(paternityDeadline).toBeDefined();
      expect(paternityDeadline?.date).toBe('2026-10-08');
      expect(paternityDeadline?.isPast).toBe(true);

      const parentalDeadline = milestones.find((m) => m.label.includes('rodzicielski'));
      expect(parentalDeadline).toBeDefined();
      expect(parentalDeadline?.date).toBe('2027-01-28');
      expect(parentalDeadline?.isPast).toBe(false);
    });
  });
});
