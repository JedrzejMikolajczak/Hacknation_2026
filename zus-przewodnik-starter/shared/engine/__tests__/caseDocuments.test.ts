import { describe, expect, it } from 'vitest';
import params from '../../params.json';
import type { CaseInputs } from '../../types';
import { calculateCasePlan } from '../casePlan';

function baseInput(overrides: Partial<CaseInputs> = {}): CaseInputs {
  return {
    applicant_role: 'MOTHER',
    stage: 'POST_BIRTH',
    co_parenting: false,
    other_parent_insured: null,
    employment_type: 'UOP',
    contract_type: 'INDEFINITE',
    contract_end_date: null,
    payer_insured_count_nov_30: '> 20',
    voluntary_sickness_insured: false,
    insurance_duration_days: null,
    has_b2b_arrears: false,
    applicant_age_50_plus: false,
    benefit_base_amount_pln: 6000,
    due_or_birth_date: '2026-11-10',
    application_date: null,
    days_from_birth_to_application: null,
    children_count: 1,
    requested_payment_variant: 'COMBINED_81_5',
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
    reference_date: '2026-11-21',
    title_start_date: '2020-01-01',
    ...overrides,
  };
}

describe('documentsForPlan (caseDocuments)', () => {
  it('umowa o pracę > 20: składa dokumenty u pracodawcy bez Z-3 i ZAS-12', () => {
    const plan = calculateCasePlan(
      baseInput({ employment_type: 'UOP', payer_insured_count_nov_30: '> 20' }),
      params,
    );
    const ids = plan.documents.map((doc) => doc.id);

    expect(plan.outcome.who_pays).toBe('EMPLOYER');
    expect(ids).toContain('ZAM');
    expect(ids).toContain('BIRTH_CERTIFICATE');
    expect(ids).toContain('USC_COPY');
    expect(ids).toContain('COMBINED_RATE');
    expect(ids).toContain('PARENTAL_REQUEST');
    expect(ids).not.toContain('Z-3');
    expect(ids).not.toContain('Z-3a');
    expect(ids).not.toContain('ZAS-12');
    expect(plan.documents.find((doc) => doc.id === 'ZAM')?.submit_to).toBe('EMPLOYER');
    expect(plan.documents.find((doc) => doc.id === 'COMBINED_RATE')?.deadline).toBe('2026-12-01');
  });

  it('umowa o pracę ≤ 20: składa wnioski u pracodawcy, a pracodawca przekazuje Z-3 do ZUS', () => {
    const plan = calculateCasePlan(
      baseInput({ employment_type: 'UOP', payer_insured_count_nov_30: '<= 20' }),
      params,
    );
    const ids = plan.documents.map((doc) => doc.id);

    expect(plan.outcome.who_pays).toBe('ZUS');
    expect(ids).toContain('ZAM');
    expect(ids).toContain('Z-3');
    expect(ids).not.toContain('Z-3a');
    expect(ids).not.toContain('ZAS-12');
    expect(plan.documents.find((doc) => doc.id === 'ZAM')?.submit_to).toBe('EMPLOYER');
    expect(plan.documents.find((doc) => doc.id === 'Z-3')?.submit_to).toBe('ZUS');
  });

  it('umowa zlecenie > 20: składa ZAM u uprawnionego zleceniodawcy (wypłaca płatnik, bez Z-3a)', () => {
    const plan = calculateCasePlan(
      baseInput({
        employment_type: 'ZLECENIE',
        voluntary_sickness_insured: true,
        payer_insured_count_nov_30: '> 20',
      }),
      params,
    );
    const ids = plan.documents.map((doc) => doc.id);
    const zam = plan.documents.find((doc) => doc.id === 'ZAM');

    expect(plan.outcome.who_pays).toBe('EMPLOYER');
    expect(zam?.submit_to).toBe('EMPLOYER');
    expect(zam?.name_pl).toContain('zleceniodawc');
    expect(ids).not.toContain('Z-3a');
    expect(ids).not.toContain('Z-3');
    expect(plan.documents.find((doc) => doc.id === 'BIRTH_CERTIFICATE')?.submit_to).toBe(
      'EMPLOYER',
    );
    expect(plan.documents.find((doc) => doc.id === 'COMBINED_RATE')?.submit_to).toBe('EMPLOYER');
    expect(plan.documents.find((doc) => doc.id === 'PARENTAL_REQUEST')?.submit_to).toBe('EMPLOYER');
  });

  it('umowa zlecenie ≤ 20: składa ZAM w ZUS, a zleceniodawca przekazuje Z-3a do ZUS', () => {
    const plan = calculateCasePlan(
      baseInput({
        employment_type: 'ZLECENIE',
        voluntary_sickness_insured: true,
        payer_insured_count_nov_30: '<= 20',
      }),
      params,
    );
    const ids = plan.documents.map((doc) => doc.id);

    expect(plan.outcome.who_pays).toBe('ZUS');
    expect(ids).toContain('ZAM');
    expect(ids).toContain('Z-3a');
    expect(ids).not.toContain('Z-3');
    expect(plan.documents.find((doc) => doc.id === 'ZAM')?.submit_to).toBe('ZUS');
    expect(plan.documents.find((doc) => doc.id === 'Z-3a')?.submit_to).toBe('ZUS');
  });

  it('ustala płatnika niezależnie dla drugiego rodzica na zleceniu > 20', () => {
    const plan = calculateCasePlan(
      baseInput({
        co_parenting: true,
        other_parent_insured: true,
        employment_type: 'UOP',
        payer_insured_count_nov_30: '<= 20',
        father_parental_weeks: params.parentalLeave.nonTransferableWeeksPerParent,
        other_parent: {
          employment_type: 'ZLECENIE',
          voluntary_sickness_insured: true,
          payer_insured_count_nov_30: '> 20',
          benefit_base_amount_pln: 5000,
          title_start_date: '2020-01-01',
        },
      }),
      params,
    );
    const motherDocs = plan.documents.filter((doc) => doc.parent_role === 'MOTHER');
    const fatherDocs = plan.documents.filter((doc) => doc.parent_role === 'FATHER');

    expect(motherDocs.some((doc) => doc.id === 'Z-3')).toBe(true);
    expect(fatherDocs.some((doc) => doc.id === 'Z-3a')).toBe(false);
    expect(fatherDocs.find((doc) => doc.id === 'ZAM')?.submit_to).toBe('EMPLOYER');
    expect(fatherDocs.find((doc) => doc.id === 'PARENTAL_REQUEST')?.submit_to).toBe('EMPLOYER');
  });

  it('JDG (B2B): zawsze ZUS, ZAM dla macierzyńskiego, ZAS-53 dla chorobowego, bez Z-3 / Z-3a / Z-3b / ZAS-12', () => {
    const plan = calculateCasePlan(
      baseInput({
        employment_type: 'B2B',
        voluntary_sickness_insured: true,
        payer_insured_count_nov_30: null,
        sickness_leave_start_date: '2026-09-01',
        sickness_leave_end_date: '2026-11-09',
        special_circumstances: {
          ...baseInput().special_circumstances,
          has_code_b_on_ezla: true,
        },
      }),
      params,
    );
    const ids = plan.documents.map((doc) => doc.id);

    expect(plan.outcome.who_pays).toBe('ZUS');
    expect(ids).toContain('ZAM');
    expect(ids).toContain('e-ZLA');
    expect(ids).toContain('ZAS-53');
    expect(ids).not.toContain('Z-3');
    expect(ids).not.toContain('Z-3a');
    expect(ids).not.toContain('Z-3b');
    expect(ids).not.toContain('ZAS-12');
    expect(plan.documents.find((doc) => doc.id === 'ZAM')?.submit_to).toBe('ZUS');
    expect(plan.documents.find((doc) => doc.id === 'ZAS-53')?.submit_to).toBe('ZUS');
  });

  it('martwe urodzenie (1 dziecko): odrębna pozycja zaświadczenia / aktu z adnotacją o martwym urodzeniu, bez stawki 81,5%', () => {
    const plan = calculateCasePlan(
      baseInput({
        children_count: 1,
        living_children_count: 0,
        special_circumstances: {
          ...baseInput().special_circumstances,
          stillbirth_or_child_death: 'BEFORE_8_WEEKS',
        },
      }),
      params,
    );
    const ids = plan.documents.map((doc) => doc.id);
    const stillbirthDoc = plan.documents.find((doc) => doc.id === 'STILLBIRTH_CERTIFICATE');

    expect(stillbirthDoc).toBeDefined();
    expect(stillbirthDoc?.name_pl).toContain('martwym urodzeniu');
    expect(stillbirthDoc?.name_pl).not.toContain('!');
    expect(stillbirthDoc?.submit_to).toBe('EMPLOYER');
    expect(ids).not.toContain('BIRTH_CERTIFICATE');
    expect(ids).not.toContain('COMBINED_RATE');
    expect(ids).not.toContain('PARENTAL_REQUEST');
    expect(ids).toContain('USC_COPY');
  });

  it('zgon dziecka po urodzeniu: odpis aktu urodzenia oraz odrębny odpis aktu zgonu dziecka', () => {
    const plan = calculateCasePlan(
      baseInput({
        children_count: 1,
        living_children_count: 0,
        due_or_birth_date: '2026-11-10',
        child_death_date: '2026-11-20',
        special_circumstances: {
          ...baseInput().special_circumstances,
          stillbirth_or_child_death: 'BEFORE_8_WEEKS',
        },
      }),
      params,
    );
    const ids = plan.documents.map((doc) => doc.id);

    expect(ids).toContain('BIRTH_CERTIFICATE');
    expect(ids).toContain('DEATH_CERTIFICATE');
    expect(ids).not.toContain('STILLBIRTH_CERTIFICATE');
    expect(ids).not.toContain('COMBINED_RATE');
  });

  it('ciąża bez daty zwolnienia: pokazuje e-ZLA (kod B) i dokument właściwy dla każdego tytułu ubezpieczenia', () => {
    // UoP ≤ 20 bez daty zwolnienia i bez daty porodu
    const uopSmall = calculateCasePlan(
      baseInput({
        stage: 'PREGNANCY',
        due_or_birth_date: null,
        employment_type: 'UOP',
        payer_insured_count_nov_30: '<= 20',
      }),
      params,
    );
    expect(uopSmall.documents.map((d) => d.id)).toEqual(['Z-3', 'e-ZLA']);
    expect(uopSmall.documents.find((d) => d.id === 'e-ZLA')?.name_pl).toContain('kod „B”');
    expect(uopSmall.documents.find((d) => d.id === 'e-ZLA')?.submit_to).toBe('ZUS');

    // UoP > 20
    const uopLarge = calculateCasePlan(
      baseInput({
        stage: 'PREGNANCY',
        due_or_birth_date: null,
        employment_type: 'UOP',
        payer_insured_count_nov_30: '> 20',
      }),
      params,
    );
    expect(uopLarge.documents.map((d) => d.id)).toEqual(['e-ZLA']);
    expect(uopLarge.documents[0].submit_to).toBe('EMPLOYER');

    // Zlecenie > 20
    const mandateLarge = calculateCasePlan(
      baseInput({
        stage: 'PREGNANCY',
        due_or_birth_date: null,
        employment_type: 'ZLECENIE',
        voluntary_sickness_insured: true,
        payer_insured_count_nov_30: '> 20',
      }),
      params,
    );
    expect(mandateLarge.documents.map((d) => d.id)).toEqual(['e-ZLA']);
    expect(mandateLarge.documents[0].submit_to).toBe('EMPLOYER');
    expect(mandateLarge.documents[0].name_pl).toContain('zleceniodawc');

    // Zlecenie ≤ 20
    const mandateSmall = calculateCasePlan(
      baseInput({
        stage: 'PREGNANCY',
        due_or_birth_date: null,
        employment_type: 'ZLECENIE',
        voluntary_sickness_insured: true,
        payer_insured_count_nov_30: '<= 20',
      }),
      params,
    );
    expect(mandateSmall.documents.map((d) => d.id)).toEqual(['Z-3a', 'e-ZLA']);

    // JDG
    const b2b = calculateCasePlan(
      baseInput({
        stage: 'PREGNANCY',
        due_or_birth_date: null,
        employment_type: 'B2B',
        voluntary_sickness_insured: true,
        payer_insured_count_nov_30: null,
      }),
      params,
    );
    expect(b2b.documents.map((d) => d.id)).toEqual(['e-ZLA', 'ZAS-53']);
    expect(b2b.documents.find((d) => d.id === 'ZAS-53')?.submit_to).toBe('ZUS');
  });

  it('ZAS-12 pojawia się wyłącznie dla dalszego okresu zasiłku chorobowego (UoP ≤ 20), a nie domyślnie', () => {
    // Pierwszy okres zasiłku chorobowego (brak wcześniej wykorzystanych dni zasiłku)
    const firstPeriod = calculateCasePlan(
      baseInput({
        stage: 'PREGNANCY',
        employment_type: 'UOP',
        payer_insured_count_nov_30: '<= 20',
        sickness_leave_start_date: '2026-09-01',
        sickness_leave_end_date: '2026-10-20',
        special_circumstances: {
          ...baseInput().special_circumstances,
          has_code_b_on_ezla: true,
        },
      }),
      params,
    );
    expect(firstPeriod.documents.some((d) => d.id === 'Z-3')).toBe(true);
    expect(firstPeriod.documents.some((d) => d.id === 'ZAS-12')).toBe(false);

    // Dalszy okres zasiłku chorobowego (sickness_benefit_days_already_used > 0)
    const furtherPeriod = calculateCasePlan(
      baseInput({
        stage: 'PREGNANCY',
        employment_type: 'UOP',
        payer_insured_count_nov_30: '<= 20',
        sickness_leave_start_date: '2026-09-01',
        sickness_leave_end_date: '2026-10-20',
        sickness_benefit_days_already_used: 30,
        special_circumstances: {
          ...baseInput().special_circumstances,
          has_code_b_on_ezla: true,
        },
      }),
      params,
    );
    expect(furtherPeriod.documents.some((d) => d.id === 'ZAS-12')).toBe(true);
    expect(furtherPeriod.documents.find((d) => d.id === 'ZAS-12')?.submit_to).toBe('ZUS');
  });

  it('rozpoczęcie urlopu macierzyńskiego przed porodem (do 6 tyg.): zawiera zaświadczenie o przewidywanej dacie porodu', () => {
    const plan = calculateCasePlan(
      baseInput({
        due_or_birth_date: '2026-11-10',
        maternity_leave_start_date: '2026-10-15',
      }),
      params,
    );
    const cert = plan.documents.find((doc) => doc.id === 'EXPECTED_BIRTH_CERTIFICATE');

    expect(cert).toBeDefined();
    expect(cert?.name_pl).toContain('przewidywanej dacie porodu');
    expect(cert?.submit_to).toBe('EMPLOYER');

    // Gdy urlop zaczyna się w dniu porodu – zaświadczenie nie jest wymagane
    const onBirth = calculateCasePlan(
      baseInput({ due_or_birth_date: '2026-11-10', maternity_leave_start_date: '2026-11-10' }),
      params,
    );
    expect(onBirth.documents.some((doc) => doc.id === 'EXPECTED_BIRTH_CERTIFICATE')).toBe(false);
  });

  it('adopcja i rodzina zastępcza: właściwe dokumenty przyjęcia dziecka i brak odpisu z USC', () => {
    const adoption = calculateCasePlan(
      baseInput({
        stage: 'ADOPTION',
        adoption_type: 'ADOPTION',
        due_or_birth_date: null,
        adopted_or_foster_child_acceptance_date: '2026-11-10',
        special_circumstances: {
          ...baseInput().special_circumstances,
          adopted_or_foster_child_age_years: 4,
        },
      }),
      params,
    );
    const adoptionIds = adoption.documents.map((d) => d.id);
    expect(adoptionIds).toContain('ZAM');
    expect(adoptionIds).toContain('ADOPTION_ORDER');
    expect(adoptionIds).toContain('ADOPTION_LEAVE');
    expect(adoptionIds).not.toContain('BIRTH_CERTIFICATE');
    expect(adoptionIds).not.toContain('USC_COPY');
    expect(adoption.documents.find((d) => d.id === 'ADOPTION_ORDER')?.name_pl).toContain(
      'przysposobienie',
    );
    expect(adoption.documents.find((d) => d.id === 'ADOPTION_LEAVE')?.deadline).toBe('2026-11-17');

    const foster = calculateCasePlan(
      baseInput({
        stage: 'ADOPTION',
        adoption_type: 'FOSTER_FAMILY',
        due_or_birth_date: null,
        adopted_or_foster_child_acceptance_date: '2026-11-10',
        special_circumstances: {
          ...baseInput().special_circumstances,
          adopted_or_foster_child_age_years: 5,
        },
      }),
      params,
    );
    expect(foster.documents.find((d) => d.id === 'ADOPTION_ORDER')?.name_pl).toContain(
      'rodziny zastępczej niezawodowej',
    );
  });

  it('brak informacji o wielkości płatnika nie wymyśla płatnika (submit_to: null)', () => {
    const plan = calculateCasePlan(
      baseInput({
        employment_type: 'ZLECENIE',
        voluntary_sickness_insured: true,
        payer_insured_count_nov_30: null,
      }),
      params,
    );
    expect(plan.documents.find((d) => d.id === 'ZAM')?.submit_to).toBeNull();
    expect(plan.documents.some((d) => d.id === 'Z-3a')).toBe(false);
  });
});
