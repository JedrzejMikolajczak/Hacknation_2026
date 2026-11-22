import { z } from 'zod';
import type { CaseInputs } from '@shared/types';

const day = z.iso.date();
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const money = z.number().nonnegative();
const count = z.number().int().nonnegative();
const yesNo = z.boolean().nullable();
const parent = z.enum(['MOTHER', 'FATHER']);
const pay = z.enum(['<= 20', '> 20']).nullable();
const title = z.enum(['UOP', 'B2B', 'ZLECENIE', 'NONE']);
const contractType = z.enum(['INDEFINITE', 'FIXED_TERM', 'PROBATION', 'REPLACEMENT']);
const fraction = z.number().min(0).max(1);
const weight = z.number().int().positive();

const monthlyBases = z.array(z.strictObject({
  month,
  amount_pln: money,
  excluded_bonus_pln: money.optional(),
}));
const insuranceTitle = z.strictObject({
  employment_type: title,
  payer_insured_count_nov_30: pay,
  benefit_base_amount_pln: money.nullable(),
  voluntary_sickness_insured: yesNo,
  contract_end_date: day.nullable().optional(),
  has_b2b_arrears: yesNo.optional(),
  monthly_bases: monthlyBases.optional(),
  title_start_date: day.nullable().optional(),
  debt_amount_pln: money.nullable().optional(),
});
const additionalInsuranceTitle = insuranceTitle.extend({
  employment_type: title.exclude(['NONE']),
  sickness_insured: yesNo,
  contract_type: contractType.nullable().optional(),
  insurance_duration_days: count.nullable().optional(),
});

export const caseInputSchema = z
  .strictObject({
    applicant_role: parent,
    stage: z.enum(['PLANNING', 'PREGNANCY', 'POST_BIRTH', 'ADOPTION']),
    co_parenting: z.boolean(),
    other_parent_insured: yesNo,
    employment_type: title,
    contract_type: contractType.nullable(),
    contract_end_date: day.nullable(),
    payer_insured_count_nov_30: pay,
    voluntary_sickness_insured: yesNo,
    insurance_duration_days: count.nullable(),
    has_b2b_arrears: yesNo,
    applicant_age_50_plus: yesNo,
    benefit_base_amount_pln: money.nullable(),
    due_or_birth_date: day.nullable(),
    application_date: day.nullable(),
    days_from_birth_to_application: count.nullable(),
    children_count: count.min(1),
    requested_payment_variant: z.enum(['COMBINED_81_5', 'SPLIT_100_70']),
    father_parental_weeks: count,
    part_time_work_fraction: fraction,
    special_circumstances: z.strictObject({
      has_code_b_on_ezla: yesNo,
      premature_or_hospitalized_newborn: z.boolean(),
      za_zyciem_certificate: z.boolean(),
      stillbirth_or_child_death: z.enum(['NONE', 'BEFORE_8_WEEKS', 'AFTER_8_WEEKS']),
      mother_hospitalized_or_incapable: z.boolean(),
      mother_deceased: z.boolean().optional(),
      mother_abandoned_child: z.boolean().optional(),
      unlawful_termination_confirmed_by_court: z.boolean().optional(),
      employer_bankruptcy_or_liquidation: z.boolean(),
      adopted_or_foster_child_age_years: z.number().nonnegative().max(17).nullable(),
      is_professional_foster_family: z.boolean(),
    }),
    living_children_count: count.optional(),
    deceased_children_count: count.optional(),
    pregnancy_week_at_birth: z
      .string()
      .regex(/^\d{1,2}(\+[0-6])?$/)
      .optional(),
    birth_weight_grams: z.union([weight, z.array(weight).min(1)]).optional(),
    newborn_hospitalization_start: day.optional(),
    newborn_hospitalization_end: day.optional(),
    za_zyciem_certificate_date: day.optional(),
    application_to_payer_date: day.optional(),
    maternity_leave_start_date: day.optional(),
    sickness_leave_start_date: day.optional(),
    sickness_leave_end_date: day.optional(),
    sickness_benefit_start_date: day.optional(),
    sickness_waiting_period_confirmed: z.boolean().optional(),
    monthly_bases: monthlyBases.optional(),
    parental_leave_parts: z
      .array(
        z.strictObject({
          start_date: day,
          end_date: day,
          parent_role: parent.optional(),
          work_fraction: fraction.optional(),
        }),
      )
      .optional(),
    title_start_date: day.optional(),
    employer_is_family_member: z.boolean().optional(),
    newly_created_position: z.boolean().optional(),
    adopted_or_foster_child_acceptance_date: day.optional(),
    adoption_type: z.enum(['ADOPTION', 'FOSTER_FAMILY']).optional(),
    school_obligation_deferred: z.boolean().optional(),
    child_death_date: day.optional(),
    parental_only: z.boolean().optional(),
    paternity_leave_start_date: day.optional(),
    father_takeover_date: day.optional(),
    mother_abandonment_date: day.optional(),
    mother_maternity_days_used: count.optional(),
    mother_was_insured_at_abandonment: z.boolean().optional(),
    father_stops_gainful_activity: z.boolean().optional(),
    reference_date: day.optional(),
    debt_amount_pln: money.optional(),
    sick_pay_days_already_used: count.optional(),
    sickness_benefit_days_already_used: count.optional(),
    other_parent: insuranceTitle.optional(),
    additional_insurance_titles: z.array(additionalInsuranceTitle).optional(),
    secondary_employment_type: title.nullable().optional(),
    secondary_voluntary_sickness_insured: yesNo.optional(),
    sickness_base_changes: z
      .array(z.strictObject({ effective_date: day, amount_pln: money }))
      .optional(),
  })
  .superRefine((input, ctx) => {
    function check(ok: boolean, field: string, message: string) {
      if (!ok) ctx.addIssue({ code: 'custom', path: [field], message });
    }
    check(
      input.living_children_count === undefined ||
        input.living_children_count <= input.children_count,
      'living_children_count',
      'Liczba żywych dzieci nie może przekraczać liczby dzieci z porodu.',
    );
    if (input.deceased_children_count !== undefined) {
      check(
        input.deceased_children_count <= input.children_count &&
          (input.living_children_count === undefined ||
            input.living_children_count + input.deceased_children_count === input.children_count),
        'deceased_children_count',
        'Liczba żywych i zmarłych dzieci musi odpowiadać liczbie dzieci z porodu.',
      );
      check(
        (input.deceased_children_count > 0) ===
          (input.special_circumstances.stillbirth_or_child_death !== 'NONE'),
        'deceased_children_count',
        'Liczba zmarłych dzieci musi odpowiadać podanemu przebiegowi zdarzenia.',
      );
    }
    if (input.mother_abandonment_date) {
      check(
        input.stage === 'POST_BIRTH' &&
          (!input.due_or_birth_date || input.mother_abandonment_date >= input.due_or_birth_date),
        'mother_abandonment_date',
        'Data porzucenia dziecka nie może poprzedzać daty porodu.',
      );
    }
    for (const [start, end, message] of [
      ['sickness_leave_start_date', 'sickness_leave_end_date',
        'Ustaw koniec zwolnienia w dniu jego rozpoczęcia lub później. Sprawdź obie daty na zwolnieniu lekarskim.'],
      ['newborn_hospitalization_start', 'newborn_hospitalization_end',
        'Ustaw koniec pobytu w szpitalu w dniu jego rozpoczęcia lub później. Sprawdź obie daty na zaświadczeniu ze szpitala.'],
    ] as const) {
      check(
        !input[start] || !input[end] || input[start] <= input[end],
        end,
        message,
      );
    }
    function checkMonths(months: NonNullable<CaseInputs['monthly_bases']>, field: string) {
      check(
        new Set(months.map((base) => base.month)).size === months.length,
        field,
        'Każdy miesiąc może wystąpić tylko raz.',
      );
      check(
        months.every((base) => (base.excluded_bonus_pln ?? 0) <= base.amount_pln),
        field,
        'Wyłączona premia przekracza podstawę.',
      );
    }
    checkMonths(input.monthly_bases ?? [], 'monthly_bases');
    checkMonths(input.other_parent?.monthly_bases ?? [], 'other_parent');
    for (const title of input.additional_insurance_titles ?? []) {
      check(
        !title.title_start_date || !title.contract_end_date ||
          title.title_start_date <= title.contract_end_date,
        'additional_insurance_titles',
        'Data zakończenia dodatkowego tytułu nie może poprzedzać jego rozpoczęcia.',
      );
      checkMonths(title.monthly_bases ?? [], 'additional_insurance_titles');
    }
  }) satisfies z.ZodType<CaseInputs>;
