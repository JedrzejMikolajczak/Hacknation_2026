import type { ApplicantRole, BenefitParams, CaseDocument, CaseInputs, CasePeriod } from '../types';
import { addDays } from './core';
import { KP, payer } from './caseRules';

export function documentsForPlan(
  input: CaseInputs,
  periods: CasePeriod[],
  event: string | null,
  params: BenefitParams,
): CaseDocument[] {
  const docs: CaseDocument[] = [];
  function add(
    id: string,
    name_pl: string,
    parent_role: ApplicantRole,
    submit_to: CaseDocument['submit_to'],
    legal_basis: string,
    period?: CasePeriod,
    deadline: string | null = null,
  ) {
    docs.push({
      id,
      name_pl,
      parent_role,
      submit_to,
      legal_basis,
      deadline,
      leave_type: period?.leave_type ?? null,
      start_date: period?.start_date ?? null,
      end_date: period?.end_date ?? null,
      is_overdue: !!(deadline && input.reference_date && deadline < input.reference_date),
    });
  }
  const notice = params.applicationDeadlinesDays;
  for (const role of ['MOTHER', 'FATHER'] as const) {
    const rolePeriods = periods.filter((period) => !period.denied && period.parent_role === role);
    if (!rolePeriods.length) continue;
    const person = role === input.applicant_role ? input : input.other_parent;
    const employee = person?.employment_type === 'UOP';
    const destination = employee ? 'EMPLOYER' : person ? 'ZUS' : null;
    const maternity = rolePeriods.find(
      (period) => period.leave_type === 'MATERNITY' || period.leave_type === 'ADOPTION_MATERNITY',
    );
    const sickness = rolePeriods.find((period) => period.leave_type === 'SICKNESS');
    const parental = rolePeriods.filter(
      (period) =>
        period.leave_type === 'PARENTAL' || period.leave_type === 'PARENTAL_ZA_ZYCIEM_EXTENSION',
    );
    const supplementary = rolePeriods.find(
      (period) => period.leave_type === 'SUPPLEMENTARY_MATERNITY',
    );
    const paternity = rolePeriods.find((period) => period.leave_type === 'PATERNITY');
    if (maternity || parental.length || supplementary || paternity) {
      add('ZAM', 'ZAM – wniosek o zasiłek macierzyński', role, destination, KP.qualification);
      add(
        input.stage === 'ADOPTION' ? 'ADOPTION_ORDER' : 'BIRTH_CERTIFICATE',
        input.stage === 'ADOPTION'
          ? 'Dokument przyjęcia dziecka na wychowanie'
          : 'Skrócony odpis aktu urodzenia dziecka',
        role,
        destination,
        KP.qualification,
      );
      if (input.stage !== 'ADOPTION')
        add(
          'USC_COPY',
          'Wniosek do USC o wydanie odpisu aktu urodzenia',
          role,
          'USC',
          'Prawo o aktach stanu cywilnego',
        );
    }
    if (person?.employment_type === 'UOP' && payer(person) === 'ZUS')
      add(
        'Z-3',
        'Z-3 – zaświadczenie płatnika składek przekazywane przez pracodawcę',
        role,
        'ZUS',
        KP.qualification,
      );
    if (person?.employment_type === 'ZLECENIE' && payer(person) === 'ZUS')
      add('Z-3a', 'Z-3a – zaświadczenie płatnika składek', role, 'ZUS', KP.qualification);
    if (sickness && person) {
      add(
        'e-ZLA',
        'Elektroniczne zaświadczenie lekarskie',
        role,
        payer(person) === 'EMPLOYER' ? 'EMPLOYER' : 'ZUS',
        KP.sickness,
        sickness,
      );
      if (person.employment_type === 'B2B')
        add('ZAS-53', 'ZAS-53 – wniosek o zasiłek chorobowy', role, 'ZUS', KP.sickness, sickness);
      if (employee && payer(person) === 'ZUS')
        add(
          'ZAS-12',
          'ZAS-12 – wniosek o zasiłek za dalszy okres',
          role,
          'ZUS',
          KP.sickness,
          sickness,
        );
    }
    if (
      maternity &&
      role === input.applicant_role &&
      event &&
      input.requested_payment_variant === 'COMBINED_81_5'
    ) {
      add(
        'COMBINED_RATE',
        'Wniosek o stawkę 81,5%',
        role,
        destination,
        KP.combined,
        maternity,
        addDays(event, params.combinedRateApplicationDeadlineDays),
      );
    }
    if (maternity && input.stage === 'ADOPTION' && employee && event)
      add(
        'ADOPTION_LEAVE',
        'Wniosek o urlop na warunkach macierzyńskiego',
        role,
        'EMPLOYER',
        KP.adoption,
        maternity,
        addDays(event, notice.fosterFamilyAfterAcceptance),
      );
    if (
      maternity &&
      input.stage !== 'ADOPTION' &&
      role === 'MOTHER' &&
      employee &&
      event &&
      maternity.start_date < event
    )
      add(
        'PRE_BIRTH_REQUEST',
        'Wniosek o część urlopu macierzyńskiego przed porodem',
        role,
        'EMPLOYER',
        KP.maternity,
        { ...maternity, end_date: addDays(event, -1) },
      );
    if (
      maternity &&
      role === 'FATHER' &&
      (input.father_takeover_date || input.special_circumstances.mother_deceased)
    )
      add(
        'TAKEOVER',
        'Wniosek ojca o przejęcie macierzyńskiego',
        role,
        destination,
        KP.maternity,
        maternity,
        input.special_circumstances.mother_deceased ||
          input.special_circumstances.mother_hospitalized_or_incapable
          ? null
          : addDays(maternity.start_date, -notice.fatherTakeoverPart),
      );
    for (const part of parental) {
      add(
        'PARENTAL_REQUEST',
        'Wniosek o okres rodzicielskiego',
        role,
        destination,
        KP.parental,
        part,
        employee || !person ? addDays(part.start_date, -notice.parentalLeave) : part.start_date,
      );
      if (employee && part.work_fraction > 0)
        add(
          'PARENTAL_WORK_REQUEST',
          'Wniosek o łączenie urlopu rodzicielskiego z pracą',
          role,
          'EMPLOYER',
          KP.work,
          part,
          addDays(part.start_date, -notice.parentalLeave),
        );
    }
    if (paternity)
      add(
        'PATERNITY_REQUEST',
        'Wniosek o okres ojcowskiego',
        role,
        destination,
        KP.paternity,
        paternity,
        employee || !person
          ? addDays(paternity.start_date, -notice.paternityLeave)
          : paternity.start_date,
      );
    if (supplementary) {
      add(
        'SUPPLEMENTARY_REQUEST',
        'Wniosek o uzupełniający macierzyński',
        role,
        destination,
        KP.supplementary,
        supplementary,
        addDays(supplementary.start_date, -notice.supplementaryMaternityLeave - 1),
      );
      add(
        'HOSPITAL_CERTIFICATE',
        'Zaświadczenie ze szpitala o okresie hospitalizacji, tygodniu ciąży i masie urodzeniowej',
        role,
        destination,
        KP.supplementary,
      );
    }
    if (parental.length && input.special_circumstances.za_zyciem_certificate)
      add('ZA_ZYCIEM_CERTIFICATE', 'Zaświadczenie „Za życiem”', role, destination, KP.zaZyciem);
  }
  return docs;
}
