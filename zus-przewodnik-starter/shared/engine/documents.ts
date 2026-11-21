import type {
  BenefitParams,
  DocumentChecklist,
  Payer,
  RequiredDocument,
  ScenarioInput,
} from '../types';
import { addDays } from './core';

export function getRequiredDocuments(
  input: ScenarioInput,
  params: BenefitParams,
): DocumentChecklist {
  const mother = input.mother;
  const isEmployee = mother.insuranceTitle === 'employment';
  const employerPayer = isEmployee && (mother.employerInsuredCount ?? 0) > params.payerThresholdInsuredCount;
  const payer: Payer = employerPayer ? 'employer' : 'zus';

  const documents: RequiredDocument[] = [];
  const eventDate = input.birthDate ?? input.expectedBirthDate ?? input.childAcceptanceDate ?? input.referenceDate;

  // 1. Dokument tożsamości / stanu cywilnego lub orzeczenie adopcyjne
  if (input.situation === 'adoption') {
    documents.push({
      id: 'adoptionCourtOrder',
      name: 'Prawomocne postanowienie sądu opiekuńczego o powierzeniu opieki lub zaświadczenie sądu',
      submitTo: payer,
      deadline: addDays(eventDate, params.applicationDeadlinesDays.fosterFamilyAfterAcceptance),
      note: 'Potwierdzenie przyjęcia dziecka na wychowanie jako rodzina zastępcza lub przysposobienie.',
    });
  } else {
    documents.push({
      id: 'birthCertificateShort',
      name: 'Skrócony odpis aktu urodzenia dziecka (lub zagraniczny akt urodzenia)',
      submitTo: payer,
      deadline: addDays(eventDate, params.combinedRateApplicationDeadlineDays),
      note: 'Odpis aktu urodzenia można pobrać bezpłatnie w urzędzie stanu cywilnego lub przez mObywatela.',
    });
  }

  // 2. Wniosek o zasiłek / urlop
  if (payer === 'employer') {
    documents.push({
      id: 'applicationToEmployer',
      name: 'Pisemny wniosek pracownika o udzielenie urlopu macierzyńskiego i rodzicielskiego',
      submitTo: 'employer',
      deadline: addDays(eventDate, params.combinedRateApplicationDeadlineDays),
      note: 'Dla stawki 81,5% wniosek musi zostać złożony w terminie 21 dni od dnia porodu.',
    });
  } else {
    documents.push({
      id: 'formZAM',
      name: 'Wniosek o zasiłek macierzyński (formularz ZUS ZAM)',
      submitTo: 'zus',
      deadline: addDays(eventDate, params.combinedRateApplicationDeadlineDays),
      note: 'Wniosek można złożyć elektronicznie przez portal PUE/eZUS.',
    });
  }

  // 3. Zaświadczenia płatnika składek gdy ZUS jest płatnikiem zasiłku
  if (payer === 'zus') {
    if (mother.insuranceTitle === 'employment') {
      documents.push({
        id: 'formZ3',
        name: 'Zaświadczenie płatnika składek ZUS Z-3 (wypełnia pracodawca)',
        submitTo: 'zus',
        deadline: null,
        note: 'Pracodawca zatrudniający do 20 pracowników ma obowiązek przekazać Z-3 do ZUS.',
      });
    } else if (mother.insuranceTitle === 'mandateContract') {
      documents.push({
        id: 'formZ3a',
        name: 'Zaświadczenie płatnika składek ZUS Z-3a (wypełnia zleceniodawca)',
        submitTo: 'zus',
        deadline: null,
        note: 'Zleceniodawca potwierdza okres ubezpieczenia i wysokość przychodu.',
      });
    } else if (mother.insuranceTitle === 'selfEmployed') {
      documents.push({
        id: 'formZAS53',
        name: 'Zaświadczenie płatnika składek ZUS ZAS-53 (wypełnia przedsiębiorca)',
        submitTo: 'zus',
        deadline: null,
        note: 'Składane osobiście przez ubezpieczonego prowadzącego pozarolniczą działalność.',
      });
    }
  }

  // 4. Zaświadczenie "Za życiem"
  if (input.special.zaZyciemCertificate) {
    documents.push({
      id: 'certificateZaZyciem',
      name: 'Zaświadczenie lekarskie potwierdzające ciężkie i nieodwracalne upośledzenie (ustawa Za życiem)',
      submitTo: payer,
      deadline: null,
      note: 'Wystawione przez lekarza ubezpieczenia zdrowotnego posiadającego specjalizację II stopnia lub tytuł specjalisty.',
    });
  }

  // 5. Hospitalizacja noworodka / wcześniak
  if (input.special.hospitalizationDays || input.special.pregnancyWeekAtBirth) {
    documents.push({
      id: 'hospitalizationCertificate',
      name: 'Zaświadczenie ze szpitala o okresie hospitalizacji dziecka i tygodniu ciąży',
      submitTo: payer,
      deadline: addDays(eventDate, params.applicationDeadlinesDays.supplementaryMaternityLeave),
      note: 'Niezbędne do ustalenia prawa do uzupełniającego urlopu macierzyńskiego.',
    });
  }

  // 6. Urlop ojcowski (jeśli ojciec wnioskuje)
  if (input.father?.wantsLeave) {
    documents.push({
      id: 'applicationPaternity',
      name: 'Wniosek ojca o urlop ojcowski z oświadczeniem o braku wcześniejszego pobrania zasiłku',
      submitTo: (input.father.employerInsuredCount ?? 0) > params.payerThresholdInsuredCount ? 'employer' : 'zus',
      deadline: addDays(eventDate, 7),
      note: 'Wniosek składa się w terminie nie krótszym niż 7 dni przed rozpoczęciem korzystania z urlopu.',
    });
  }

  const deadlines = [
    {
      label: 'Termin na złożenie wniosku o zasiłek w wariancie 81,5% (tzw. długi wniosek)',
      date: addDays(eventDate, params.combinedRateApplicationDeadlineDays),
      legalBasis: 'Ustawa zasiłkowa art. 30a ust. 1',
    },
    {
      label: 'Termin na złożenie wniosku o urlop rodzicielski w standardowym trybie',
      date: addDays(eventDate, params.applicationDeadlinesDays.parentalLeave),
      legalBasis: 'Kodeks pracy art. 182¹d § 1',
    },
  ];

  return {
    payer,
    documents,
    deadlines,
  };
}
