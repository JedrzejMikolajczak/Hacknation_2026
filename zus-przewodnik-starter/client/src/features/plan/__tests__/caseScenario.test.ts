import { describe, expect, it } from 'vitest';
import { calculateCasePlan } from '@shared/engine/casePlan';
import params from '@shared/params.json';
import type { ScenarioDraft } from '../../../app/scenarioDraft';
import { wizardCase } from '../caseScenario';
import { buildScenario } from '../../wizard/wizardModel';

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
  it('przekazuje z kreatora datę porzucenia i drugie ubezpieczenie, bez profilu matki', () => {
    const draft = buildScenario('afterBirth', {
      family: 'both',
      birthDate: '2026-10-10',
      childrenCount: '1',
      motherSituation: 'abandoned',
      motherAbandonmentDate: '2026-10-20',
      motherWasInsuredAtAbandonment: 'no',
      'father.insuranceTitle': 'employment',
      'additionalInsurance.insuranceTitle': 'mandateContract',
      'additionalInsurance.sicknessInsured': 'yes',
      'additionalInsurance.benefitBase': '3000',
    });
    const input = wizardCase(draft, params);

    expect(draft.mother).toBeNull();
    expect(input).toMatchObject({
      applicant_role: 'FATHER',
      co_parenting: false,
      mother_abandonment_date: '2026-10-20',
      mother_was_insured_at_abandonment: false,
      additional_insurance_titles: [{
        employment_type: 'ZLECENIE',
        sickness_insured: true,
        benefit_base_amount_pln: 3000,
      }],
    });
    expect(input?.other_parent).toBeUndefined();
  });

  it('przekazuje potwierdzony wyrok i liczbę zmarłych dzieci do silnika', () => {
    const draft = buildScenario('afterBirth', {
      family: 'motherOnly',
      birthDate: '2026-10-10',
      childrenCount: '3',
      birthOutcome: 'childDeath',
      childDeathDate: '2026-10-15',
      deceasedChildrenCount: '2',
      employerBankruptcyOrLiquidation: 'unlawful',
      unlawfulTerminationDate: '2026-06-10',
      'mother.insuranceTitle': 'employment',
    });
    const input = wizardCase(draft, params);

    expect(input).toMatchObject({
      contract_end_date: '2026-06-10',
      children_count: 3,
      living_children_count: 1,
      deceased_children_count: 2,
      child_death_date: '2026-10-15',
      special_circumstances: { unlawful_termination_confirmed_by_court: true },
    });
  });
  it('planuje przejęcie macierzyńskiego od dnia po zgonie mamy', () => {
    const input = wizardCase(
      {
        ...bothParentsDraft,
        mother: null,
        motherDeathDate: '2026-11-15',
        special: { motherDeceased: true },
      },
      params,
    )!;
    const plan = calculateCasePlan(input, params);
    expect(input).toMatchObject({ applicant_role: 'FATHER', father_takeover_date: '2026-11-16' });
    expect(plan.outcome.periods).toContainEqual(
      expect.objectContaining({
        parent_role: 'FATHER',
        leave_type: 'MATERNITY',
        start_date: '2026-11-16',
      }),
    );
    expect(plan.outcome.periods.some((period) => period.parent_role === 'MOTHER')).toBe(false);
    expect(plan.documents).toContainEqual(
      expect.objectContaining({
        parent_role: 'FATHER',
        id: 'TAKEOVER',
        start_date: '2026-11-16',
        deadline: null,
      }),
    );
    const periods = [...plan.outcome.periods].sort((a, b) =>
      a.start_date.localeCompare(b.start_date),
    );
    expect(periods.map((period) => period.leave_type)).toEqual([
      'MATERNITY',
      'PATERNITY',
      'PARENTAL',
    ]);
    expect(
      periods.every(
        (period, index) => index === 0 || periods[index - 1].end_date < period.start_date,
      ),
    ).toBe(true);
  });

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

  it('dla matki ubezpieczonej 2 miesiące przed przewidywanym porodem mapuje staż i wywołuje SHAM_CONTRACT_RISK', () => {
    const draft: ScenarioDraft = {
      ...bothParentsDraft,
      situation: 'pregnant',
      referenceDate: '2026-11-21',
      birthDate: null,
      expectedBirthDate: '2027-01-21',
      mother: {
        ...bothParentsDraft.mother,
        insuredSince: '2026-11-21',
      },
    };
    const input = wizardCase(draft, params);
    expect(input?.title_start_date).toBe('2026-11-21');
    expect(input?.insurance_duration_days).toBe(61);

    const plan = calculateCasePlan(input!, params);
    const codes = plan.outcome.warnings.map((w) => w.code);
    expect(codes).toContain('SHAM_CONTRACT_RISK');
    expect(codes).toContain('WAITING_PERIOD_NOT_MET');
    expect(codes.indexOf('WAITING_PERIOD_NOT_MET')).toBeLessThan(
      codes.indexOf('SHAM_CONTRACT_RISK'),
    );
    expect(plan.outcome.warnings.every((w) => Boolean(w.legal_basis))).toBe(true);
    expect(plan.outcome.warnings.every((w) => w.message_pl.includes('Co zrobić:'))).toBe(true);
  });

  it('dla formularza ze średnim wynagrodzeniem nie wymyśla BASE_INCREASE_IN_PREGNANCY', () => {
    const draft: ScenarioDraft = {
      ...bothParentsDraft,
      mother: {
        ...bothParentsDraft.mother,
        benefitBase: null,
      },
      benefitBaseInputs: {
        mother: {
          insuranceTitle: 'employment',
          rightArisesOn: '2026-11-10',
          incomes: [
            { month: '2026-01', grossAmount: 9500, workedDays: null, requiredWorkingDays: null },
            { month: '2026-06', grossAmount: 9500, workedDays: null, requiredWorkingDays: null },
            { month: '2026-10', grossAmount: 9500, workedDays: null, requiredWorkingDays: null },
          ],
          contractMonthlySalary: 9500,
          declaredContributionBase: null,
          previousBenefitEndDate: null,
          previousBenefitBase: null,
        },
      },
    };
    const plan = calculateCasePlan(wizardCase(draft, params)!, params);
    expect(plan.outcome.warnings.some((w) => w.code === 'BASE_INCREASE_IN_PREGNANCY')).toBe(false);
  });

  it('dla umowy o pracę na czas określony przedłużanej do porodu z formularza NIE zgłasza fałszywego CONTRACT_ENDS_BEFORE_BIRTH', () => {
    const draft: ScenarioDraft = {
      ...bothParentsDraft,
      situation: 'pregnant',
      referenceDate: '2026-11-21',
      birthDate: null,
      expectedBirthDate: '2027-02-01',
      mother: {
        ...bothParentsDraft.mother,
        insuranceTitle: 'employment',
        sicknessInsurance: 'mandatory',
        insuredSince: '2023-01-01',
        insuranceEndDate: '2026-12-31',
      },
    };
    const input = wizardCase(draft, params);
    expect(input?.contract_type).toBe('FIXED_TERM');

    const plan = calculateCasePlan(input!, params);
    expect(plan.outcome.is_qualified).toBe(true);
    expect(plan.outcome.warnings.some((w) => w.code === 'CONTRACT_ENDS_BEFORE_BIRTH')).toBe(false);
    expect(plan.outcome.warnings.some((w) => w.code === 'CONTRACT_EXTENDED_TO_BIRTH')).toBe(true);
  });

  it('dla umowy zlecenia kończącej się przed porodem oraz niezgłoszonego chorobowego zgłasza właściwe ryzyka z formularza', () => {
    const mandateEndDraft: ScenarioDraft = {
      ...bothParentsDraft,
      situation: 'pregnant',
      referenceDate: '2026-11-21',
      birthDate: null,
      expectedBirthDate: '2027-02-01',
      mother: {
        ...bothParentsDraft.mother,
        insuranceTitle: 'mandateContract',
        sicknessInsurance: 'voluntary',
        insuredSince: '2023-01-01',
        insuranceEndDate: '2026-12-31',
        employerInsuredCount: 50,
      },
    };
    const mandatePlan = calculateCasePlan(wizardCase(mandateEndDraft, params)!, params);
    expect(mandatePlan.outcome.warnings.some((w) => w.code === 'CONTRACT_ENDS_BEFORE_BIRTH')).toBe(
      true,
    );

    const noVoluntaryDraft: ScenarioDraft = {
      ...bothParentsDraft,
      situation: 'pregnant',
      referenceDate: '2026-11-21',
      birthDate: null,
      expectedBirthDate: '2027-02-01',
      mother: {
        ...bothParentsDraft.mother,
        insuranceTitle: 'selfEmployed',
        sicknessInsurance: 'none',
        insuredSince: null,
        insuranceEndDate: null,
        employerInsuredCount: null,
      },
    };
    const noVoluntaryPlan = calculateCasePlan(wizardCase(noVoluntaryDraft, params)!, params);
    expect(
      noVoluntaryPlan.outcome.warnings.some((w) => w.code === 'NO_INSURANCE_ON_BIRTH_DATE'),
    ).toBe(true);
  });

  it('dla JDG z zadłużeniem powyżej 1% płacy minimalnej zgłasza SELF_EMPLOYED_DEBT z formularza', () => {
    const debtDraft: ScenarioDraft = {
      ...bothParentsDraft,
      situation: 'pregnant',
      referenceDate: '2026-11-21',
      birthDate: null,
      expectedBirthDate: '2027-02-01',
      mother: {
        ...bothParentsDraft.mother,
        insuranceTitle: 'selfEmployed',
        sicknessInsurance: 'voluntary',
        insuredSince: '2023-01-01',
        insuranceEndDate: null,
        employerInsuredCount: null,
        contributionDebt: 150,
      },
    };
    const input = wizardCase(debtDraft, params);
    expect(input?.has_b2b_arrears).toBe(true);
    expect(input?.debt_amount_pln).toBe(150);

    const plan = calculateCasePlan(input!, params);
    expect(plan.outcome.warnings.some((w) => w.code === 'SELF_EMPLOYED_DEBT')).toBe(true);
  });

  it('dla dobrowolnego ubezpieczenia trwającego krócej niż 90 dni zgłasza WAITING_PERIOD_NOT_MET z formularza', () => {
    const waitingDraft: ScenarioDraft = {
      ...bothParentsDraft,
      situation: 'pregnant',
      referenceDate: '2026-11-21',
      birthDate: null,
      expectedBirthDate: '2027-05-01',
      mother: {
        ...bothParentsDraft.mother,
        insuranceTitle: 'selfEmployed',
        sicknessInsurance: 'voluntary',
        insuredSince: '2026-10-01',
        insuranceEndDate: null,
        employerInsuredCount: null,
        contributionDebt: 0,
      },
    };
    const plan = calculateCasePlan(wizardCase(waitingDraft, params)!, params);
    const waiting = plan.outcome.warnings.find((w) => w.code === 'WAITING_PERIOD_NOT_MET');
    expect(waiting).toBeDefined();
    expect(waiting?.message_pl).toContain(`${params.sickness.waitingPeriodDaysVoluntary} dni`);
  });
});
