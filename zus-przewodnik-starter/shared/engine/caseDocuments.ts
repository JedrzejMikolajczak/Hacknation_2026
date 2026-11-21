import type { ApplicantRole, BenefitParams, CaseDocument, CaseInputs, CasePeriod } from '../types';
import { addDays } from './core';
import { insured, KP, payer } from './caseRules';

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
  const hasChildLoss = input.special_circumstances.stillbirth_or_child_death !== 'NONE';
  const living =
    input.living_children_count ??
    (hasChildLoss ? Math.max(0, input.children_count - 1) : input.children_count);
  const isChildDeathAfterBirth = Boolean(
    hasChildLoss && input.child_death_date && (!event || input.child_death_date !== event),
  );
  const isStillbirth = hasChildLoss && !isChildDeathAfterBirth;

  for (const role of ['MOTHER', 'FATHER'] as const) {
    const rolePeriods = periods.filter((period) => !period.denied && period.parent_role === role);
    const person = role === input.applicant_role ? input : input.other_parent;
    const pregnancySicknessGuidance =
      input.stage === 'PREGNANCY' &&
      role === 'MOTHER' &&
      person !== undefined &&
      insured(person) === true;

    if (!rolePeriods.length && !pregnancySicknessGuidance) continue;

    const employee = person?.employment_type === 'UOP';
    const mandate = person?.employment_type === 'ZLECENIE';
    const personPayer = person ? payer(person) : null;
    // Pracownik (UoP) składa wnioski u pracodawcy (który wypłaca przy > 20 albo przekazuje Z-3 do ZUS).
    // Zleceniobiorca składa ZAM u uprawnionego płatnika (> 20) albo w ZUS (≤ 20 + Z-3a od zleceniodawcy).
    // JDG zawsze składa dokumenty bezpośrednio do ZUS. Gdy brak danych o wielkości płatnika → null.
    const destination: CaseDocument['submit_to'] =
      personPayer === null ? null : employee ? 'EMPLOYER' : personPayer;
    const mandateEntitledPayer = mandate && personPayer === 'EMPLOYER';

    const maternity = rolePeriods.find(
      (period) => period.leave_type === 'MATERNITY' || period.leave_type === 'ADOPTION_MATERNITY',
    );
    const roleSickness = rolePeriods.filter((period) => period.leave_type === 'SICKNESS');
    const sickness = roleSickness[0];
    const parental = rolePeriods.filter(
      (period) =>
        period.leave_type === 'PARENTAL' || period.leave_type === 'PARENTAL_ZA_ZYCIEM_EXTENSION',
    );
    const supplementary = rolePeriods.find(
      (period) => period.leave_type === 'SUPPLEMENTARY_MATERNITY',
    );
    const paternity = rolePeriods.find((period) => period.leave_type === 'PATERNITY');
    const hasMaternityBenefit = Boolean(maternity || parental.length || supplementary || paternity);
    const hasSicknessGuidance = Boolean(sickness || pregnancySicknessGuidance);

    if (hasMaternityBenefit) {
      add(
        'ZAM',
        mandateEntitledPayer
          ? 'ZAM – wniosek o zasiłek macierzyński (do płatnika składek – zleceniodawcy)'
          : 'ZAM – wniosek o zasiłek macierzyński',
        role,
        destination,
        KP.qualification,
      );
      if (input.stage === 'ADOPTION') {
        add(
          'ADOPTION_ORDER',
          input.adoption_type === 'FOSTER_FAMILY'
            ? 'Orzeczenie o ustanowieniu rodziny zastępczej niezawodowej i oświadczenie o dacie przyjęcia dziecka'
            : 'Zaświadczenie sądu o wszczęciu postępowania o przysposobienie i oświadczenie o dacie przyjęcia dziecka',
          role,
          destination,
          KP.adoption,
        );
      } else {
        if (!isStillbirth || living > 0) {
          add(
            'BIRTH_CERTIFICATE',
            'Skrócony odpis aktu urodzenia dziecka',
            role,
            destination,
            KP.qualification,
          );
        }
        if (isStillbirth) {
          add(
            'STILLBIRTH_CERTIFICATE',
            'Skrócony odpis aktu urodzenia z adnotacją o martwym urodzeniu lub zaświadczenie o martwym urodzeniu',
            role,
            destination,
            KP.maternity,
          );
        }
        if (isChildDeathAfterBirth) {
          add(
            'DEATH_CERTIFICATE',
            'Skrócony odpis aktu zgonu dziecka',
            role,
            destination,
            KP.maternity,
          );
        }
        add(
          'USC_COPY',
          isStillbirth && living === 0
            ? 'Wniosek do USC o wydanie skróconego odpisu aktu urodzenia z adnotacją o martwym urodzeniu'
            : hasChildLoss
              ? 'Wniosek do USC o wydanie odpisów aktów stanu cywilnego'
              : 'Wniosek do USC o wydanie odpisu aktu urodzenia',
          role,
          'USC',
          'Prawo o aktach stanu cywilnego',
        );
      }
      if (maternity && input.stage !== 'ADOPTION' && event && maternity.start_date < event) {
        add(
          'EXPECTED_BIRTH_CERTIFICATE',
          'Zaświadczenie lekarskie o przewidywanej dacie porodu',
          role,
          destination,
          KP.maternity,
        );
      }
    }

    if (employee && personPayer === 'ZUS' && (hasMaternityBenefit || hasSicknessGuidance))
      add(
        'Z-3',
        'Z-3 – zaświadczenie płatnika składek przekazywane przez pracodawcę',
        role,
        'ZUS',
        hasMaternityBenefit ? KP.qualification : KP.sickness,
      );
    if (mandate && personPayer === 'ZUS' && (hasMaternityBenefit || hasSicknessGuidance))
      add(
        'Z-3a',
        'Z-3a – zaświadczenie płatnika składek przekazywane przez zleceniodawcę',
        role,
        'ZUS',
        hasMaternityBenefit ? KP.qualification : KP.sickness,
      );

    if (hasSicknessGuidance && person) {
      const codeB =
        input.stage === 'PREGNANCY' || input.special_circumstances.has_code_b_on_ezla !== false;
      const ezlaName = mandateEntitledPayer
        ? codeB
          ? 'e-ZLA (kod „B”) – elektroniczne zaświadczenie lekarskie (wypłaca zleceniodawca)'
          : 'Elektroniczne zaświadczenie lekarskie e-ZLA (wypłaca zleceniodawca)'
        : codeB
          ? 'e-ZLA (kod „B”) – elektroniczne zaświadczenie lekarskie w ciąży'
          : 'Elektroniczne zaświadczenie lekarskie';
      add('e-ZLA', ezlaName, role, personPayer, KP.sickness, sickness);
      if (person.employment_type === 'B2B')
        add('ZAS-53', 'ZAS-53 – wniosek o zasiłek chorobowy', role, 'ZUS', KP.sickness, sickness);
      const hasFurtherSicknessPeriod = Boolean(
        sickness &&
        ((input.sickness_benefit_days_already_used ?? 0) > 0 ||
          roleSickness.length > 1 ||
          (sickness.amount_segments?.length ?? 0) > 1),
      );
      if (employee && personPayer === 'ZUS' && hasFurtherSicknessPeriod)
        add(
          'ZAS-12',
          'ZAS-12 – zaświadczenie płatnika składek na dalszy okres zasiłku chorobowego',
          role,
          'ZUS',
          KP.sickness,
          sickness,
        );
    }

    if (
      maternity &&
      living > 0 &&
      role === input.applicant_role &&
      event &&
      !input.special_circumstances.mother_deceased &&
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
        destination,
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
