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
const fraction = z.number().min(0).max(1);
const weight = z.number().int().positive();

export const caseInputSchema = z
  .strictObject({
    applicant_role: parent,
    stage: z.enum(['PLANNING', 'PREGNANCY', 'POST_BIRTH', 'ADOPTION']),
    co_parenting: z.boolean(),
    other_parent_insured: yesNo,
    employment_type: title,
    contract_type: z.enum(['INDEFINITE', 'FIXED_TERM', 'PROBATION', 'REPLACEMENT']).nullable(),
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
      employer_bankruptcy_or_liquidation: z.boolean(),
      unlawful_termination_confirmed_by_court: z.boolean().optional(),
      adopted_or_foster_child_age_years: z.number().nonnegative().nullable(),
      is_professional_foster_family: z.boolean(),
    }),
    living_children_count: count.optional(),
    deceased_children_count: count.optional(),
    secondary_employment_type: title.nullable().optional(),
    secondary_voluntary_sickness_insured: yesNo.optional(),
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
    monthly_bases: z
      .array(
        z.strictObject({
          month,
          amount_pln: money,
          excluded_bonus_pln: money.optional(),
        }),
      )
      .optional(),
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
    reference_date: day.optional(),
    debt_amount_pln: money.optional(),
    sick_pay_days_already_used: count.optional(),
    sickness_benefit_days_already_used: count.optional(),
    other_parent: z
      .strictObject({
        employment_type: title,
        payer_insured_count_nov_30: pay,
        benefit_base_amount_pln: money.nullable(),
        voluntary_sickness_insured: yesNo,
        contract_end_date: day.nullable().optional(),
        has_b2b_arrears: yesNo.optional(),
        monthly_bases: z
          .array(
            z.strictObject({
              month,
              amount_pln: money,
              excluded_bonus_pln: money.optional(),
            }),
          )
          .optional(),
        title_start_date: day.nullable().optional(),
        debt_amount_pln: money.nullable().optional(),
        secondary_employment_type: title.nullable().optional(),
        secondary_voluntary_sickness_insured: yesNo.optional(),
      })
      .optional(),
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
    check(
      input.deceased_children_count === undefined ||
        input.deceased_children_count <= input.children_count,
      'deceased_children_count',
      'Liczba zmarłych dzieci nie może przekraczać liczby dzieci z porodu.',
    );
    check(
      input.living_children_count === undefined ||
        input.deceased_children_count === undefined ||
        input.living_children_count + input.deceased_children_count <= input.children_count,
      'deceased_children_count',
      'Suma żywych i zmarłych dzieci nie może przekraczać liczby dzieci z porodu.',
    );
    for (const [start, end] of [
      ['sickness_leave_start_date', 'sickness_leave_end_date'],
      ['newborn_hospitalization_start', 'newborn_hospitalization_end'],
    ] as const) {
      check(
        !input[start] || !input[end] || input[start] <= input[end],
        end,
        'Koniec okresu wypada przed początkiem.',
      );
    }
    const months = input.monthly_bases ?? [];
    check(
      new Set(months.map((base) => base.month)).size === months.length,
      'monthly_bases',
      'Każdy miesiąc może wystąpić tylko raz.',
    );
    check(
      months.every((base) => (base.excluded_bonus_pln ?? 0) <= base.amount_pln),
      'monthly_bases',
      'Wyłączona premia przekracza podstawę.',
    );
    const otherMonths = input.other_parent?.monthly_bases ?? [];
    check(
      new Set(otherMonths.map((base) => base.month)).size === otherMonths.length,
      'other_parent',
      'Każdy miesiąc może wystąpić tylko raz.',
    );
    check(
      otherMonths.every((base) => (base.excluded_bonus_pln ?? 0) <= base.amount_pln),
      'other_parent',
      'Wyłączona premia przekracza podstawę.',
    );
  }) satisfies z.ZodType<CaseInputs>;
