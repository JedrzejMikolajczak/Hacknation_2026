import { useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { BenefitParams, CaseDocument } from '@shared/types';
import { DEFAULT_PARAMS, formatRate } from '../../../app/benefitParams';
import { useScenario } from '../../../app/ScenarioContext';
import { parentLabels, roles } from '../caseLabels';
import { diffDaysIso, formatPolishDate, todayIsoDate } from '../planScenario';
import { ApplicationPreview } from './ApplicationPreview';
import './DocumentsTab.css';
import './ApplicationsTab.css';
import './CasePaperwork.css';

const PREGNANCY_SICKNESS_IDS = new Set(['e-ZLA', 'ZAS-53', 'ZAS-12']);
const PAYER_CERTIFICATE_IDS = new Set(['Z-3', 'Z-3a', 'ZAS-12']);
const ATTACHMENT_IDS = new Set([
  'BIRTH_CERTIFICATE',
  'USC_COPY',
  'ADOPTION_ORDER',
  'HOSPITAL_CERTIFICATE',
  'ZA_ZYCIEM_CERTIFICATE',
  'STILLBIRTH_CERTIFICATE',
  'DEATH_CERTIFICATE',
  'EXPECTED_BIRTH_CERTIFICATE',
]);

const documentKey = (doc: CaseDocument) =>
  `${doc.parent_role}-${doc.id}-${doc.start_date ?? ''}-${doc.end_date ?? ''}`;

function isMandateEntitledRole(
  documents: CaseDocument[],
  role: CaseDocument['parent_role'],
): boolean {
  return documents.some(
    (doc) =>
      doc.parent_role === role && doc.submit_to === 'EMPLOYER' && /zleceniodawc/i.test(doc.name_pl),
  );
}

function formatSubmitBadge(doc: CaseDocument, mandateEntitled: boolean): string {
  if (doc.id === 'e-ZLA') return 'Automatycznie (e-ZLA)';
  if (doc.submit_to === 'EMPLOYER') return mandateEntitled ? 'Zleceniodawca' : 'Pracodawca';
  if (doc.submit_to === 'ZUS') return 'ZUS (PUE/eZUS)';
  if (doc.submit_to === 'USC') return 'USC (gov.pl)';
  return 'Do ustalenia';
}

function submitBadgeClass(doc: CaseDocument): string {
  if (doc.id === 'e-ZLA') return 'plan-badge plan-badge--yes';
  if (doc.submit_to === 'EMPLOYER') return 'plan-badge plan-badge--navy';
  return 'plan-badge plan-badge--code';
}

function formatSubmitMethod(doc: CaseDocument, mandateEntitled: boolean): string {
  if (doc.id === 'e-ZLA') {
    return 'Lekarz przekazuje elektronicznie do ZUS i na profil płatnika (PUE/eZUS).';
  }
  if (doc.id === 'Z-3' || doc.id === 'ZAS-12') {
    return 'Przekazuje do ZUS pracodawca przez PUE/eZUS.';
  }
  if (doc.id === 'Z-3a') {
    return 'Przekazuje do ZUS zleceniodawca przez PUE/eZUS.';
  }
  if (doc.submit_to === 'EMPLOYER') {
    return mandateEntitled
      ? 'Papierowo lub elektronicznie u płatnika składek (zleceniodawcy).'
      : 'Papierowo lub elektronicznie w kadrach u pracodawcy.';
  }
  if (doc.submit_to === 'ZUS') {
    return 'Elektronicznie przez PUE/eZUS (symulacja) lub papierowo w placówce ZUS.';
  }
  if (doc.submit_to === 'USC') {
    return 'Przez gov.pl (Rejestr Stanu Cywilnego) lub w urzędzie stanu cywilnego.';
  }
  return 'Zależnie od formy zatrudnienia i wielkości płatnika (uzupełnij dane rodzica).';
}

function formatTargetPhrase(doc: CaseDocument, mandateEntitled: boolean): string {
  if (doc.submit_to === 'EMPLOYER') {
    return mandateEntitled ? ' u zleceniodawcy' : ' u pracodawcy';
  }
  if (doc.submit_to === 'ZUS') return ' w ZUS (PUE/eZUS)';
  if (doc.submit_to === 'USC') return ' w Urzędzie Stanu Cywilnego';
  return ' u właściwego płatnika';
}

function describeDocumentDetails(
  doc: CaseDocument,
  effectiveDate: string,
  params: BenefitParams,
  mandateEntitled: boolean,
): string {
  const threshold = params.payerThresholdInsuredCount;
  const deadlines = params.applicationDeadlinesDays;
  const combinedRate = formatRate(params.rates.combined);
  const secondParentRate = formatRate(params.rates.secondParentNonTransferableInCombined);

  switch (doc.id) {
    case 'ZAM':
      return mandateEntitled
        ? `Od ${formatPolishDate(effectiveDate)} r. jeden formularz ZUS ZAM zastępuje dawne druki ZUR i ZAO, a druk Z-3b został zlikwidowany. Zleceniodawca zgłaszający powyżej ${threshold} ubezpieczonych sam ustala i wypłaca zasiłek na podstawie ZAM (bez Z-3a do ZUS).`
        : `Od ${formatPolishDate(effectiveDate)} r. jeden formularz ZUS ZAM zastępuje dawne druki ZUR i ZAO, a druk Z-3b został zlikwidowany.`;
    case 'Z-3':
      return `Zaświadczenie wypełnia i przesyła do ZUS pracodawca zgłaszający do ${threshold} ubezpieczonych – Ty składasz dokumenty w kadrach. Na dalszy okres zasiłku chorobowego pracodawca przekazuje ZAS-12.`;
    case 'Z-3a':
      return `Zaświadczenie wypełnia i przesyła do ZUS zleceniodawca zgłaszający do ${threshold} ubezpieczonych – zasiłek wypłaca ZUS.`;
    case 'ZAS-53':
      return 'Wniosek o zasiłek chorobowy składany bezpośrednio do ZUS przez osobę prowadzącą działalność gospodarczą (JDG).';
    case 'ZAS-12':
      return 'Zaświadczenie płatnika składek składane przez pracodawcę wyłącznie na dalszy okres nieprzerwanego zasiłku chorobowego, gdy świadczenie wypłaca ZUS.';
    case 'e-ZLA':
      return `Zaświadczenie lekarskie w ciąży z kodem literowym „B” daje zasiłek w wysokości ${formatRate(params.rates.sicknessPregnancy)} podstawy wymiaru. Trafia elektronicznie do ZUS i na profil płatnika – pracownik informuje pracodawcę o nieobecności, a zleceniobiorca lub osoba na JDG powstrzymuje się od pracy zawodowej.`;
    case 'BIRTH_CERTIFICATE':
      return 'Skrócony odpis aktu urodzenia dziecka dołączany do wniosku o zasiłek macierzyński.';
    case 'STILLBIRTH_CERTIFICATE':
      return 'Skrócony odpis aktu urodzenia z adnotacją o martwym urodzeniu (wydawany bezpłatnie przez USC) lub zaświadczenie o martwym urodzeniu. Dokument jest potrzebny do ustalenia prawa do zasiłku macierzyńskiego po stracie dziecka.';
    case 'DEATH_CERTIFICATE':
      return 'Skrócony odpis aktu zgonu dziecka wydawany przez Urząd Stanu Cywilnego. Pozwala ustalić właściwy wymiar zasiłku macierzyńskiego.';
    case 'EXPECTED_BIRTH_CERTIFICATE':
      return `Zaświadczenie lekarskie o przewidywanej dacie porodu jest wymagane, gdy urlop lub zasiłek macierzyński rozpoczyna się przed porodem (maksymalnie ${params.maternityLeave.maxWeeksBeforeBirth} tygodni przed przewidywaną datą porodu).`;
    case 'USC_COPY':
      return 'Odpis aktu stanu cywilnego do celów zasiłkowych uzyskasz bez opłaty skarbowej w Urzędzie Stanu Cywilnego lub online przez gov.pl.';
    case 'ADOPTION_ORDER':
      return 'Oświadczenie o dacie przyjęcia dziecka na wychowanie oraz zaświadczenie sądu o wystąpieniu o przysposobienie albo orzeczenie o ustanowieniu rodziny zastępczej niezawodowej.';
    case 'HOSPITAL_CERTIFICATE':
      return 'Zaświadczenie wydane przez szpital wskazujące okres pobytu dziecka w szpitalu, tydzień ciąży w chwili porodu i masę urodzeniową – podstawa uzupełniającego urlopu macierzyńskiego.';
    case 'ZA_ZYCIEM_CERTIFICATE':
      return 'Zaświadczenie lekarskie z art. 4 ust. 3 ustawy „Za życiem” potwierdzające ciężkie i nieodwracalne upośledzenie albo nieuleczalną chorobę zagrażającą życiu dziecka – uprawnia do wydłużonego urlopu rodzicielskiego.';
    case 'COMBINED_RATE':
      return `Złożenie wniosku w ciągu ${params.combinedRateApplicationDeadlineDays} dni po porodzie daje jednolitą stawkę ${combinedRate} (nieprzenoszalne ${params.parentalLeave.nonTransferableWeeksPerParent} tyg. drugiego rodzica zawsze wynosi ${secondParentRate}).`;
    case 'PARENTAL_REQUEST':
      return `Pracownik składa wniosek co najmniej ${deadlines.parentalLeave} dni przed rozpoczęciem części urlopu rodzicielskiego (wg Rozporządzenia MRPiPS z 11.03.2025 r. poz. 322).`;
    case 'PATERNITY_REQUEST':
      return `Wniosek o urlop ojcowski składa się co najmniej ${deadlines.paternityLeave} dni przed jego rozpoczęciem.`;
    case 'SUPPLEMENTARY_REQUEST':
      return `Jednorazowy wniosek składany najpóźniej ${deadlines.supplementaryMaternityLeave} dni przed zakończeniem podstawowego urlopu macierzyńskiego wraz z zaświadczeniem ze szpitala.`;
    case 'TAKEOVER':
      return `Wniosek ojca o przejęcie części urlopu macierzyńskiego składa się co najmniej ${deadlines.fatherTakeoverPart} dni przed planowanym rozpoczęciem.`;
    case 'ADOPTION_LEAVE':
      return `Wniosek pracownika o urlop na warunkach urlopu macierzyńskiego składany w ciągu ${deadlines.fosterFamilyAfterAcceptance} dni od przyjęcia dziecka.`;
    default:
      return 'Dokument wymagany do ustalenia prawa lub wymiaru zasiłku w Twoim planie.';
  }
}

interface ParentFilingSummary {
  role: 'MOTHER' | 'FATHER';
  label: string;
  summary: string;
  method: string;
}

function resolveParentsFiling(
  documents: CaseDocument[],
  params: BenefitParams,
): ParentFilingSummary[] {
  const threshold = params.payerThresholdInsuredCount;
  const activeRoles = roles.filter((role) => documents.some((doc) => doc.parent_role === role));

  return activeRoles.map((role) => {
    const roleDocs = documents.filter((doc) => doc.parent_role === role);
    const hasZ3 = roleDocs.some((doc) => doc.id === 'Z-3');
    const hasZ3a = roleDocs.some((doc) => doc.id === 'Z-3a');
    const hasMaternityDocs = roleDocs.some((doc) => doc.id === 'ZAM');
    const mandateEntitled = isMandateEntitledRole(documents, role);
    const hasEmployerDoc = roleDocs.some((doc) => doc.submit_to === 'EMPLOYER');
    const hasZusDoc = roleDocs.some(
      (doc) => doc.submit_to === 'ZUS' && !PAYER_CERTIFICATE_IDS.has(doc.id),
    );

    const label =
      activeRoles.length > 1
        ? `${parentLabels[role]} składa dokumenty`
        : `Gdzie składa dokumenty (${parentLabels[role].toLowerCase()})`;

    if (hasZ3) {
      return {
        role,
        label,
        summary: `U pracodawcy → pracodawca przekazuje Z-3 do ZUS (wypłaca ZUS)`,
        method: hasMaternityDocs
          ? `Pracodawca zgłasza do ${threshold} ubezpieczonych: złóż wniosek w kadrach, a pracodawca przekaże Z-3 do ZUS.`
          : `Pracodawca zgłasza do ${threshold} ubezpieczonych: e-ZLA trafia automatycznie, a pracodawca przekazuje Z-3 do ZUS (ZAS-12 tylko na dalszy okres).`,
      };
    }
    if (hasZ3a) {
      return {
        role,
        label,
        summary: `W ZUS (PUE/eZUS) – zleceniodawca przekazuje Z-3a do ZUS (wypłaca ZUS)`,
        method: hasMaternityDocs
          ? `Zleceniodawca zgłasza do ${threshold} ubezpieczonych: złóż ZAM w ZUS (PUE/eZUS), a zleceniodawca przekaże Z-3a do ZUS.`
          : `Zleceniodawca zgłasza do ${threshold} ubezpieczonych: e-ZLA trafia automatycznie, a zleceniodawca przekazuje Z-3a do ZUS.`,
      };
    }
    if (mandateEntitled) {
      return {
        role,
        label,
        summary: `U zleceniodawcy (> ${threshold} ubezpieczonych – wypłaca zleceniodawca)`,
        method: hasMaternityDocs
          ? 'Uprawniony płatnik składek (zleceniodawca) sam ustala i wypłaca zasiłek – złóż ZAM i załączniki u zleceniodawcy (bez Z-3a do ZUS).'
          : 'Uprawniony płatnik składek (zleceniodawca) sam ustala i wypłaca zasiłek na podstawie e-ZLA (bez Z-3a do ZUS).',
      };
    }
    if (hasEmployerDoc) {
      return {
        role,
        label,
        summary: `U pracodawcy (> ${threshold} ubezpieczonych – wypłaca pracodawca)`,
        method: 'Papierowo lub elektronicznie w kadrach u pracodawcy.',
      };
    }
    if (hasZusDoc) {
      return {
        role,
        label,
        summary: 'Bezpośrednio w ZUS (najwygodniej przez PUE/eZUS)',
        method: 'Elektronicznie przez PUE/eZUS (symulacja) lub papierowo w placówce ZUS.',
      };
    }
    return {
      role,
      label,
      summary: 'Do ustalenia (brak danych o wielkości płatnika)',
      method: `Jeśli płatnik zgłasza powyżej ${threshold} ubezpieczonych, zasiłek wypłaca pracodawca lub zleceniodawca; w pozostałych przypadkach – ZUS.`,
    };
  });
}

interface DocumentGroup {
  id: string;
  title: string;
  description: string | null;
  documents: CaseDocument[];
}

function groupCaseDocuments(documents: CaseDocument[], params: BenefitParams): DocumentGroup[] {
  const threshold = params.payerThresholdInsuredCount;
  const pregnancySickness: CaseDocument[] = [];
  const mother: CaseDocument[] = [];
  const father: CaseDocument[] = [];
  const attachments: CaseDocument[] = [];
  const hasMaternityDocs = documents.some((doc) => doc.id === 'ZAM');
  const hasLossDocs = documents.some(
    (doc) => doc.id === 'STILLBIRTH_CERTIFICATE' || doc.id === 'DEATH_CERTIFICATE',
  );

  for (const doc of documents) {
    if (
      PREGNANCY_SICKNESS_IDS.has(doc.id) ||
      (!hasMaternityDocs && PAYER_CERTIFICATE_IDS.has(doc.id))
    ) {
      pregnancySickness.push(doc);
    } else if (ATTACHMENT_IDS.has(doc.id)) {
      attachments.push(doc);
    } else if (doc.parent_role === 'MOTHER') {
      mother.push(doc);
    } else {
      father.push(doc);
    }
  }

  const groups: DocumentGroup[] = [
    {
      id: 'pregnancy-sickness',
      title: 'Zwolnienie lekarskie w ciąży (e-ZLA, kod „B”)',
      description: `Lekarz przesyła e-ZLA z kodem „B” automatycznie do ZUS i na profil płatnika (PUE/eZUS). Gdy płatnik nie wypłaca zasiłków (do ${threshold} ubezpieczonych), pracodawca przekazuje Z-3 (a ZAS-12 tylko na dalszy okres zasiłku chorobowego), zleceniodawca Z-3a, a osoba na JDG składa ZAS-53.`,
      documents: pregnancySickness,
    },
    {
      id: 'mother',
      title: father.length > 0 ? 'Dokumenty matki' : 'Wnioski i dokumenty płatnika',
      description: null,
      documents: mother,
    },
    {
      id: 'father',
      title: 'Dokumenty ojca',
      description: null,
      documents: father,
    },
    {
      id: 'attachments',
      title: 'Załączniki i dokumenty stanu cywilnego',
      description: hasLossDocs
        ? 'Dokumenty stanu cywilnego i zaświadczenia potwierdzające prawo do zasiłku.'
        : 'Dokumenty potwierdzające prawo do świadczenia lub wpływające na jego wymiar (odpis aktu urodzenia, zaświadczenie ze szpitala, „Za życiem”).',
      documents: attachments,
    },
  ];

  return groups.filter((group) => group.documents.length > 0);
}

interface NextStepSummary {
  text: string;
  isOverdue: boolean;
  overdueHint: string | null;
}

function selectNextStep(
  documents: CaseDocument[],
  checkedMap: Record<string, boolean>,
): NextStepSummary {
  const unchecked = documents.filter((doc) => !checkedMap[documentKey(doc)]);
  const withDeadline = unchecked
    .filter((doc): doc is CaseDocument & { deadline: string } => doc.deadline !== null)
    .sort((a, b) => {
      const cmp = a.deadline.localeCompare(b.deadline);
      if (cmp !== 0) return cmp;
      return Number(ATTACHMENT_IDS.has(a.id)) - Number(ATTACHMENT_IDS.has(b.id));
    });

  const isPassive = (doc: CaseDocument) => doc.id === 'e-ZLA' || PAYER_CERTIFICATE_IDS.has(doc.id);
  const next = withDeadline[0] ?? unchecked.find((doc) => !isPassive(doc)) ?? unchecked[0] ?? null;

  if (next) {
    const mandateEntitled = isMandateEntitledRole(documents, next.parent_role);
    if (next.id === 'e-ZLA') {
      const roleDocs = documents.filter((doc) => doc.parent_role === next.parent_role);
      const hasZ3 = roleDocs.some((doc) => doc.id === 'Z-3');
      const hasZ3a = roleDocs.some((doc) => doc.id === 'Z-3a');
      if (hasZ3) {
        return {
          text: 'Następny krok: lekarz wystawia elektroniczne zwolnienie „e-ZLA” (kod „B”) automatycznie – poinformuj pracodawcę o nieobecności, a pracodawca przekaże Z-3 do ZUS.',
          isOverdue: false,
          overdueHint: null,
        };
      }
      if (hasZ3a) {
        return {
          text: 'Następny krok: lekarz wystawia elektroniczne zwolnienie „e-ZLA” (kod „B”) automatycznie – powstrzymaj się od pracy, a zleceniodawca przekaże Z-3a do ZUS.',
          isOverdue: false,
          overdueHint: null,
        };
      }
      if (mandateEntitled) {
        return {
          text: 'Następny krok: lekarz wystawia elektroniczne zwolnienie „e-ZLA” (kod „B”) automatycznie – powstrzymaj się od pracy i poinformuj zleceniodawcę (wypłaca zasiłek).',
          isOverdue: false,
          overdueHint: null,
        };
      }
      return {
        text: 'Następny krok: lekarz wystawia elektroniczne zwolnienie „e-ZLA” (kod „B”) automatycznie – poinformuj pracodawcę o nieobecności.',
        isOverdue: false,
        overdueHint: null,
      };
    }
    if (PAYER_CERTIFICATE_IDS.has(next.id)) {
      return {
        text: `Następny krok: płatnik składek przekazuje „${next.name_pl}” (${parentLabels[next.parent_role]}) do ZUS (PUE/eZUS).`,
        isOverdue: false,
        overdueHint: null,
      };
    }
    const deadlinePhrase = next.deadline ? ` (do ${formatPolishDate(next.deadline)})` : '';
    return {
      text: `Następny krok: złóż „${next.name_pl}” (${parentLabels[next.parent_role]})${formatTargetPhrase(next, mandateEntitled)}${deadlinePhrase}.`,
      isOverdue: next.is_overdue,
      overdueHint:
        next.is_overdue && next.deadline
          ? `Termin ${formatPolishDate(next.deadline)} już minął. Sprawdź skutki przekroczenia terminu lub skontaktuj się z płatnikiem / ZUS.`
          : null,
    };
  }

  const allDeadlines = documents
    .filter((doc): doc is CaseDocument & { deadline: string } => doc.deadline !== null)
    .sort((a, b) => a.deadline.localeCompare(b.deadline));
  const upcoming = allDeadlines.find((doc) => !doc.is_overdue);
  const featured = upcoming ?? allDeadlines[allDeadlines.length - 1] ?? null;

  if (featured) {
    return {
      text: `Wszystkie dokumenty z listy masz odhaczone. ${featured.is_overdue ? 'Uwaga – termin minął' : 'Najbliższy termin'}: ${featured.name_pl} (${formatPolishDate(featured.deadline)}).`,
      isOverdue: featured.is_overdue,
      overdueHint: null,
    };
  }

  return {
    text: 'Wszystkie dokumenty z listy masz odhaczone.',
    isOverdue: false,
    overdueHint: null,
  };
}

export function CaseDocuments({
  documents,
  effectiveDate,
}: {
  documents: CaseDocument[];
  effectiveDate: string;
}) {
  const { search } = useLocation();
  const { scenario } = useScenario();
  const [checkedMap, setCheckedMap] = useState<Record<string, boolean>>({});
  const params = DEFAULT_PARAMS;
  const wizardHref = scenario.situation ? `/wizard?situation=${scenario.situation}` : '/wizard';

  if (documents.length === 0) {
    return (
      <div className="plan-tab-content">
        <h2 className="case-paperwork__heading">Dokumenty i terminy</h2>
        <section className="plan-section" aria-labelledby="docs-empty-heading">
          <div className="plan-missing-data" role="status">
            <h3 id="docs-empty-heading" className="plan-section__title">
              Brak dokumentów do złożenia
            </h3>
            <p className="plan-section__lead">
              Dla podanych danych w planie nie wygenerowano wymaganych dokumentów ani wniosków.
              Uzupełnij datę zdarzenia lub dane o ubezpieczeniu, aby ustalić płatnika i listę
              formularzy.
            </p>
            <Link to={wizardHref} className="plan-btn plan-btn--primary">
              Uzupełnij dane ›
            </Link>
          </div>
        </section>

        <nav className="docs-next-nav" aria-label="Następny krok planu">
          <Link to={`/plan/applications${search}`} className="docs-next-link">
            Dalej: Wnioski ›
          </Link>
        </nav>
      </div>
    );
  }

  function toggleDoc(key: string) {
    setCheckedMap((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const nextStep = selectNextStep(documents, checkedMap);
  const parentsFiling = resolveParentsFiling(documents, params);
  const groups = groupCaseDocuments(documents, params);
  const hasPregnancySickness = documents.some((doc) => PREGNANCY_SICKNESS_IDS.has(doc.id));
  const totalCount = documents.length;
  const completedCount = documents.filter((doc) => checkedMap[documentKey(doc)]).length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  const deadlineDocs = documents
    .filter((doc): doc is CaseDocument & { deadline: string } => doc.deadline !== null)
    .sort((a, b) => a.deadline.localeCompare(b.deadline));
  const overdueDocs = deadlineDocs.filter((doc) => doc.is_overdue);
  const featuredDeadline =
    deadlineDocs.find((doc) => !doc.is_overdue) ?? deadlineDocs[deadlineDocs.length - 1] ?? null;
  const remainingDeadlines = featuredDeadline
    ? deadlineDocs.filter((doc) => doc !== featuredDeadline)
    : [];
  const multipleParentsInAttachments =
    new Set(documents.filter((doc) => ATTACHMENT_IDS.has(doc.id)).map((doc) => doc.parent_role))
      .size > 1;

  return (
    <div className="plan-tab-content">
      <h2 className="case-paperwork__heading">Dokumenty i terminy</h2>

      <section
        className={nextStep.isOverdue ? 'docs-answer docs-answer--overdue' : 'docs-answer'}
        aria-labelledby="docs-next-step-heading"
      >
        <div className="docs-answer__head">
          <h3 id="docs-next-step-heading" className="docs-answer__eyebrow">
            Co zrobić teraz
          </h3>
          {nextStep.isOverdue && <span className="plan-badge plan-badge--no">Termin minął</span>}
        </div>

        <p className="docs-answer__step">{nextStep.text}</p>

        {nextStep.overdueHint && (
          <p className="docs-answer__overdue-hint" role="alert">
            {nextStep.overdueHint}
          </p>
        )}

        <dl className="docs-answer__payers">
          {parentsFiling.map((info) => (
            <div key={info.role} className="docs-answer__payer-row">
              <dt>{info.label}</dt>
              <dd>{info.summary}</dd>
              <dd className="docs-answer__payer-method">{info.method}</dd>
            </div>
          ))}
        </dl>

        <details className="docs-details">
          <summary className="docs-details__summary">
            Dlaczego ten płatnik i jak złożyć dokumenty?
          </summary>
          <div className="docs-details__body">
            Zasiłek wypłaca pracodawca lub zleceniodawca, jeśli zgłasza do ubezpieczenia chorobowego
            powyżej {params.payerThresholdInsuredCount} osób według stanu na 30 listopada
            poprzedniego roku (art. 61 ustawy zasiłkowej). W pozostałych przypadkach oraz przy
            działalności gospodarczej (JDG) zasiłek wypłaca ZUS – dokumenty złożysz elektronicznie
            przez PUE/eZUS (symulacja) lub papierowo. Płatnik jest ustalany osobno dla każdego
            rodzica.
          </div>
        </details>
      </section>

      <section className="plan-section" aria-labelledby="docs-checklist-heading">
        <div className="docs-checklist-header">
          <h3 id="docs-checklist-heading" className="plan-section__title">
            Lista dokumentów
          </h3>
          <span className="plan-badge plan-badge--navy" aria-live="polite">
            Skompletowano: {completedCount} z {totalCount} ({progressPercent}%)
          </span>
        </div>

        <div className="docs-progress" aria-label="Postęp kompletowania dokumentów">
          <div
            className="docs-progress__track"
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Skompletowano ${completedCount} z ${totalCount} dokumentów (${progressPercent}%)`}
          >
            <div className="docs-progress__fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        <div className="docs-groups">
          {groups.map((group) => (
            <div key={group.id} className="docs-group">
              <div className="docs-group__header">
                <h4 className="docs-group__title">{group.title}</h4>
                {group.description && <p className="docs-group__desc">{group.description}</p>}
              </div>

              <ul className="docs-compact-list" role="list">
                {group.documents.map((doc) => {
                  const key = documentKey(doc);
                  const isChecked = Boolean(checkedMap[key]);
                  const showOverdue = !isChecked && doc.is_overdue;
                  const mandateEntitled = isMandateEntitledRole(documents, doc.parent_role);
                  return (
                    <li
                      key={key}
                      className={
                        isChecked
                          ? 'docs-compact-item docs-compact-item--checked'
                          : showOverdue
                            ? 'docs-compact-item docs-compact-item--overdue'
                            : 'docs-compact-item'
                      }
                    >
                      <label className="docs-compact-item__main">
                        <input
                          type="checkbox"
                          className="docs-compact-item__checkbox"
                          checked={isChecked}
                          onChange={() => toggleDoc(key)}
                        />
                        <span className="docs-compact-item__content">
                          <span className="docs-compact-item__top">
                            <span className="docs-compact-item__name">
                              {doc.name_pl}
                              {group.id === 'attachments' && multipleParentsInAttachments && (
                                <span className="case-doc__parent-tag">
                                  {' '}
                                  ({parentLabels[doc.parent_role]})
                                </span>
                              )}
                            </span>
                            <span className={submitBadgeClass(doc)}>
                              {formatSubmitBadge(doc, mandateEntitled)}
                            </span>
                          </span>

                          {(doc.start_date || doc.deadline) && (
                            <span className="docs-compact-item__meta">
                              {doc.start_date && doc.end_date && (
                                <span>
                                  Okres:{' '}
                                  <strong>
                                    {formatPolishDate(doc.start_date)}–
                                    {formatPolishDate(doc.end_date)}
                                  </strong>
                                </span>
                              )}
                              {doc.deadline && (
                                <span>
                                  Do kiedy:{' '}
                                  <strong>
                                    <time dateTime={doc.deadline}>
                                      {formatPolishDate(doc.deadline)}
                                    </time>
                                  </strong>
                                  {showOverdue && (
                                    <strong className="docs-compact-item__overdue">
                                      {' '}
                                      · Termin minął
                                    </strong>
                                  )}
                                </span>
                              )}
                            </span>
                          )}

                          <span className="docs-compact-item__method">
                            {formatSubmitMethod(doc, mandateEntitled)}
                          </span>
                        </span>
                      </label>

                      <div className="docs-compact-item__details-wrap">
                        <details className="docs-details">
                          <summary className="docs-details__summary">
                            Szczegóły i podstawa prawna
                          </summary>
                          <div className="docs-details__body">
                            <p>
                              {describeDocumentDetails(doc, effectiveDate, params, mandateEntitled)}
                            </p>
                            <p className="docs-details__sub">
                              <strong>Podstawa prawna:</strong> {doc.legal_basis}
                            </p>
                          </div>
                        </details>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="docs-checklist-actions">
          <button
            type="button"
            className="plan-btn plan-btn--secondary"
            onClick={() => window.print()}
          >
            Drukuj checklistę
          </button>
          <button
            type="button"
            className="plan-btn plan-btn--ghost"
            onClick={() => setCheckedMap({})}
            disabled={completedCount === 0}
          >
            Wyczyść zaznaczenia
          </button>
        </div>

        <details className="docs-details docs-reform-details">
          <summary className="docs-details__summary">
            Zmiany w formularzach ZUS (od {formatPolishDate(effectiveDate)})
          </summary>
          <div className="docs-details__body">
            <p>
              Od {formatPolishDate(effectiveDate)} r. formularze ZUR i ZAO zostały włączone do
              jednego wniosku ZUS ZAM, a druk Z-3b został zlikwidowany.
            </p>
            <p className="docs-details__sub">
              Gdy zasiłek wypłaca ZUS: pracodawca składa Z-3 (oraz ZAS-12 wyłącznie na dalszy okres
              zasiłku chorobowego), zleceniodawca składa Z-3a, a osoba na JDG składa ZAS-53 (zasiłek
              chorobowy) lub ZUS ZAM (zasiłek macierzyński).
            </p>
          </div>
        </details>

        {!hasPregnancySickness && (
          <details className="docs-details docs-reform-details">
            <summary className="docs-details__summary">
              Zwolnienie lekarskie w ciąży (e-ZLA, kod „B”)
            </summary>
            <div className="docs-details__body">
              <p>
                Jeśli lekarz wystawi zwolnienie w ciąży, elektroniczne zaświadczenie e-ZLA z kodem
                literowym „B” ({formatRate(params.rates.sicknessPregnancy)} podstawy) trafia
                bezpośrednio do ZUS i na profil płatnika na PUE/eZUS.
              </p>
              <p className="docs-details__sub">
                Pracownik informuje pracodawcę o nieobecności. Gdy płatnik nie wypłaca zasiłków (do{' '}
                {params.payerThresholdInsuredCount} ubezpieczonych), pracodawca przekazuje do ZUS
                zaświadczenie Z-3 (a ZAS-12 wyłącznie na dalszy okres zasiłku chorobowego),
                zleceniodawca przekazuje Z-3a, a osoba prowadząca JDG składa do ZUS wniosek ZAS-53.
              </p>
            </div>
          </details>
        )}
      </section>

      <section className="plan-section" aria-labelledby="docs-deadlines-heading">
        <h3 id="docs-deadlines-heading" className="plan-section__title">
          Kluczowe terminy
        </h3>

        {!featuredDeadline ? (
          <div className="plan-callout">
            Dla bieżących dokumentów w planie nie wyznaczono odrębnych dat granicznych. Złóż
            wymagane wnioski przed planowanym rozpoczęciem świadczenia.
          </div>
        ) : (
          <>
            {overdueDocs.length > 0 && (
              <div className="plan-callout plan-callout--warning docs-overdue-alert" role="alert">
                <p className="plan-callout__title">
                  {overdueDocs.length === 1
                    ? 'Termin minął dla 1 dokumentu'
                    : `Termin minął dla ${overdueDocs.length} dokumentów`}
                </p>
                <ul className="docs-overdue-alert__list">
                  {overdueDocs.map((doc) => (
                    <li key={`overdue-${documentKey(doc)}`}>
                      <strong>{formatPolishDate(doc.deadline)}</strong> – {doc.name_pl} (
                      {parentLabels[doc.parent_role]})
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div
              className={
                featuredDeadline.is_overdue
                  ? 'docs-next-deadline docs-next-deadline--overdue'
                  : 'docs-next-deadline'
              }
            >
              <div className="docs-next-deadline__top">
                <span
                  className={
                    featuredDeadline.is_overdue
                      ? 'plan-badge plan-badge--no'
                      : 'plan-badge plan-badge--yes'
                  }
                >
                  {featuredDeadline.is_overdue ? 'Termin minął' : 'Najbliższy termin'}
                </span>
                <span className="docs-next-deadline__date">
                  <time dateTime={featuredDeadline.deadline}>
                    {formatPolishDate(featuredDeadline.deadline)}
                  </time>
                </span>
              </div>
              <p className="docs-next-deadline__label">
                {featuredDeadline.name_pl} ({parentLabels[featuredDeadline.parent_role]})
              </p>
            </div>

            {remainingDeadlines.length > 0 && (
              <ul className="docs-deadlines-list" role="list">
                {remainingDeadlines.map((doc) => (
                  <li
                    key={`deadline-${documentKey(doc)}`}
                    className={
                      doc.is_overdue
                        ? 'docs-deadlines-list__item docs-deadlines-list__item--overdue'
                        : 'docs-deadlines-list__item'
                    }
                  >
                    <span className="docs-deadlines-list__date">
                      <time dateTime={doc.deadline}>{formatPolishDate(doc.deadline)}</time>
                      {doc.is_overdue && (
                        <span className="docs-compact-item__overdue"> (Termin minął)</span>
                      )}
                    </span>
                    <span className="docs-deadlines-list__label">
                      {doc.name_pl} ({parentLabels[doc.parent_role]})
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="docs-plan-assumption" role="note">
              <p className="docs-plan-assumption__text">
                Terminy wynikają bezpośrednio z dat ustawionych w Twoim planie urlopów (
                {params.applicationDeadlinesDays.parentalLeave} dni przed urlopem rodzicielskim i{' '}
                {params.applicationDeadlinesDays.paternityLeave} dni przed urlopem ojcowskim).
              </p>
              <Link to={`/plan/leave-plan${search}`} className="docs-plan-assumption__link">
                Zmień podział w sekcji Plan urlopów ›
              </Link>
            </div>

            <details className="docs-details docs-legal-details">
              <summary className="docs-details__summary">Podstawa prawna terminów</summary>
              <div className="docs-details__body">
                <ul className="docs-legal-list">
                  {deadlineDocs.map((doc) => (
                    <li key={`legal-${documentKey(doc)}`}>
                      <strong>{formatPolishDate(doc.deadline)}</strong> – {doc.name_pl}:{' '}
                      {doc.legal_basis}
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          </>
        )}
      </section>

      <nav className="docs-next-nav" aria-label="Następny krok planu">
        <Link
          to={`/plan/applications${search}`}
          className="plan-btn plan-btn--primary docs-next-cta"
        >
          Dalej: Wnioski ›
        </Link>
      </nav>
    </div>
  );
}

/* ---------- Wnioski ---------- */

type PersonalFieldKey = 'name' | 'pesel' | 'bank';

const PERSONAL_FIELD_LABELS: Record<PersonalFieldKey, string> = {
  name: 'imię i nazwisko',
  pesel: 'PESEL',
  bank: 'numer rachunku bankowego',
};

const APPLICATION_IDS = new Set([
  'ZAM',
  'ZAS-53',
  'USC_COPY',
  'COMBINED_RATE',
  'TAKEOVER',
  'ADOPTION_LEAVE',
]);

function isActionableApplication(doc: CaseDocument): boolean {
  return APPLICATION_IDS.has(doc.id) || doc.id.endsWith('_REQUEST');
}

function applicationCode(doc: CaseDocument): string {
  if (doc.id === 'ZAM') return 'ZUS ZAM';
  if (doc.id === 'ZAS-53') return 'ZUS ZAS-53';
  if (doc.id === 'USC_COPY') return 'USC / AKT';
  if (doc.id === 'COMBINED_RATE') {
    return `WNIOSEK-${formatRate(DEFAULT_PARAMS.rates.combined)}`;
  }
  return 'WNIOSEK-KP';
}

function requiredFieldsForApplication(doc: CaseDocument): PersonalFieldKey[] {
  if (doc.id === 'USC_COPY') return ['name'];
  if (doc.id === 'ZAM' || doc.id === 'ZAS-53') return ['name', 'pesel', 'bank'];
  return ['name', 'pesel'];
}

function recipientShort(submitTo: CaseDocument['submit_to']): string {
  if (submitTo === 'EMPLOYER') return 'Pracodawca';
  if (submitTo === 'ZUS') return 'ZUS (PUE / eZUS)';
  if (submitTo === 'USC') return 'Urząd Stanu Cywilnego';
  return 'Do ustalenia';
}

function recipientFull(submitTo: CaseDocument['submit_to']): string {
  if (submitTo === 'EMPLOYER') return 'Pracodawca (płatnik składek)';
  if (submitTo === 'ZUS') return 'Zakład Ubezpieczeń Społecznych (PUE / eZUS)';
  if (submitTo === 'USC') return 'Urząd Stanu Cywilnego (RSC / gov.pl)';
  return 'Do ustalenia';
}

function applicationChannel(doc: CaseDocument): string {
  if (doc.submit_to === 'EMPLOYER') return 'Dział kadr / system pracodawcy (symulacja)';
  if (doc.submit_to === 'ZUS') return 'Wysyłka elektroniczna przez PUE / eZUS (symulacja)';
  if (doc.submit_to === 'USC') return 'Rejestr Stanu Cywilnego / mObywatel (symulacja)';
  return 'Uzupełnij dane płatnika, aby określić kanał złożenia';
}

function applicationLegalNote(doc: CaseDocument): string {
  if (doc.submit_to === 'EMPLOYER' && doc.id !== 'ZAM') {
    return `${doc.legal_basis}; Rozporządzenie MRPiPS z 11.03.2025 r. (Dz.U. z 2025 r. poz. 322)`;
  }
  if (doc.id === 'ZAM' || doc.id === 'ZAS-53') {
    return `${doc.legal_basis}; Rozporządzenie MRPiPS z 27.09.2026 r. (Dz.U. z 2026 r. poz. 1316)`;
  }
  return doc.legal_basis;
}

function attachmentsForApplication(doc: CaseDocument, allDocuments: CaseDocument[]): string {
  const hasHospital = allDocuments.some((item) => item.id === 'HOSPITAL_CERTIFICATE');
  const hasZaZyciem = allDocuments.some((item) => item.id === 'ZA_ZYCIEM_CERTIFICATE');
  const hasAdoption = allDocuments.some((item) => item.id === 'ADOPTION_ORDER');

  if (doc.id === 'USC_COPY') {
    return 'Brak załączników – wniosek o odpis skrócony do celów zasiłkowych (bez opłaty skarbowej).';
  }
  if (doc.id === 'SUPPLEMENTARY_REQUEST') {
    return 'Zaświadczenie ze szpitala o okresie hospitalizacji, tygodniu ciąży i masie urodzeniowej dziecka (poz. 322).';
  }
  if (doc.id === 'PARENTAL_REQUEST') {
    const items = [
      'skrócony odpis aktu urodzenia dziecka',
      'oświadczenie o liczbie wykorzystanych części i braku jednoczesnego przekroczenia puli przez drugiego rodzica (poz. 322)',
    ];
    if (hasZaZyciem) items.push('zaświadczenie lekarskie „Za życiem” (art. 4 ust. 3)');
    return items.join('; ') + '.';
  }
  if (doc.id === 'PATERNITY_REQUEST') {
    return 'Skrócony odpis aktu urodzenia dziecka oraz oświadczenie ojca o niewykorzystaniu pełnego wymiaru urlopu ojcowskiego (poz. 322).';
  }
  if (doc.id === 'TAKEOVER') {
    return 'Skrócony odpis aktu urodzenia dziecka, kopia wniosku/rezygnacji matki lub dokument potwierdzający podstawę wcześniejszego przejęcia (poz. 322).';
  }
  if (doc.id === 'ADOPTION_LEAVE') {
    return 'Oświadczenie o dacie przyjęcia dziecka oraz zaświadczenie sądu o wystąpieniu o przysposobienie albo orzeczenie o rodzinie zastępczej (poz. 322).';
  }
  if (doc.id === 'COMBINED_RATE') {
    const items = ['skrócony odpis aktu urodzenia dziecka'];
    if (hasZaZyciem) items.push('zaświadczenie lekarskie „Za życiem”');
    return items.join('; ') + '.';
  }
  if (doc.id === 'ZAS-53') {
    return 'Elektroniczne zwolnienie lekarskie e-ZLA z kodem „B” (trafia do ZUS automatycznie).';
  }
  const items = [
    hasAdoption ? 'dokument przyjęcia dziecka na wychowanie' : 'skrócony odpis aktu urodzenia',
  ];
  if (hasHospital) items.push('zaświadczenie ze szpitala (dla urlopu uzupełniającego)');
  if (hasZaZyciem) items.push('zaświadczenie „Za życiem”');
  return items.join('; ') + '.';
}

function formatDurationNote(doc: CaseDocument, daysPerWeek: number): string | null {
  if (!doc.start_date || !doc.end_date) return null;
  const days = diffDaysIso(doc.start_date, doc.end_date) + 1;
  if (days <= 0) return null;
  if (days % daysPerWeek === 0) {
    const weeks = days / daysPerWeek;
    return `${weeks} tyg. (${days} dni)`;
  }
  return `${days} dni`;
}

interface SentReceipt {
  referenceNumber: string;
  sentAt: string;
  recipient: string;
  applicantName: string;
}

interface PreviewModalState {
  title: string;
  recipient: string;
  fields: { label: string; value: string }[];
}

export function CaseApplications({ documents }: { documents: CaseDocument[] }) {
  const { search } = useLocation();
  const { scenario } = useScenario();
  const [name, setName] = useState('');
  const [pesel, setPesel] = useState('');
  const [bank, setBank] = useState('');
  const [receipts, setReceipts] = useState<Record<string, SentReceipt>>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [invalidFields, setInvalidFields] = useState<PersonalFieldKey[]>([]);
  const [previewModal, setPreviewModal] = useState<PreviewModalState | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  const peselRef = useRef<HTMLInputElement>(null);
  const bankRef = useRef<HTMLInputElement>(null);

  const forms = documents.filter(isActionableApplication);
  const wizardHref = scenario.situation ? `/wizard?situation=${scenario.situation}` : '/wizard';

  if (forms.length === 0) {
    return (
      <div className="plan-tab-content">
        <h2 className="case-paperwork__heading">Wnioski</h2>
        <section className="plan-section" aria-labelledby="apps-empty-heading">
          <div className="plan-missing-data" role="status">
            <h3 id="apps-empty-heading" className="plan-section__title">
              Brak wniosków do przygotowania
            </h3>
            <p className="plan-section__lead">
              Ustal okresy w planie lub uzupełnij dane w kreatorze, aby przygotować wzory wniosków
              do pracodawcy, ZUS i Urzędu Stanu Cywilnego.
            </p>
            <Link to={wizardHref} className="plan-btn plan-btn--primary">
              Uzupełnij dane ›
            </Link>
          </div>
        </section>

        <nav className="apps-next-nav" aria-label="Następny krok planu">
          <Link to={`/plan/support${search}`} className="apps-next-link">
            Dalej: Wsparcie ›
          </Link>
        </nav>
      </div>
    );
  }

  const trimmedName = name.trim();
  const trimmedPesel = pesel.trim();
  const trimmedBank = bank.trim();
  const todayIso = todayIsoDate();
  const refYear = todayIso.slice(0, 4);
  const daysPerWeek = DEFAULT_PARAMS.calendar.daysPerWeek;

  function findMissing(required: PersonalFieldKey[]): PersonalFieldKey[] {
    const missing: PersonalFieldKey[] = [];
    if (required.includes('name') && !trimmedName) missing.push('name');
    if (required.includes('pesel') && !trimmedPesel) missing.push('pesel');
    if (required.includes('bank') && !trimmedBank) missing.push('bank');
    return missing;
  }

  function focusFirst(missing: PersonalFieldKey[]) {
    const first = missing[0];
    if (first === 'name') nameRef.current?.focus();
    else if (first === 'pesel') peselRef.current?.focus();
    else if (first === 'bank') bankRef.current?.focus();
  }

  function clearError(field: PersonalFieldKey) {
    if (!invalidFields.includes(field)) return;
    const next = invalidFields.filter((item) => item !== field);
    setInvalidFields(next);
    if (next.length === 0) setValidationError(null);
  }

  function buildFields(doc: CaseDocument): { label: string; value: string; missing?: boolean }[] {
    const required = requiredFieldsForApplication(doc);
    const fields: { label: string; value: string; missing?: boolean }[] = [
      { label: 'Wnioskodawca (rola)', value: parentLabels[doc.parent_role] },
      {
        label: 'Imię i nazwisko',
        value: trimmedName || 'Do uzupełnienia',
        missing: !trimmedName,
      },
    ];
    if (required.includes('pesel')) {
      fields.push({
        label: 'PESEL',
        value: trimmedPesel || 'Do uzupełnienia',
        missing: !trimmedPesel,
      });
    }
    if (required.includes('bank')) {
      fields.push({
        label: 'Numer rachunku do wypłaty',
        value: trimmedBank || 'Do uzupełnienia',
        missing: !trimmedBank,
      });
    }
    fields.push({ label: 'Adresat', value: recipientFull(doc.submit_to) });
    if (doc.start_date && doc.end_date) {
      const duration = formatDurationNote(doc, daysPerWeek);
      fields.push({
        label: 'Wnioskowany okres',
        value: `${formatPolishDate(doc.start_date)}–${formatPolishDate(doc.end_date)}${duration ? ` (${duration})` : ''}`,
      });
    }
    if (doc.deadline) {
      fields.push({
        label: 'Termin złożenia',
        value: `${formatPolishDate(doc.deadline)}${doc.is_overdue ? ' (Termin minął)' : ''}`,
      });
    }
    fields.push({
      label: 'Załączniki',
      value: attachmentsForApplication(doc, documents),
    });
    return fields;
  }

  function sendOne(doc: CaseDocument) {
    if (!doc.submit_to) return;
    const code = applicationCode(doc);
    const missing = findMissing(requiredFieldsForApplication(doc));
    if (missing.length > 0) {
      setInvalidFields(missing);
      setStatusMessage(null);
      setValidationError(
        `Aby wysłać wniosek ${code}, uzupełnij dane osobowe: ${missing
          .map((item) => PERSONAL_FIELD_LABELS[item])
          .join(', ')}.`,
      );
      focusFirst(missing);
      return;
    }

    const key = documentKey(doc);
    const cleanCode = code.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    const seq = String(Object.keys(receipts).length + 1).padStart(3, '0');
    const ref = `UPO-${refYear}-${cleanCode}-${seq}`;
    const recipient = recipientFull(doc.submit_to);

    setInvalidFields([]);
    setValidationError(null);
    setReceipts((prev) => ({
      ...prev,
      [key]: {
        referenceNumber: ref,
        sentAt: formatPolishDate(todayIso),
        recipient,
        applicantName: trimmedName,
      },
    }));
    setStatusMessage(`Zakończono symulację złożenia wniosku ${code} do: ${recipient} (${ref}).`);
  }

  function sendAll() {
    const pending = forms.filter((doc) => doc.submit_to !== null && !receipts[documentKey(doc)]);
    if (pending.length === 0) return;

    const requiredSet = new Set<PersonalFieldKey>();
    for (const doc of pending) {
      for (const field of requiredFieldsForApplication(doc)) {
        requiredSet.add(field);
      }
    }
    const missing = findMissing(Array.from(requiredSet));
    if (missing.length > 0) {
      setInvalidFields(missing);
      setStatusMessage(null);
      setValidationError(
        `Aby wysłać wszystkie wnioski, uzupełnij dane osobowe: ${missing
          .map((item) => PERSONAL_FIELD_LABELS[item])
          .join(', ')}.`,
      );
      focusFirst(missing);
      return;
    }

    const nextReceipts: Record<string, SentReceipt> = { ...receipts };
    let seq = Object.keys(receipts).length + 1;
    for (const doc of pending) {
      const code = applicationCode(doc);
      const cleanCode = code.replace(/[^A-Z0-9]/gi, '').toUpperCase();
      nextReceipts[documentKey(doc)] = {
        referenceNumber: `UPO-${refYear}-${cleanCode}-${String(seq).padStart(3, '0')}`,
        sentAt: formatPolishDate(todayIso),
        recipient: recipientFull(doc.submit_to),
        applicantName: trimmedName,
      };
      seq += 1;
    }

    const skippedCount = forms.filter((doc) => doc.submit_to === null).length;
    setInvalidFields([]);
    setValidationError(null);
    setReceipts(nextReceipts);
    setStatusMessage(
      skippedCount > 0
        ? `Zakończono symulację wysyłki ${pending.length} wniosków. Pozostałe (${skippedCount}) wymagają ustalenia płatnika.`
        : `Zakończono symulację wysyłki pakietu ${pending.length} wniosków.`,
    );
  }

  const sendableForms = forms.filter((doc) => doc.submit_to !== null);
  const allSent =
    sendableForms.length > 0 && sendableForms.every((doc) => Boolean(receipts[documentKey(doc)]));

  return (
    <div className="plan-tab-content">
      <h2 className="case-paperwork__heading">Wnioski</h2>

      <section className="apps-intro" aria-labelledby="apps-intro-heading">
        <div className="apps-intro__top">
          <div className="apps-intro__copy">
            <h3 id="apps-intro-heading" className="plan-section__title">
              Gotowe wnioski do wysłania
            </h3>
            <p className="apps-intro__lead">
              Na podstawie Twojego planu przygotowaliśmy listę wymaganych wniosków. Uzupełnij dane
              osobowe poniżej i wyślij je razem lub pojedynczo (wysyłka jest symulowana).
            </p>
          </div>
          <button
            type="button"
            className="plan-btn plan-btn--primary apps-intro__cta"
            disabled={allSent || sendableForms.length === 0}
            onClick={sendAll}
          >
            {allSent ? 'Wszystkie wnioski wysłane' : `Wyślij wszystkie (${sendableForms.length}) ›`}
          </button>
        </div>
      </section>

      {statusMessage && (
        <div className="plan-callout plan-callout--success" role="status">
          <strong>Potwierdzenie wysyłki (symulacja):</strong> {statusMessage}
        </div>
      )}

      <section className="plan-section" aria-labelledby="apps-list-heading">
        <h3 id="apps-list-heading" className="plan-section__title">
          Lista wniosków ({forms.length})
        </h3>

        <div className="apps-compact-list">
          {forms.map((doc) => {
            const key = documentKey(doc);
            const code = applicationCode(doc);
            const receipt = receipts[key];
            const fields = buildFields(doc);
            return (
              <article key={key} className={receipt ? 'apps-card apps-card--sent' : 'apps-card'}>
                <div className="apps-card__header">
                  <div className="apps-card__info">
                    <div className="apps-card__badges">
                      <span className="plan-badge plan-badge--code">{code}</span>
                      <span className="plan-badge plan-badge--navy">
                        {parentLabels[doc.parent_role]}
                      </span>
                      <span
                        className={
                          receipt ? 'plan-badge plan-badge--yes' : 'plan-badge plan-badge--navy'
                        }
                      >
                        {receipt ? 'Wysłano' : doc.submit_to ? 'Do wysłania' : 'Uzupełnij płatnika'}
                      </span>
                    </div>
                    <h4 className="apps-card__title">{doc.name_pl}</h4>
                    <p className="apps-card__recipient">
                      Do: <strong>{recipientShort(doc.submit_to)}</strong>
                      {doc.start_date && doc.end_date && (
                        <>
                          {' · '}Okres:{' '}
                          <strong>
                            {formatPolishDate(doc.start_date)}–{formatPolishDate(doc.end_date)}
                          </strong>
                        </>
                      )}
                      {doc.deadline && (
                        <>
                          {' · '}Do:{' '}
                          <strong>
                            <time dateTime={doc.deadline}>{formatPolishDate(doc.deadline)}</time>
                          </strong>
                          {doc.is_overdue && (
                            <strong className="docs-compact-item__overdue"> · Termin minął</strong>
                          )}
                        </>
                      )}
                    </p>
                  </div>

                  {!receipt && doc.submit_to && (
                    <button
                      type="button"
                      className="plan-btn plan-btn--secondary apps-card__action"
                      aria-label={`Wyślij ${doc.name_pl} (${parentLabels[doc.parent_role]})`}
                      onClick={() => sendOne(doc)}
                    >
                      Wyślij ›
                    </button>
                  )}
                </div>

                {receipt && (
                  <div
                    className="apps-card__receipt"
                    role="region"
                    aria-label={`Potwierdzenie wysłania ${code}`}
                  >
                    <strong className="apps-card__receipt-title">
                      UPO – Potwierdzenie złożenia ({receipt.referenceNumber})
                    </strong>
                    <p>
                      Odbiorca: <strong>{receipt.recipient}</strong> · Nadawca:{' '}
                      <strong>{receipt.applicantName}</strong> · Data: {receipt.sentAt}
                    </p>
                  </div>
                )}

                <details className="apps-preview">
                  <summary className="apps-preview__summary">Podgląd wniosku</summary>
                  <div className="apps-preview__body">
                    <dl className="apps-preview__fields">
                      {fields.map((field) => (
                        <div key={field.label}>
                          <dt>{field.label}</dt>
                          <dd className={field.missing ? 'apps-preview__empty-value' : undefined}>
                            {field.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <p className="plan-legal">Kanał: {applicationChannel(doc)}</p>
                    <p className="plan-legal">Podstawa prawna: {applicationLegalNote(doc)}</p>
                    <div>
                      <button
                        type="button"
                        className="plan-btn plan-btn--secondary"
                        onClick={() =>
                          setPreviewModal({
                            title: `${doc.name_pl} (${parentLabels[doc.parent_role]})`,
                            recipient: recipientFull(doc.submit_to),
                            fields: fields.map(({ label, value }) => ({ label, value })),
                          })
                        }
                      >
                        Drukuj lub zapisz PDF
                      </button>
                    </div>
                  </div>
                </details>
              </article>
            );
          })}
        </div>
      </section>

      <section className="plan-section" aria-labelledby="apps-personal-heading">
        <h3 id="apps-personal-heading" className="plan-section__title">
          Dane osobowe do wniosków
        </h3>
        <p className="apps-personal-note">
          Dane osobowe uzupełnisz po zalogowaniu przez mObywatela (symulacja) albo wpiszesz ręcznie
          – nie wysyłamy ich na serwer.
        </p>

        {validationError && (
          <div className="plan-callout plan-callout--warning apps-validation-alert" role="alert">
            {validationError}
          </div>
        )}

        <div className="plan-controls__grid">
          <label className="plan-field">
            <span className="plan-field__label">Imię i nazwisko</span>
            <input
              ref={nameRef}
              type="text"
              autoComplete="off"
              className={
                invalidFields.includes('name')
                  ? 'plan-field__input apps-field-error'
                  : 'plan-field__input'
              }
              placeholder="Wpisz imię i nazwisko"
              aria-invalid={invalidFields.includes('name') || undefined}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                clearError('name');
              }}
            />
          </label>

          <label className="plan-field">
            <span className="plan-field__label">PESEL</span>
            <input
              ref={peselRef}
              type="text"
              autoComplete="off"
              inputMode="numeric"
              className={
                invalidFields.includes('pesel')
                  ? 'plan-field__input apps-field-error'
                  : 'plan-field__input'
              }
              placeholder="Wpisz 11-cyfrowy numer PESEL"
              aria-invalid={invalidFields.includes('pesel') || undefined}
              value={pesel}
              onChange={(event) => {
                setPesel(event.target.value);
                clearError('pesel');
              }}
            />
          </label>

          <label className="plan-field">
            <span className="plan-field__label">Numer rachunku</span>
            <input
              ref={bankRef}
              type="text"
              autoComplete="off"
              className={
                invalidFields.includes('bank')
                  ? 'plan-field__input apps-field-error'
                  : 'plan-field__input'
              }
              placeholder="Wpisz 26-cyfrowy numer rachunku"
              aria-invalid={invalidFields.includes('bank') || undefined}
              value={bank}
              onChange={(event) => {
                setBank(event.target.value);
                clearError('bank');
              }}
            />
          </label>
        </div>
      </section>

      <nav className="apps-next-nav" aria-label="Następny krok planu">
        <Link to={`/plan/support${search}`} className="apps-next-link">
          Dalej: Wsparcie ›
        </Link>
      </nav>

      {previewModal && (
        <ApplicationPreview
          title={previewModal.title}
          recipient={previewModal.recipient}
          fields={previewModal.fields}
          onClose={() => setPreviewModal(null)}
        />
      )}
    </div>
  );
}
