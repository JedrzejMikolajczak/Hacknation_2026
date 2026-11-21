import type {
  BenefitParams,
  DocumentChecklist,
  Payer,
  RequiredDocument,
  WizardScenario,
} from '../types';
import { addDays, addMonths, formatPercentPl, validateParams } from './core';
import { resolveParentPayer } from './eligibility';
import { getMaternityWeeksForChildren, resolveSupplementaryMaternityLeave } from './maternity';

function effectivePayerOrZus(payer: Payer | null): Payer {
  return payer ?? 'zus';
}

export function getRequiredDocuments(
  input: WizardScenario,
  params: BenefitParams,
): DocumentChecklist {
  const eventDate =
    input.situation === 'adoption'
      ? (input.childAcceptanceDate ?? input.referenceDate)
      : (input.birthDate ?? input.expectedBirthDate ?? input.referenceDate);
  validateParams(params, eventDate);

  const mother = input.mother;
  const father = input.father;
  const motherInsured = mother.insuranceTitle !== 'none' && mother.sicknessInsurance !== 'none';
  const fatherInsured =
    father !== null && father.insuranceTitle !== 'none' && father.sicknessInsurance !== 'none';

  const motherPayerResolved = resolveParentPayer(mother, params);
  const fatherPayerResolved = father ? resolveParentPayer(father, params) : null;

  // Główny płatnik: przy upadłości pracodawcy zawsze ZUS; jeśli matka nieubezpieczona/zmarła, płatnik ojca
  const motherPayer: Payer = input.special.employerBankruptcyOrLiquidation
    ? 'zus'
    : effectivePayerOrZus(motherPayerResolved);
  const fatherPayer: Payer = effectivePayerOrZus(fatherPayerResolved);
  const primaryPayer: Payer =
    motherInsured && !input.special.motherDeceased
      ? motherPayer
      : fatherInsured
        ? fatherPayer
        : 'zus';

  const childLostAll =
    (input.special.stillbirth || input.special.childDeathDate !== null) && input.childrenCount <= 1;

  const maternityWeeks = getMaternityWeeksForChildren(input.childrenCount, params);
  const suppWeeks =
    !childLostAll &&
    input.situation !== 'adoption' &&
    input.special.hospitalizationDays !== null &&
    input.special.hospitalizationDays > 0 &&
    (input.special.pregnancyWeekAtBirth !== null || input.special.birthWeightGrams !== null)
      ? resolveSupplementaryMaternityLeave(input, params).weeks
      : 0;

  const maternityEndPlusOne = addDays(eventDate, maternityWeeks * 7);
  const parentalStartDate = addDays(eventDate, (maternityWeeks + suppWeeks) * 7);
  const combinedDeadline = addDays(eventDate, params.combinedRateApplicationDeadlineDays);
  const parentalApplicationDeadline = addDays(
    parentalStartDate,
    -params.applicationDeadlinesDays.parentalLeave,
  );
  const supplementaryDeadline = addDays(
    maternityEndPlusOne,
    -params.applicationDeadlinesDays.supplementaryMaternityLeave,
  );

  const documents: RequiredDocument[] = [];
  const deadlines: { label: string; date: string; legalBasis: string | null }[] = [];

  // 1. Dokumenty w ciąży (zasiłek chorobowy, kod „B”)
  if (input.situation === 'pregnant' && motherInsured) {
    documents.push({
      id: 'eZlaCodeB',
      name: `Zaświadczenie lekarskie e-ZLA z kodem literowym „B” (ciąża – ${formatPercentPl(params.rates.sicknessPregnancy)})`,
      submitTo: motherPayer,
      deadline: null,
      note: 'Lekarz wystawia e-ZLA elektronicznie – trafia automatycznie do ZUS oraz na profil płatnika na PUE/eZUS.',
    });

    if (mother.insuranceTitle === 'selfEmployed') {
      documents.push({
        id: 'formZAS53',
        name: 'Wniosek o zasiłek chorobowy ZUS ZAS-53 (działalność gospodarcza)',
        submitTo: 'zus',
        deadline: null,
        note: 'Osoba prowadząca JDG składa ZAS-53 bezpośrednio do ZUS (np. przez PUE/eZUS). Druk Z-3b został zlikwidowany 24.10.2026 r.',
      });
    } else if (motherPayer === 'zus') {
      const certId = mother.insuranceTitle === 'employment' ? 'formZ3Sickness' : 'formZ3aSickness';
      const certCode = mother.insuranceTitle === 'employment' ? 'ZUS Z-3' : 'ZUS Z-3a';
      documents.push({
        id: certId,
        name: `Zaświadczenie płatnika składek ${certCode}${mother.insuranceTitle === 'employment' ? ' (oraz ZAS-12 na dalszy okres)' : ''} do zasiłku chorobowego`,
        submitTo: 'zus',
        deadline: null,
        note: `Płatnik zgłaszający do ${params.payerThresholdInsuredCount} ubezpieczonych przekazuje zaświadczenie do ZUS.`,
      });
    }
  }

  // 2. Dokument potwierdzający zdarzenie (urodzenie / adopcja / strata dziecka)
  if (input.situation === 'adoption') {
    const fosterDeadline =
      input.adoptionType === 'fosterFamily'
        ? addDays(eventDate, params.applicationDeadlinesDays.fosterFamilyAfterAcceptance)
        : null;
    documents.push({
      id: 'adoptionCourtOrder',
      name:
        input.adoptionType === 'fosterFamily'
          ? 'Prawomocne orzeczenie sądu o umieszczeniu dziecka w rodzinie zastępczej niezawodowej'
          : 'Zaświadczenie sądu opiekuńczego o wszczęciu postępowania o przysposobienie (lub orzeczenie)',
      submitTo: primaryPayer,
      deadline: fosterDeadline,
      note:
        input.adoptionType === 'fosterFamily'
          ? `Wniosek o urlop na warunkach urlopu macierzyńskiego składa się w terminie ${params.applicationDeadlinesDays.fosterFamilyAfterAcceptance} dni od przyjęcia dziecka.`
          : 'Dokument potwierdzający datę przyjęcia dziecka na wychowanie i wiek dziecka.',
    });
    if (fosterDeadline) {
      deadlines.push({
        label: `Termin na złożenie wniosku po przyjęciu dziecka do rodziny zastępczej (${params.applicationDeadlinesDays.fosterFamilyAfterAcceptance} dni)`,
        date: fosterDeadline,
        legalBasis: 'KP art. 183 § 1; Rozporządzenie poz. 322',
      });
    }
  } else if (input.special.stillbirth) {
    documents.push({
      id: 'birthCertificateShort',
      name: 'Skrócony odpis aktu urodzenia dziecka z adnotacją o martwym urodzeniu',
      submitTo: primaryPayer,
      deadline: null,
      note: 'Akt urodzenia wystawia Urząd Stanu Cywilnego na podstawie karty martwego urodzenia ze szpitala.',
    });
  } else {
    documents.push({
      id: 'birthCertificateShort',
      name: 'Skrócony odpis aktu urodzenia dziecka (lub zagraniczny akt urodzenia)',
      submitTo: primaryPayer,
      deadline: !childLostAll && input.rateVariant === 'combined' ? combinedDeadline : null,
      note: 'Odpis aktu urodzenia można uzyskać bezpłatnie w Urzędzie Stanu Cywilnego lub online (Rejestr Stanu Cywilnego / mObywatel).',
    });
    if (input.special.childDeathDate) {
      documents.push({
        id: 'deathCertificate',
        name: 'Odpis skrócony aktu zgonu dziecka',
        submitTo: primaryPayer,
        deadline: null,
        note: 'Potrzebny do ustalenia wymiaru zasiłku macierzyńskiego zgodnie z art. 180¹ Kodeksu pracy.',
      });
    }
  }

  // 3. Wniosek matki o zasiłek / urlop macierzyński
  if (motherInsured && !input.special.motherDeceased) {
    if (motherPayer === 'employer' && mother.insuranceTitle === 'employment') {
      documents.push({
        id: 'applicationToEmployer',
        name: childLostAll
          ? 'Wniosek pracownicy o urlop i zasiłek macierzyński'
          : input.rateVariant === 'combined'
            ? `Pisemny wniosek pracownicy o urlop macierzyński i rodzicielski w pełnym wymiarze (stawka ${formatPercentPl(params.rates.combined)})`
            : 'Pisemny wniosek pracownicy o udzielenie urlopu macierzyńskiego / rodzicielskiego',
        submitTo: 'employer',
        deadline: childLostAll
          ? null
          : input.rateVariant === 'combined'
            ? combinedDeadline
            : parentalApplicationDeadline,
        note: childLostAll
          ? `Pracodawca zgłasza powyżej ${params.payerThresholdInsuredCount} ubezpieczonych, więc przyjmuje wniosek i wypłaca zasiłek.`
          : input.rateVariant === 'combined'
            ? `Dla jednolitej stawki ${formatPercentPl(params.rates.combined)} wniosek należy złożyć w ciągu ${params.combinedRateApplicationDeadlineDays} dni od porodu/przyjęcia.`
            : `Wniosek o urlop rodzicielski składa się nie później niż ${params.applicationDeadlinesDays.parentalLeave} dni przed jego rozpoczęciem.`,
      });
    } else {
      documents.push({
        id: 'formZAM',
        name: 'Wniosek o zasiłek macierzyński (formularz ZUS ZAM)',
        submitTo: motherPayer,
        deadline: childLostAll
          ? null
          : input.rateVariant === 'combined'
            ? combinedDeadline
            : parentalApplicationDeadline,
        note:
          mother.insuranceTitle === 'selfEmployed'
            ? 'Od 24.10.2026 r. formularz ZUS ZAM obejmuje także urlop rodzicielski i ojcowski (dawne ZUR i ZAO zostały zlikwidowane). Druk Z-3b dla JDG również został zlikwidowany – wystarczy ZUS ZAM przez PUE/eZUS.'
            : 'Od 24.10.2026 r. formularz ZUS ZAM obejmuje także dawne formularze ZUR i ZAO (zostały połączone z ZAM). Można złożyć przez PUE/eZUS.',
      });
    }

    // Zaświadczenie płatnika składek Z-3 / Z-3a (gdy ZUS wypłaca dla UoP lub zlecenia; Z-3b zlikwidowany 24.10.2026!)
    if (motherPayer === 'zus') {
      if (mother.insuranceTitle === 'employment') {
        documents.push({
          id: 'formZ3',
          name: 'Zaświadczenie płatnika składek ZUS Z-3 (przekazuje pracodawca do ZUS)',
          submitTo: 'zus',
          deadline: null,
          note: input.special.employerBankruptcyOrLiquidation
            ? 'W razie upadłości lub likwidacji pracodawcy dokumenty przekazuje syndyk/likwidator albo składa ubezpieczona bezpośrednio w ZUS.'
            : `Pracodawca zgłaszający do ${params.payerThresholdInsuredCount} ubezpieczonych przekazuje Z-3 do ZUS wraz z wnioskiem pracownicy.`,
        });
      } else if (mother.insuranceTitle === 'mandateContract') {
        documents.push({
          id: 'formZ3a',
          name: 'Zaświadczenie płatnika składek ZUS Z-3a (przekazuje zleceniodawca do ZUS)',
          submitTo: 'zus',
          deadline: null,
          note: `Zleceniodawca zgłaszający do ${params.payerThresholdInsuredCount} ubezpieczonych przekazuje Z-3a do ZUS.`,
        });
      }
    }
  }

  // 4. Upadłość / likwidacja pracodawcy
  if (input.special.employerBankruptcyOrLiquidation) {
    documents.push({
      id: 'bankruptcyProof',
      name: 'Dokument potwierdzający upadłość lub likwidację pracodawcy oraz świadectwo pracy',
      submitTo: 'zus',
      deadline: null,
      note: 'Wymagane do wypłaty zasiłku w wysokości zasiłku macierzyńskiego do dnia porodu przez ZUS (art. 30 ust. 3).',
    });
  }

  // 5. Zaświadczenie „Za życiem”
  if (input.special.zaZyciemCertificate && !childLostAll) {
    documents.push({
      id: 'certificateZaZyciem',
      name: 'Zaświadczenie lekarskie „Za życiem” (art. 4 ust. 3 ustawy o wsparciu kobiet w ciąży i rodzin)',
      submitTo: primaryPayer,
      deadline: null,
      note: 'Wystawione przez lekarza ubezpieczenia zdrowotnego ze specjalizacją II stopnia lub tytułem specjalisty w dziedzinie wskazanej w ustawie.',
    });
  }

  // 6. Hospitalizacja noworodka / uzupełniający urlop macierzyński
  if (
    !childLostAll &&
    input.situation !== 'adoption' &&
    ((input.special.hospitalizationDays !== null && input.special.hospitalizationDays > 0) ||
      input.special.pregnancyWeekAtBirth !== null)
  ) {
    documents.push({
      id: 'hospitalizationCertificate',
      name: 'Zaświadczenie ze szpitala o okresie hospitalizacji dziecka, tygodniu ciąży i masie urodzeniowej',
      submitTo: primaryPayer,
      deadline: supplementaryDeadline,
      note: `Wniosek o uzupełniający urlop macierzyński składa się najpóźniej ${params.applicationDeadlinesDays.supplementaryMaternityLeave} dni przed zakończeniem urlopu macierzyńskiego (udzielany w jednej części bezpośrednio po macierzyńskim).`,
    });
    deadlines.push({
      label: `Termin na wniosek o uzupełniający urlop macierzyński (${params.applicationDeadlinesDays.supplementaryMaternityLeave} dni przed końcem urlopu macierzyńskiego)`,
      date: supplementaryDeadline,
      legalBasis: 'KP art. 180² § 6',
    });
  }

  // 7. Sytuacje szczególne matki i przejęcie urlopu przez ojca
  if (
    fatherInsured &&
    (input.special.motherHospitalized ||
      input.special.motherIncapableOfIndependentLiving ||
      input.special.motherDeceased)
  ) {
    const proofName = input.special.motherDeceased
      ? 'Odpis skrócony aktu zgonu matki (przejęcie urlopu przez ojca)'
      : input.special.motherIncapableOfIndependentLiving
        ? 'Orzeczenie o niezdolności matki do samodzielnej egzystencji'
        : 'Zaświadczenie ze szpitala o pobycie matki uniemożliwiającym opiekę nad dzieckiem';
    documents.push({
      id: 'motherSpecialProof',
      name: proofName,
      submitTo: fatherPayer,
      deadline: null,
      note: 'Stanowi podstawę do wcześniejszego przejęcia urlopu macierzyńskiego przez ubezpieczonego ojca dziecka.',
    });

    const takeoverDate = addDays(
      eventDate,
      params.maternityLeave.motherMandatoryWeeksWithIncapacityCertificate * 7,
    );
    if (!input.special.motherDeceased) {
      deadlines.push({
        label: `Wniosek ojca o przejęcie części urlopu macierzyńskiego (${params.applicationDeadlinesDays.fatherTakeoverPart} dni przed przejęciem)`,
        date: addDays(takeoverDate, -params.applicationDeadlinesDays.fatherTakeoverPart),
        legalBasis: 'KP art. 180 § 6–10; Rozporządzenie poz. 322',
      });
    }
  }

  // 8. Dokumenty ojca (urlop rodzicielski, przejęcie, urlop ojcowski – płatnik liczony DLA OJCA!)
  if (father && fatherInsured && father.wantsLeave && !childLostAll) {
    const canTakePaternity = !(
      input.situation === 'adoption' && input.adoptionType === 'fosterFamily'
    );

    documents.push({
      id: 'fatherFormZAM',
      name:
        fatherPayer === 'employer' && father.insuranceTitle === 'employment'
          ? 'Wniosek ojca do pracodawcy o urlop rodzicielski (i/lub ojcowski) z oświadczeniem o podziale urlopu'
          : 'Wniosek ojca o zasiłek macierzyński (formularz ZUS ZAM – obejmuje urlop rodzicielski i ojcowski)',
      submitTo: fatherPayer,
      deadline: parentalApplicationDeadline,
      note:
        fatherPayer === 'employer'
          ? `Płatnik ojca zgłasza powyżej ${params.payerThresholdInsuredCount} ubezpieczonych, więc wypłaca zasiłek ojca. Wniosek o urlop rodzicielski składa się min. ${params.applicationDeadlinesDays.parentalLeave} dni przed startem.`
          : 'Od 24.10.2026 r. formularze ZUR i ZAO zostały połączone z ZUS ZAM. Złóż ZUS ZAM elektronicznie przez PUE/eZUS.',
    });

    if (fatherPayer === 'zus') {
      if (father.insuranceTitle === 'employment') {
        documents.push({
          id: 'fatherFormZ3',
          name: 'Zaświadczenie płatnika składek ZUS Z-3 dla ojca (przekazuje pracodawca ojca do ZUS)',
          submitTo: 'zus',
          deadline: null,
          note: `Pracodawca ojca zgłasza do ${params.payerThresholdInsuredCount} ubezpieczonych, więc zasiłek ojca wypłaca ZUS.`,
        });
      } else if (father.insuranceTitle === 'mandateContract') {
        documents.push({
          id: 'fatherFormZ3a',
          name: 'Zaświadczenie płatnika składek ZUS Z-3a dla ojca (przekazuje zleceniodawca ojca do ZUS)',
          submitTo: 'zus',
          deadline: null,
          note: `Zleceniodawca ojca zgłasza do ${params.payerThresholdInsuredCount} ubezpieczonych, więc zasiłek ojca wypłaca ZUS.`,
        });
      }
    }

    if (canTakePaternity) {
      const paternityMinDays = params.applicationDeadlinesDays.paternityLeave;
      const paternityExpiryDate =
        input.situation === 'adoption'
          ? addMonths(eventDate, params.paternityLeave.adoptionDeadlineMonthsFromAdoption)
          : addMonths(eventDate, params.paternityLeave.deadlineChildAgeMonths);
      const latestPaternityApplicationDate = addDays(
        addDays(paternityExpiryDate, -(params.paternityLeave.weeks * 7)),
        -paternityMinDays,
      );

      documents.push({
        id: 'applicationPaternity',
        name:
          fatherPayer === 'employer' && father.insuranceTitle === 'employment'
            ? `Wniosek ojca do pracodawcy o urlop ojcowski (${params.paternityLeave.weeks} tyg.)`
            : 'Wniosek ojca o zasiłek za urlop ojcowski (ZUS ZAM – dawny ZAO zlikwidowany 24.10.2026 r.)',
        submitTo: fatherPayer,
        deadline: latestPaternityApplicationDate,
        note: `Wniosek składa się nie później niż ${paternityMinDays} dni przed rozpoczęciem urlopu ojcowskiego (do wykorzystania przed ${paternityExpiryDate}).`,
      });

      deadlines.push({
        label: `Ostateczny termin na wykorzystanie urlopu ojcowskiego (${input.situation === 'adoption' ? `${params.paternityLeave.adoptionDeadlineMonthsFromAdoption} mies. od przysposobienia, max ${params.paternityLeave.adoptionMaxChildAgeYears} lat` : `${params.paternityLeave.deadlineChildAgeMonths} mies. życia dziecka`}; wniosek min. ${paternityMinDays} dni przed startem)`,
        date: paternityExpiryDate,
        legalBasis: 'KP art. 182³ § 1–2',
      });
    }
  }

  // 9. Główne terminy urlopów i wniosków (tylko gdy dziecko żyje)
  if (!childLostAll) {
    deadlines.push({
      label: `Termin na wniosek o zasiłek w wariancie ${formatPercentPl(params.rates.combined)} (${params.combinedRateApplicationDeadlineDays} dni po dniu zdarzenia)`,
      date: combinedDeadline,
      legalBasis: 'Ustawa zasiłkowa art. 30a ust. 1',
    });

    deadlines.push({
      label: `Termin na wniosek o urlop rodzicielski w trybie standardowym (${params.applicationDeadlinesDays.parentalLeave} dni przed rozpoczęciem urlopu rodzicielskiego)`,
      date: parentalApplicationDeadline,
      legalBasis: 'KP art. 182¹d § 1',
    });

    if (mother.insuranceTitle === 'selfEmployed' && motherInsured) {
      const motherParentalWeeks =
        (input.special.zaZyciemCertificate
          ? input.childrenCount === 1
            ? params.parentalLeave.weeksSingleChildZaZyciem
            : params.parentalLeave.weeksMultipleChildrenZaZyciem
          : input.childrenCount === 1
            ? params.parentalLeave.weeksSingleChild
            : params.parentalLeave.weeksMultipleChildren) -
        params.parentalLeave.nonTransferableWeeksPerParent;
      const afterBenefitDate = addDays(parentalStartDate, motherParentalWeeks * 7);
      deadlines.push({
        label:
          'Przypomnienie JDG: ponowne zgłoszenie ZUS ZUA do dobrowolnego ubezpieczenia chorobowego po zakończeniu zasiłku macierzyńskiego',
        date: afterBenefitDate,
        legalBasis: 'Ustawa o systemie ubezpieczeń społecznych art. 14',
      });
    }
  }

  return {
    payer: primaryPayer,
    documents,
    deadlines,
  };
}
