import type { ApplicantRole, BenefitParams, CaseDocument, CaseInputs, CasePeriod } from '../types';
import { addDays } from './core';
import { hasChildLoss, hasMaternityRightAfterInsurance, insured, KP, livingChildrenCount, payer, qualifiesAfterUnlawfulTermination } from './caseRules';

export function documentsForPlan(
  input: CaseInputs,
  periods: CasePeriod[],
  event: string | null,
  params: BenefitParams,
  parentalRequests: CasePeriod[],
  combinedDeadline: string | null,
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
    filedOn: string | null = null,
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
      // Dokument złożony w terminie (podana data złożenia ≤ termin) nie jest przeterminowany.
      is_overdue: !!(
        deadline &&
        input.reference_date &&
        deadline < input.reference_date &&
        !(filedOn && filedOn <= deadline)
      ),
    });
  }
  const notice = params.applicationDeadlinesDays;
  const childLoss = hasChildLoss(input);
  const living = livingChildrenCount(input);
  const isChildDeathAfterBirth = childLoss && Boolean(input.child_death_date);
  const isStillbirth = childLoss && !isChildDeathAfterBirth;

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
    const courtMaternity =
      role === input.applicant_role && event !== null &&
      qualifiesAfterUnlawfulTermination(input, event, params);
    const afterInsurance = role === input.applicant_role && event !== null &&
      hasMaternityRightAfterInsurance(input, event, params);
    const personPayer = afterInsurance ? 'ZUS' : person ? payer(person) : null;
    // Pracownik (UoP) składa wnioski u pracodawcy (który wypłaca przy > 20 albo przekazuje Z-3 do ZUS).
    // Zleceniobiorca składa ZAM u uprawnionego płatnika (> 20) albo w ZUS (≤ 20 + Z-3a od zleceniodawcy).
    // JDG zawsze składa dokumenty bezpośrednio do ZUS. Gdy brak danych o wielkości płatnika → null.
    const destination: CaseDocument['submit_to'] =
      employee && !afterInsurance && personPayer !== null ? 'EMPLOYER' : personPayer;
    const mandateEntitledPayer = mandate && personPayer === 'EMPLOYER';

    const maternity = rolePeriods.find(
      (period) => period.leave_type === 'MATERNITY' || period.leave_type === 'ADOPTION_MATERNITY',
    );
    const roleSickness = rolePeriods.filter((period) => period.leave_type === 'SICKNESS');
    const sickness = roleSickness[0];
    const parental = parentalRequests.filter((period) => period.parent_role === role);
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
        courtMaternity ? KP.unlawfulTermination : KP.qualification,
      );
      if (courtMaternity) {
        add(
          'COURT_RULING_UNLAWFUL_TERMINATION',
          'Prawomocne orzeczenie sądu potwierdzające rozwiązanie stosunku pracy z naruszeniem prawa',
          role,
          'ZUS',
          KP.unlawfulTermination,
          maternity,
        );
        add(
          'PREGNANCY_DURING_EMPLOYMENT_CERTIFICATE',
          'Zaświadczenie lekarskie potwierdzające ciążę w okresie zatrudnienia',
          role,
          'ZUS',
          KP.unlawfulTermination,
          maternity,
        );
      }
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
             : childLoss
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
      const hasFurtherSicknessPeriod =
        sickness &&
        ((input.sickness_benefit_days_already_used ?? 0) > 0 ||
          (employee && (roleSickness.length > 1 || (sickness.amount_segments?.length ?? 0) > 1)));
      if ((employee || mandate) && personPayer === 'ZUS' && hasFurtherSicknessPeriod)
        add(
          'ZAS-12',
          mandate
            ? 'ZAS-12 – zaświadczenie zleceniodawcy na dalszy okres zasiłku chorobowego (alternatywa dla Z-3a)'
            : 'ZAS-12 – zaświadczenie płatnika składek na dalszy okres zasiłku chorobowego',
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
      combinedDeadline &&
      input.requested_payment_variant === 'COMBINED_81_5'
    ) {
      add(
        'COMBINED_RATE',
        'Wniosek o stawkę 81,5%',
        role,
        destination,
        KP.combined,
        maternity,
        combinedDeadline,
        input.application_to_payer_date ?? input.application_date,
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
    const abandonment = Boolean(input.mother_abandonment_date);
    if (
      maternity &&
      role === 'FATHER' &&
      (input.father_takeover_date || input.special_circumstances.mother_deceased || abandonment)
    ) {
      add(
        'TAKEOVER',
        'Wniosek ojca o przejęcie macierzyńskiego',
        role,
        destination,
        abandonment ? KP.abandonment : KP.maternity,
        maternity,
        abandonment ||
          input.special_circumstances.mother_deceased ||
          input.special_circumstances.mother_hospitalized_or_incapable
          ? null
          : addDays(maternity.start_date, -notice.fatherTakeoverPart),
      );
      if (abandonment) {
        add(
          'ABANDONMENT_STATEMENT',
          'Oświadczenie ojca o dacie porzucenia dziecka przez matkę',
          role,
          destination,
          KP.abandonment,
          maternity,
        );
        if (input.mother_was_insured_at_abandonment) {
          add(
            'MOTHER_MATERNITY_PERIOD_CERTIFICATE',
            'Zaświadczenie płatnika o okresie pobierania zasiłku macierzyńskiego przez matkę',
            role,
            destination,
            KP.abandonment,
            maternity,
          );
        }
      }
    }
    for (const part of parental) {
      add(
        'PARENTAL_REQUEST',
        'Wniosek o okres rodzicielskiego',
        role,
        destination,
        KP.parental,
        part,
        (employee && !afterInsurance) || !person ? addDays(part.start_date, -notice.parentalLeave) : part.start_date,
      );
      if (employee && !afterInsurance && part.work_fraction > 0)
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
