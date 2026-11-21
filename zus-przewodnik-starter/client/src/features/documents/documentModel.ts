import type {
  BenefitParams,
  DocumentChecklist,
  IsoDate,
  ParentData,
  Payer,
  RequiredDocument,
  ScenarioInput,
} from '@shared/types';
import { resolveParentPayer } from '@shared/engine';
import { formatPolishDate, getExplicitEventDate } from '../plan/planScenario';

export type DocumentGroupId = 'pregnancySickness' | 'mother' | 'father' | 'attachments' | 'other';

export interface DocumentGroup {
  id: DocumentGroupId;
  title: string;
  description: string | null;
  documents: RequiredDocument[];
}

export interface ParentFilingInfo {
  role: 'mother' | 'father' | 'single';
  label: string;
  payer: Payer | null;
  payerUnknown: boolean;
  summary: string;
  method: string | null;
}

export interface DeadlineItem {
  label: string;
  date: IsoDate;
  legalBasis: string | null;
}

export interface PartitionedDeadlines {
  sorted: DeadlineItem[];
  overdue: DeadlineItem[];
  upcoming: DeadlineItem[];
  featured: DeadlineItem | null;
  featuredIsOverdue: boolean;
  remaining: DeadlineItem[];
}

export interface NextActionSummary {
  text: string;
  isOverdue: boolean;
  overdueHint: string | null;
  allCompleted: boolean;
  empty: boolean;
}

export interface PlanAssumptionInfo {
  eventLabel: string;
  eventDateFormatted: string | null;
  parentalAdvanceDays: number;
  paternityAdvanceDays: number;
}

const PREGNANCY_SICKNESS_IDS = new Set([
  'eZlaCodeB',
  'formZAS53',
  'formZ3Sickness',
  'formZ3aSickness',
]);

const MOTHER_DOC_IDS = new Set([
  'applicationToEmployer',
  'formZAM',
  'formZ3',
  'formZ3a',
  'bankruptcyProof',
]);

const FATHER_DOC_IDS = new Set([
  'fatherFormZAM',
  'fatherFormZ3',
  'fatherFormZ3a',
  'applicationPaternity',
  'motherSpecialProof',
]);

const ATTACHMENT_DOC_IDS = new Set([
  'birthCertificateShort',
  'deathCertificate',
  'adoptionCourtOrder',
  'certificateZaZyciem',
  'hospitalizationCertificate',
]);

export function isDatePast(isoDate: IsoDate | null, referenceDate: IsoDate | null): boolean {
  return Boolean(isoDate && referenceDate && isoDate < referenceDate);
}

function isParentInsured(parent: ParentData): boolean {
  return parent.insuranceTitle !== 'none' && parent.sicknessInsurance !== 'none';
}

function formatParentPlaceSummary(
  parent: ParentData | null,
  payer: Payer | null,
  payerUnknown: boolean,
  bankruptcy: boolean,
): { summary: string; method: string | null } {
  if (payer === 'employer') {
    const placeLabel =
      parent?.insuranceTitle === 'mandateContract'
        ? 'U zleceniodawcy (wypłaca zasiłek)'
        : 'U pracodawcy (wypłaca zasiłek)';
    return {
      summary: placeLabel,
      method: 'Papierowo lub elektronicznie w kadrach / u płatnika składek.',
    };
  }
  if (payer === 'zus') {
    if (bankruptcy) {
      return {
        summary: 'W ZUS (upadłość lub likwidacja pracodawcy)',
        method: 'Elektronicznie przez PUE/eZUS (symulacja) lub papierowo w placówce ZUS.',
      };
    }
    if (payerUnknown) {
      return {
        summary: 'W ZUS (nie podano liczby ubezpieczonych – przyjęto ZUS)',
        method:
          'Elektronicznie przez PUE/eZUS (symulacja) lub papierowo. Jeśli firma zgłasza powyżej progu osób, uzupełnij tę informację w danych.',
      };
    }
    return {
      summary: 'W ZUS (najwygodniej przez PUE/eZUS)',
      method: 'Elektronicznie przez PUE/eZUS (symulacja) lub papierowo w placówce ZUS.',
    };
  }
  return {
    summary: 'Brak ubezpieczenia chorobowego',
    method: null,
  };
}

export function resolveParentsFilingInfo(
  checklist: DocumentChecklist,
  scenario: ScenarioInput | undefined,
  params: BenefitParams,
): ParentFilingInfo[] {
  if (!scenario) {
    const formatted = formatParentPlaceSummary(null, checklist.payer, false, false);
    return [
      {
        role: 'single',
        label: 'Gdzie składasz dokumenty',
        payer: checklist.payer,
        payerUnknown: false,
        summary: formatted.summary,
        method: formatted.method,
      },
    ];
  }

  const motherActive = isParentInsured(scenario.mother) && !scenario.special.motherDeceased;
  const motherResolved = motherActive ? resolveParentPayer(scenario.mother, params) : null;
  const motherUnknown =
    motherActive && !scenario.special.employerBankruptcyOrLiquidation && motherResolved === null;
  const motherPayer: Payer | null = motherActive
    ? scenario.special.employerBankruptcyOrLiquidation
      ? 'zus'
      : (motherResolved ?? 'zus')
    : null;

  const father = scenario.father;
  const fatherInsured = father !== null && isParentInsured(father);
  const fatherResolved = father && fatherInsured ? resolveParentPayer(father, params) : null;
  const fatherUnknown = Boolean(father && fatherInsured && fatherResolved === null);
  const fatherPayer: Payer | null = father && fatherInsured ? (fatherResolved ?? 'zus') : null;

  // Ścieżka samodzielnego ojca lub zgon matki – nie pokazuj mylącego wiersza „Matka składa dokumenty”
  const isSingleFatherScenario =
    father !== null &&
    (scenario.special.motherDeceased || (!motherActive && !scenario.mother.wantsLeave));

  if (isSingleFatherScenario && father) {
    const fatherFmt = formatParentPlaceSummary(father, fatherPayer, fatherUnknown, false);
    return [
      {
        role: 'father',
        label: 'Ojciec składa dokumenty',
        payer: fatherPayer,
        payerUnknown: fatherUnknown,
        summary: fatherFmt.summary,
        method: fatherFmt.method,
      },
    ];
  }

  if (father) {
    const motherFmt = formatParentPlaceSummary(
      scenario.mother,
      motherPayer,
      motherUnknown,
      scenario.special.employerBankruptcyOrLiquidation,
    );
    const fatherFmt = formatParentPlaceSummary(father, fatherPayer, fatherUnknown, false);
    return [
      {
        role: 'mother',
        label: 'Matka składa dokumenty',
        payer: motherPayer,
        payerUnknown: motherUnknown,
        summary: motherFmt.summary,
        method: motherFmt.method,
      },
      {
        role: 'father',
        label: 'Ojciec składa dokumenty',
        payer: fatherPayer,
        payerUnknown: fatherUnknown,
        summary: fatherFmt.summary,
        method: fatherFmt.method,
      },
    ];
  }

  const singleFmt = formatParentPlaceSummary(
    scenario.mother,
    motherPayer,
    motherUnknown,
    scenario.special.employerBankruptcyOrLiquidation,
  );
  return [
    {
      role: 'single',
      label: 'Gdzie składasz dokumenty',
      payer: motherPayer,
      payerUnknown: motherUnknown,
      summary: singleFmt.summary,
      method: singleFmt.method,
    },
  ];
}

export function formatSubmitTarget(doc: RequiredDocument): string {
  if (doc.id === 'eZlaCodeB') {
    return 'Automatycznie (e-ZLA)';
  }
  return doc.submitTo === 'employer' ? 'Pracodawca' : 'ZUS (PUE/eZUS)';
}

export function formatSubmissionMethod(doc: RequiredDocument): string {
  if (doc.id === 'eZlaCodeB') {
    return 'Lekarz przekazuje elektronicznie do ZUS i na profil płatnika (PUE/eZUS).';
  }
  if (doc.submitTo === 'employer') {
    return 'Papierowo lub elektronicznie u pracodawcy / płatnika składek.';
  }
  return 'Elektronicznie przez PUE/eZUS (symulacja) lub papierowo w ZUS.';
}

function buildPregnancySicknessDescription(
  scenario: ScenarioInput | undefined,
  params: BenefitParams,
): string {
  if (!scenario) {
    return 'Zaświadczenie e-ZLA z kodem „B” lekarz wysyła automatycznie do ZUS i na profil płatnika.';
  }
  const threshold = params.payerThresholdInsuredCount;
  const payer = scenario.special.employerBankruptcyOrLiquidation
    ? 'zus'
    : (resolveParentPayer(scenario.mother, params) ?? 'zus');

  if (scenario.mother.insuranceTitle === 'selfEmployed') {
    return 'Lekarz przesyła e-ZLA z kodem „B” automatycznie do ZUS. Przy JDG złóż dodatkowo wniosek ZUS ZAS-53 przez PUE/eZUS (symulacja) lub papierowo.';
  }
  if (payer === 'employer') {
    return `Lekarz przesyła e-ZLA z kodem „B” automatycznie do ZUS i na PUE/eZUS płatnika. Płatnik zgłaszający powyżej ${threshold} osób wypłaca świadczenie bezpośrednio – poinformuj go o nieobecności.`;
  }
  if (scenario.mother.insuranceTitle === 'mandateContract') {
    return `Lekarz przesyła e-ZLA z kodem „B” automatycznie do ZUS i na PUE/eZUS zleceniodawcy. Płatnik zgłaszający do ${threshold} osób przekazuje do ZUS zaświadczenie Z-3a.`;
  }
  return `Lekarz przesyła e-ZLA z kodem „B” automatycznie do ZUS i na PUE/eZUS pracodawcy. Pracodawca (do ${threshold} ubezpieczonych) przekazuje do ZUS zaświadczenie Z-3 oraz ZAS-12 na dalszy okres.`;
}

function classifyDocumentGroup(doc: RequiredDocument): DocumentGroupId {
  if (PREGNANCY_SICKNESS_IDS.has(doc.id)) return 'pregnancySickness';
  if (MOTHER_DOC_IDS.has(doc.id)) return 'mother';
  if (FATHER_DOC_IDS.has(doc.id)) return 'father';
  if (ATTACHMENT_DOC_IDS.has(doc.id)) return 'attachments';
  return 'other';
}

export function groupDocuments(
  documents: RequiredDocument[],
  scenario: ScenarioInput | undefined,
  params: BenefitParams,
): DocumentGroup[] {
  const buckets: Record<DocumentGroupId, RequiredDocument[]> = {
    pregnancySickness: [],
    mother: [],
    father: [],
    attachments: [],
    other: [],
  };

  for (const doc of documents) {
    buckets[classifyDocumentGroup(doc)].push(doc);
  }

  const ordered: DocumentGroup[] = [
    {
      id: 'pregnancySickness',
      title: 'Zwolnienie lekarskie w ciąży (e-ZLA, kod „B”)',
      description: buildPregnancySicknessDescription(scenario, params),
      documents: buckets.pregnancySickness,
    },
    {
      id: 'mother',
      title: scenario?.father
        ? 'Dokumenty matki (wniosek i płatnik)'
        : 'Wnioski i dokumenty płatnika',
      description: null,
      documents: buckets.mother,
    },
    {
      id: 'father',
      title: 'Dokumenty ojca / drugiego rodzica',
      description: null,
      documents: buckets.father,
    },
    {
      id: 'attachments',
      title: 'Załączniki i dokumenty stanu cywilnego',
      description: 'Dokumenty potwierdzające prawo do świadczenia lub wpływające na jego wymiar.',
      documents: buckets.attachments,
    },
    {
      id: 'other',
      title: 'Pozostałe dokumenty',
      description: null,
      documents: buckets.other,
    },
  ];

  return ordered.filter((group) => group.documents.length > 0);
}

function isApplicationDoc(doc: RequiredDocument): boolean {
  return !ATTACHMENT_DOC_IDS.has(doc.id);
}

export function partitionDeadlines(
  deadlines: DeadlineItem[],
  referenceDate: IsoDate | null,
): PartitionedDeadlines {
  const sorted = [...deadlines].sort((a, b) => a.date.localeCompare(b.date));
  const overdue = referenceDate ? sorted.filter((item) => item.date < referenceDate) : [];
  const upcoming = referenceDate ? sorted.filter((item) => item.date >= referenceDate) : sorted;
  const featured = upcoming[0] ?? overdue[overdue.length - 1] ?? null;
  const featuredIsOverdue = Boolean(featured && isDatePast(featured.date, referenceDate));
  const remaining = featured ? sorted.filter((item) => item !== featured) : [];

  return {
    sorted,
    overdue,
    upcoming,
    featured,
    featuredIsOverdue,
    remaining,
  };
}

export function selectNextAction(
  checklist: DocumentChecklist,
  checkedMap: Record<string, boolean>,
  referenceDate: IsoDate | null,
): NextActionSummary {
  if (checklist.documents.length === 0) {
    return {
      text: 'Dla podanych danych nie wygenerowano wymaganych dokumentów do złożenia.',
      isOverdue: false,
      overdueHint: null,
      allCompleted: false,
      empty: true,
    };
  }

  const uncheckedDocs = checklist.documents.filter((doc) => !checkedMap[doc.id]);
  const uncheckedWithDeadline = uncheckedDocs
    .filter((doc): doc is RequiredDocument & { deadline: string } => doc.deadline !== null)
    .sort((a, b) => {
      const dateCmp = a.deadline.localeCompare(b.deadline);
      if (dateCmp !== 0) return dateCmp;
      return Number(isApplicationDoc(b)) - Number(isApplicationDoc(a));
    });

  const nextDoc = uncheckedWithDeadline[0] ?? uncheckedDocs[0] ?? null;

  if (nextDoc) {
    const overdue = isDatePast(nextDoc.deadline, referenceDate);
    if (nextDoc.id === 'eZlaCodeB') {
      return {
        text: `Następny krok: lekarz wystawia „${nextDoc.name}” automatycznie – poinformuj płatnika o nieobecności.`,
        isOverdue: false,
        overdueHint: null,
        allCompleted: false,
        empty: false,
      };
    }

    const targetPhrase = nextDoc.submitTo === 'employer' ? 'u pracodawcy' : 'w ZUS (PUE/eZUS)';
    const deadlinePhrase = nextDoc.deadline ? ` (do ${formatPolishDate(nextDoc.deadline)})` : '';

    return {
      text: `Następny krok: złóż „${nextDoc.name}” ${targetPhrase}${deadlinePhrase}.`,
      isOverdue: overdue,
      overdueHint:
        overdue && nextDoc.deadline
          ? `Termin ${formatPolishDate(nextDoc.deadline)} już minął względem daty odniesienia (${formatPolishDate(referenceDate)}). Skontaktuj się z płatnikiem lub ZUS albo sprawdź standardowy wariant wniosków.`
          : null,
      allCompleted: false,
      empty: false,
    };
  }

  const { featured, featuredIsOverdue } = partitionDeadlines(checklist.deadlines, referenceDate);
  if (featured) {
    return {
      text: `Wszystkie dokumenty z listy masz odhaczone. ${featuredIsOverdue ? 'Uwaga – termin minął' : 'Najbliższy termin'}: ${featured.label} (${formatPolishDate(featured.date)}).`,
      isOverdue: featuredIsOverdue,
      overdueHint: null,
      allCompleted: true,
      empty: false,
    };
  }

  return {
    text: 'Wszystkie dokumenty z listy masz odhaczone.',
    isOverdue: false,
    overdueHint: null,
    allCompleted: true,
    empty: false,
  };
}

export function buildPlanAssumptionInfo(
  scenario: ScenarioInput | undefined,
  params: BenefitParams,
): PlanAssumptionInfo {
  const eventDate = scenario ? getExplicitEventDate(scenario) : null;
  let eventLabel = 'daty zdarzenia';
  if (scenario?.situation === 'adoption') {
    eventLabel = 'daty przyjęcia dziecka';
  } else if (scenario?.situation === 'afterBirth') {
    eventLabel = 'daty porodu';
  } else if (scenario?.situation === 'pregnant' || scenario?.situation === 'planning') {
    eventLabel = 'przewidywanej daty porodu';
  }

  return {
    eventLabel,
    eventDateFormatted: eventDate ? formatPolishDate(eventDate) : null,
    parentalAdvanceDays: params.applicationDeadlinesDays.parentalLeave,
    paternityAdvanceDays: params.applicationDeadlinesDays.paternityLeave,
  };
}
