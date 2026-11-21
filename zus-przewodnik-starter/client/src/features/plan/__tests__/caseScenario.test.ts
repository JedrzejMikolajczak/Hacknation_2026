import { describe, expect, it } from 'vitest';
import { calculateCasePlan } from '@shared/engine/casePlan';
import params from '@shared/params.json';
import type { ScenarioDraft } from '../../../app/scenarioDraft';
import { wizardCase } from '../caseScenario';

const bothParentsDraft: ScenarioDraft = {
  situation: 'afterBirth',
  referenceDate: '2026-11-21',
  birthDate: '2026-11-10',
  expectedBirthDate: null,
  childrenCount: 1,
  childAcceptanceDate: null,
  childAgeYears: null,
  adoptionType: null,
  rateVariant: 'combined',
  mother: {
    role: 'mother',
    insuranceTitle: 'employment',
    sicknessInsurance: 'mandatory',
    insuredSince: '2020-01-01',
    insuranceEndDate: null,
    benefitBase: 6903.2,
    contributionDebt: null,
    employerInsuredCount: 150,
    age: 31,
    wantsLeave: true,
  },
  father: {
    role: 'father',
    insuranceTitle: 'employment',
    sicknessInsurance: 'mandatory',
    insuredSince: '2019-01-01',
    insuranceEndDate: null,
    benefitBase: 5000,
    contributionDebt: null,
    employerInsuredCount: 10,
    wantsLeave: true,
  },
  special: {
    zaZyciemCertificate: false,
    motherHospitalized: false,
    motherIncapableOfIndependentLiving: false,
    motherDeceased: false,
  },
};

describe('wizardCase', () => {
  it('dla obojga rodziców tworzy okresy matki i ojca (9 tyg. 70% + 2 tyg. ojcowskiego 100%) oraz 81,5% z terminem', () => {
    const input = wizardCase(bothParentsDraft, params);
    expect(input).not.toBeNull();
    expect(input!.father_parental_weeks).toBe(params.parentalLeave.nonTransferableWeeksPerParent);
    expect(input!.paternity_leave_start_date).toBe('2026-11-28');
    expect(input!.other_parent).toMatchObject({
      employment_type: 'UOP',
      payer_insured_count_nov_30: '<= 20',
      benefit_base_amount_pln: 5000,
    });

    const plan = calculateCasePlan(input!, params);
    expect(plan.outcome.applied_payment_variant).toBe('COMBINED_81_5');
    expect(plan.outcome.variants.COMBINED_81_5).not.toBeNull();
    expect(plan.outcome.variants.SPLIT_100_70).not.toBeNull();
    expect(
      plan.outcome.warnings.some(
        (w) => w.code === 'COMBINED_RATE_DEADLINE' && w.message_pl.includes('01.12.2026'),
      ),
    ).toBe(true);
    expect(
      plan.outcome.periods.map(
        ({ parent_role, leave_type, weeks, rate_percent, monthly_amount_pln }) => [
          parent_role,
          leave_type,
          weeks,
          rate_percent,
          monthly_amount_pln,
        ],
      ),
    ).toEqual([
      ['MOTHER', 'MATERNITY', 20, 81.5, 5626.11],
      ['MOTHER', 'PARENTAL', 32, 81.5, 5626.11],
      ['FATHER', 'PARENTAL', 9, 70, 3500],
      ['FATHER', 'PATERNITY', 2, 100, 5000],
    ]);
    expect(plan.documents.some((doc) => doc.is_overdue)).toBe(false);
  });

  it('przekazuje benefitBaseInputs.father gdy ojciec nie zna podstawy wprost', () => {
    const draft: ScenarioDraft = {
      ...bothParentsDraft,
      father: {
        ...bothParentsDraft.father,
        insuranceTitle: 'selfEmployed',
        sicknessInsurance: 'voluntary',
        benefitBase: null,
        employerInsuredCount: null,
      },
      benefitBaseInputs: {
        father: {
          insuranceTitle: 'selfEmployed',
          rightArisesOn: '2026-11-10',
          incomes: [],
          contractMonthlySalary: null,
          declaredContributionBase: 5203.8,
          previousBenefitEndDate: null,
          previousBenefitBase: null,
        },
      },
    };
    const input = wizardCase(draft, params);
    expect(input?.other_parent?.monthly_bases).toEqual([{ month: '2026-10', amount_pln: 5203.8 }]);
    const plan = calculateCasePlan(input!, params);
    const fatherParental = plan.outcome.periods.find(
      (p) => p.parent_role === 'FATHER' && p.leave_type === 'PARENTAL',
    );
    expect(fatherParental?.benefit_base_pln).toBe(4490.36);
    expect(fatherParental?.monthly_amount_pln).toBe(3143.25);
  });

  it('dla matki nieubezpieczonej i ojca ubezpieczonego przydziela ojcu pełną pulę indywidualną i ojcowski', () => {
    const draft: ScenarioDraft = {
      ...bothParentsDraft,
      mother: {
        ...bothParentsDraft.mother,
        insuranceTitle: 'none',
        sicknessInsurance: 'none',
        benefitBase: null,
        employerInsuredCount: null,
      },
    };
    const input = wizardCase(draft, params);
    expect(input?.father_parental_weeks).toBe(32);
    const plan = calculateCasePlan(input!, params);
    expect(plan.outcome.periods.map((p) => [p.parent_role, p.leave_type, p.weeks])).toEqual([
      ['FATHER', 'PARENTAL', 32],
      ['FATHER', 'PATERNITY', 2],
    ]);
  });

  it('gdy ojciec nie chce urlopu (wantsLeave: false), nie dodaje okresów ojca', () => {
    const draft: ScenarioDraft = {
      ...bothParentsDraft,
      father: { ...bothParentsDraft.father, wantsLeave: false },
    };
    const input = wizardCase(draft, params);
    expect(input?.father_parental_weeks).toBe(0);
    expect(input?.paternity_leave_start_date).toBeUndefined();
    const plan = calculateCasePlan(input!, params);
    expect(plan.outcome.periods.every((p) => p.parent_role === 'MOTHER')).toBe(true);
  });

  it('dla samodzielnej matki przekazuje co_parenting: false i generuje wyjaśnienie o 9 tyg.', () => {
    const draft: ScenarioDraft = {
      ...bothParentsDraft,
      father: null,
    };
    const input = wizardCase(draft, params);
    expect(input?.co_parenting).toBe(false);
    const plan = calculateCasePlan(input!, params);
    expect(plan.outcome.periods.every((p) => p.parent_role === 'MOTHER')).toBe(true);
    expect(plan.outcome.warnings.some((w) => w.code === 'NON_TRANSFERABLE_PARENTAL_PART')).toBe(
      true,
    );
  });

  it('dla rodziny zastępczej nie planuje urlopu ojcowskiego', () => {
    const draft: ScenarioDraft = {
      ...bothParentsDraft,
      situation: 'adoption',
      birthDate: null,
      childAcceptanceDate: '2026-11-10',
      childAgeYears: 3,
      adoptionType: 'fosterFamily',
    };
    const input = wizardCase(draft, params);
    expect(input?.paternity_leave_start_date).toBeUndefined();
    const plan = calculateCasePlan(input!, params);
    expect(plan.outcome.periods.some((p) => p.leave_type === 'PATERNITY')).toBe(false);
    expect(
      plan.entitlements.find((e) => e.parent_role === 'FATHER' && e.benefit_type === 'PATERNITY')
        ?.is_qualified,
    ).toBe(false);
  });
});
