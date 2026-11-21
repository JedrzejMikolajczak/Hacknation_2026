import type {
  BenefitParams,
  CaseAdditionalTitleOutcome,
  CaseInputs,
  CasePlan,
} from '../types';

export function calculateAdditionalTitleOutcomes(
  input: CaseInputs,
  params: BenefitParams,
  calculate: (input: CaseInputs, params: BenefitParams) => CasePlan,
): CaseAdditionalTitleOutcome[] {
  return (input.additional_insurance_titles ?? []).map((title) => {
    const covered = title.sickness_insured === true;
    const plan = calculate(
      {
        ...input,
        employment_type: covered ? title.employment_type : 'NONE',
        contract_type: title.contract_type ?? null,
        contract_end_date: title.contract_end_date ?? null,
        payer_insured_count_nov_30: title.payer_insured_count_nov_30,
        voluntary_sickness_insured: title.sickness_insured,
        insurance_duration_days: title.insurance_duration_days ?? null,
        has_b2b_arrears: title.has_b2b_arrears ?? null,
        benefit_base_amount_pln: title.benefit_base_amount_pln,
        title_start_date: title.title_start_date ?? undefined,
        debt_amount_pln: title.debt_amount_pln ?? undefined,
        monthly_bases: title.monthly_bases,
        sickness_waiting_period_confirmed: undefined,
        sickness_benefit_start_date: undefined,
        sick_pay_days_already_used: undefined,
        sickness_base_changes: undefined,
        employer_is_family_member: undefined,
        newly_created_position: undefined,
        special_circumstances: {
          ...input.special_circumstances,
          employer_bankruptcy_or_liquidation: false,
          unlawful_termination_confirmed_by_court: false,
        },
      },
      params,
    );

    const own = <T extends { parent_role: CaseInputs['applicant_role'] }>(item: T) =>
      item.parent_role === input.applicant_role;
    const periods = plan.outcome.periods.filter(own);
    const employerPay = plan.outcome.employer_sick_pay.filter(own);
    const qualifies = covered && (periods.some((period) => !period.denied) || employerPay.length > 0);
    const coverageMessage = title.sickness_insured === null
      ? 'Uzupełnij potwierdzenie ubezpieczenia chorobowego z tego tytułu.'
      : 'Z tego tytułu nie potwierdzono podlegania ubezpieczeniu chorobowemu.';
    const denial = covered ? plan.outcome.denial_or_reduction_reason_pl : coverageMessage;

    return {
      employment_type: title.employment_type,
      outcome: {
        ...plan.outcome,
        is_qualified: qualifies,
        who_pays: qualifies ? plan.outcome.who_pays : null,
        decision_summary_pl: qualifies
          ? plan.outcome.decision_summary_pl
          : (denial ?? 'Sprawdź prawo do świadczenia z tego tytułu.'),
        denial_or_reduction_reason_pl: denial,
        periods,
        employer_sick_pay: employerPay,
      },
      documents: plan.documents.filter(own),
      entitlements: plan.entitlements.filter(own).map((entitlement) =>
        covered
          ? entitlement
          : {
              ...entitlement,
              is_qualified: title.sickness_insured === false ? false : null,
              who_pays: null,
              reason_pl: coverageMessage,
            },
      ),
    };
  });
}
