import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type {
  ApplicantRole,
  BenefitParams,
  CaseDocument,
  CaseInputs,
  CasePlan,
  CaseRecord,
  EmploymentType,
} from '@shared/types';
import { apiGet } from '../../../api/client';
import { DEFAULT_PARAMS, formatRate } from '../../../app/benefitParams';
import { useScenario } from '../../../app/ScenarioContext';
import { SickLeavePreview } from '../../login/ZusSimulationPanels';
import { parentLabels, roles } from '../caseLabels';
import {
  addDaysIso,
  diffDaysIso,
  formatPolishDate,
  livingChildren,
  todayIsoDate,
} from '../planScenario';
import { ApplicationPreview } from './ApplicationPreview';
import type { ApplicationPdfData, ZamLeave, ZamPeriod } from './pdf/types';
import { leaveApplication } from './leaveApplication';
import { documentKey } from './documentKey';
import { FilingMap, type FilingStep } from './FilingMap';
import { buildMailto, deliveryGuide, filingKind, type DeliveryGuide } from './filingGuide';
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
      return doc.deadline
        ? `Wniosek ojca o przejęcie części urlopu macierzyńskiego składa się co najmniej ${deadlines.fatherTakeoverPart} dni przed planowanym rozpoczęciem.`
        : 'Sprawdź wymagane oświadczenia i załączniki w zakładce Wnioski.';
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
  input = null,
  plan = null,
}: {
  documents: CaseDocument[];
  effectiveDate: string;
  input?: CaseInputs | null;
  plan?: CasePlan | null;
}) {
  const { search } = useLocation();
  const { scenario, authSession } = useScenario();
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

        {authSession && authSession.zusData.sickLeaveCertificates.length > 0 && (
          <section className="plan-section" aria-label="Podgląd zwolnień e-ZLA z ZUS">
            <SickLeavePreview certificates={authSession.zusData.sickLeaveCertificates} />
          </section>
        )}

        <nav className="docs-next-nav" aria-label="Następny krok planu">
          <Link to={`/plan/applications${search}`} className="docs-next-link">
            Dalej: Wnioski ›
          </Link>
        </nav>
      </div>
    );
  }

  const nextStep = selectNextStep(documents, {});
  const parentsFiling = resolveParentsFiling(documents, params);
  const hasPregnancySickness = documents.some((doc) => PREGNANCY_SICKNESS_IDS.has(doc.id));
  const activeRoles = roles.filter((role) => documents.some((doc) => doc.parent_role === role));
  // Tytuły na mapie są te same co w zakładce Wnioski – jedno źródło nazw dokumentów.
  const applicationItems = buildApplications(documents, input, plan, params);
  const filingSteps: FilingStep[] = documents.map((doc) => {
    const applicationItem = applicationItems.find((item) => item.doc === doc);
    const isApplication = isActionableApplication(doc);
    const mandateEntitled = isMandateEntitledRole(documents, doc.parent_role);
    const openParams = new URLSearchParams(search);
    openParams.set('open', documentKey(doc));
    return {
      doc,
      title: applicationItem ? applicationTitle(applicationItem, params) : doc.name_pl,
      who: activeRoles.length > 1 ? parentLabels[doc.parent_role] : null,
      kind: filingKind(doc, isApplication),
      guide: deliveryGuide(doc, mandateEntitled),
      details: describeDocumentDetails(doc, effectiveDate, params, mandateEntitled),
      applicationHref: isApplication ? `/plan/applications?${openParams.toString()}` : null,
    };
  });

  const deadlineDocs = documents
    .filter((doc): doc is CaseDocument & { deadline: string } => doc.deadline !== null)
    .sort((a, b) => a.deadline.localeCompare(b.deadline));
  const overdueDocs = deadlineDocs.filter((doc) => doc.is_overdue);
  const featuredDeadline =
    deadlineDocs.find((doc) => !doc.is_overdue) ?? deadlineDocs[deadlineDocs.length - 1] ?? null;
  const remainingDeadlines = featuredDeadline
    ? deadlineDocs.filter((doc) => doc !== featuredDeadline)
    : [];

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
            Mapa składania dokumentów
          </h3>
        </div>
        <p className="plan-section__lead">
          Idź krok po kroku: co przygotować, gdzie to złożyć i do kiedy. Wnioski wypełnimy danymi z
          Twojego formularza.
        </p>

        {hasPregnancySickness && (
          <div className="plan-callout">
            <p className="plan-callout__title">Zwolnienie lekarskie w ciąży (e-ZLA, kod „B”)</p>
            <p>
              Lekarz przesyła e-ZLA z kodem „B” automatycznie do ZUS i na profil płatnika
              (PUE/eZUS). Gdy płatnik nie wypłaca zasiłków (do {params.payerThresholdInsuredCount}{' '}
              ubezpieczonych), pracodawca przekazuje Z-3 (a ZAS-12 tylko na dalszy okres zasiłku
              chorobowego), zleceniodawca Z-3a, a osoba na JDG składa ZAS-53.
            </p>
          </div>
        )}

        <FilingMap
          steps={filingSteps}
          storageKey={`zus.filing.done.${new URLSearchParams(search).get('case') ?? 'scenariusz'}`}
        />

        <div className="docs-checklist-actions">
          <button
            type="button"
            className="plan-btn plan-btn--secondary"
            onClick={() => window.print()}
          >
            Drukuj listę dokumentów
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

      {authSession && authSession.zusData.sickLeaveCertificates.length > 0 && (
        <section className="plan-section" aria-label="Podgląd zwolnień e-ZLA z ZUS">
          <SickLeavePreview certificates={authSession.zusData.sickLeaveCertificates} />
        </section>
      )}

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

type PersonalFieldKey = 'name' | 'pesel' | 'birthDate' | 'bank';

const PERSONAL_FIELD_LABELS: Record<PersonalFieldKey, string> = {
  name: 'Imię i nazwisko',
  pesel: 'PESEL',
  birthDate: 'Data urodzenia',
  bank: 'Numer rachunku',
};

/** Cyfry z pola: ignoruje spacje, myślniki i prefiks „PL” (numery rachunków zwykle są zapisywane z odstępami). */
const digitsOnly = (value: string) => value.replace(/^\s*PL/i, '').replace(/[\s-]/g, '');

function isPersonalValueValid(field: PersonalFieldKey, rawValue: string): boolean {
  const value = rawValue.trim();
  if (field === 'pesel') return /^\d{11}$/.test(digitsOnly(value));
  if (field === 'bank') return /^\d{26}$/.test(digitsOnly(value));
  return !!value;
}

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

interface ParentApplicationContext {
  employmentType: EmploymentType | null;
  isEmployee: boolean;
  isNonEmployee: boolean;
  hasZ3: boolean;
  hasZ3a: boolean;
}

interface ApplicationItem {
  key: string;
  doc: CaseDocument;
  parentCtx: ParentApplicationContext;
  sharedWithBothParents: boolean;
  startDate: string | null;
  endDate: string | null;
  partNumber: number | null;
  partTotal: number;
  workFraction: number;
  workExtensionStart: string | null;
  workExtensionEnd: string | null;
  workExtensionDays: number;
  stillbirthOnly: boolean;
  relatedParentalRange: { start: string; end: string; weeksLabel: string | null } | null;
}

function resolveParentApplicationContext(
  role: ApplicantRole,
  documents: CaseDocument[],
  input: CaseInputs | null,
): ParentApplicationContext {
  const roleDocs = documents.filter((doc) => doc.parent_role === role);
  const hasZ3 = roleDocs.some((doc) => doc.id === 'Z-3');
  const hasZ3a = roleDocs.some((doc) => doc.id === 'Z-3a');

  const person = input ? (role === input.applicant_role ? input : input.other_parent) : undefined;
  let employmentType: EmploymentType | null = person ? person.employment_type : null;

  if (!employmentType) {
    if (hasZ3a) employmentType = 'ZLECENIE';
    else if (roleDocs.some((doc) => doc.id === 'ZAS-53')) employmentType = 'B2B';
    else if (hasZ3 || roleDocs.some((doc) => doc.id === 'ZAS-12' || doc.id === 'ADOPTION_LEAVE')) {
      employmentType = 'UOP';
    } else if (
      roleDocs.some(
        (doc) => doc.submit_to === 'EMPLOYER' && doc.id !== 'e-ZLA' && doc.id !== 'USC_COPY',
      )
    ) {
      employmentType = 'UOP';
    }
  }

  const hasNonEmployeeDestination = roleDocs.some(
    (doc) =>
      doc.submit_to === 'ZUS' &&
      doc.id !== 'Z-3' &&
      doc.id !== 'Z-3a' &&
      doc.id !== 'ZAS-12' &&
      doc.id !== 'e-ZLA',
  );
  const isEmployee = employmentType === 'UOP';
  const isNonEmployee =
    employmentType === 'ZLECENIE' ||
    employmentType === 'B2B' ||
    (!isEmployee && hasNonEmployeeDestination);

  return { employmentType, isEmployee, isNonEmployee, hasZ3, hasZ3a };
}

function formatDurationRange(
  startDate: string | null,
  endDate: string | null,
  daysPerWeek: number,
): string | null {
  if (!startDate || !endDate) return null;
  const days = diffDaysIso(startDate, endDate) + 1;
  if (days <= 0) return null;
  if (days % daysPerWeek === 0) {
    const weeks = days / daysPerWeek;
    return `${weeks} tyg. (${days} dni)`;
  }
  return `${days} dni`;
}

function formatWorkFraction(fraction: number): string {
  const percent = Math.round(fraction * 100);
  if (Math.abs(fraction - 0.5) < 0.001) return `1/2 etatu (${percent}%)`;
  if (Math.abs(fraction - 0.25) < 0.001) return `1/4 etatu (${percent}%)`;
  if (Math.abs(fraction - 0.2) < 0.001) return `1/5 etatu (${percent}%)`;
  if (Math.abs(fraction - 0.4) < 0.001) return `2/5 etatu (${percent}%)`;
  if (Math.abs(fraction - 0.3) < 0.001) return `3/10 etatu (${percent}%)`;
  return `${percent}% etatu`;
}

function resolveWorkFraction(
  doc: CaseDocument,
  input: CaseInputs | null,
  plan: CasePlan | null,
  isEmployee: boolean,
): number {
  if (!isEmployee || doc.id !== 'PARENTAL_REQUEST') return 0;
  if (plan && doc.start_date) {
    const matched = plan.outcome.periods.find(
      (period) =>
        !period.denied &&
        period.parent_role === doc.parent_role &&
        period.start_date === doc.start_date &&
        (period.leave_type === 'PARENTAL' || period.leave_type === 'PARENTAL_ZA_ZYCIEM_EXTENSION'),
    );
    if (matched) return matched.work_fraction;
  }
  if (!input) return 0;
  if (input.parental_leave_parts && doc.start_date) {
    const part = input.parental_leave_parts.find(
      (item) =>
        item.start_date === doc.start_date &&
        (item.parent_role ?? input.applicant_role) === doc.parent_role,
    );
    if (part) return part.work_fraction ?? 0;
  }
  if (doc.parent_role === input.applicant_role && input.part_time_work_fraction > 0) {
    return input.part_time_work_fraction;
  }
  return 0;
}

function inferMaternityDatesForZam(
  role: ApplicantRole,
  documents: CaseDocument[],
  input: CaseInputs | null,
  plan: CasePlan | null,
  params: BenefitParams,
): { start: string | null; end: string | null } {
  if (plan) {
    const period = plan.outcome.periods.find(
      (item) =>
        !item.denied &&
        item.parent_role === role &&
        (item.leave_type === 'MATERNITY' || item.leave_type === 'ADOPTION_MATERNITY'),
    );
    if (period) return { start: period.start_date, end: period.end_date };
  }
  if (!input) return { start: null, end: null };
  const isAdoption = input.stage === 'ADOPTION';
  const event = isAdoption
    ? (input.adopted_or_foster_child_acceptance_date ?? null)
    : input.due_or_birth_date;
  const start = event ? (isAdoption ? event : (input.maternity_leave_start_date ?? event)) : null;
  if (!start) return { start: null, end: null };

  const roleFollowUpStarts = documents
    .filter(
      (doc) =>
        doc.parent_role === role &&
        (doc.id === 'SUPPLEMENTARY_REQUEST' || doc.id === 'PARENTAL_REQUEST') &&
        doc.start_date &&
        doc.start_date > start,
    )
    .map((doc) => doc.start_date as string)
    .sort((a, b) => a.localeCompare(b));
  if (roleFollowUpStarts.length > 0) {
    return { start, end: addDaysIso(roleFollowUpStarts[0], -1) };
  }

  const childLoss = input.special_circumstances.stillbirth_or_child_death;
  const living = livingChildren(input);
  const daysPerWeek = params.calendar.daysPerWeek;
  if (childLoss === 'BEFORE_8_WEEKS' && living <= 0) {
    const days = params.childDeath.weeksAfterBirthIfBeforeThreshold * daysPerWeek;
    return { start, end: addDaysIso(start, days - 1) };
  }
  const availableCounts = Object.keys(params.maternityLeave.weeksByChildrenCount)
    .map(Number)
    .filter((value) => Number.isFinite(value));
  const maxCount = availableCounts.length > 0 ? Math.max(...availableCounts) : 1;
  const countKey = String(
    Math.min(maxCount, Math.max(1, living)),
  ) as keyof typeof params.maternityLeave.weeksByChildrenCount;
  const weeks = params.maternityLeave.weeksByChildrenCount[countKey];
  if (!weeks) return { start, end: null };
  return { start, end: addDaysIso(start, weeks * daysPerWeek - 1) };
}

function buildApplications(
  documents: CaseDocument[],
  input: CaseInputs | null,
  plan: CasePlan | null,
  params: BenefitParams,
): ApplicationItem[] {
  const actionable = documents.filter(isActionableApplication);
  if (actionable.length === 0) return [];

  const contexts: Record<ApplicantRole, ParentApplicationContext> = {
    MOTHER: resolveParentApplicationContext('MOTHER', documents, input),
    FATHER: resolveParentApplicationContext('FATHER', documents, input),
  };

  const uscRoles = new Set(
    actionable.filter((doc) => doc.id === 'USC_COPY').map((doc) => doc.parent_role),
  );
  let uscIncluded = false;

  const parentalSorted = actionable
    .filter((doc) => doc.id === 'PARENTAL_REQUEST')
    .sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''));
  const parentalIndexMap = new Map<CaseDocument, number>();
  parentalSorted.forEach((doc, idx) => parentalIndexMap.set(doc, idx + 1));

  const childLoss = input?.special_circumstances.stillbirth_or_child_death ?? 'NONE';
  const living = input ? livingChildren(input) : null;
  const stillbirthAllLost = Boolean(
    input &&
    childLoss !== 'NONE' &&
    ((living !== null && living <= 0) || !actionable.some((doc) => doc.id === 'PARENTAL_REQUEST')),
  );

  const items: ApplicationItem[] = [];

  for (const doc of actionable) {
    if (doc.id === 'USC_COPY') {
      if (uscIncluded) continue;
      uscIncluded = true;
    }

    const parentCtx = contexts[doc.parent_role];

    if (doc.id === 'ZAM') {
      const roleActionable = actionable.filter((item) => item.parent_role === doc.parent_role);
      const hasMaternityCoveringDoc = roleActionable.some(
        (item) =>
          item.id === 'COMBINED_RATE' || item.id === 'ADOPTION_LEAVE' || item.id === 'TAKEOVER',
      );
      const hasSpecificRequest = roleActionable.some(
        (item) => item.id !== 'ZAM' && item.id !== 'USC_COPY' && item.id !== 'ZAS-53',
      );

      let needsStandaloneMaternity = false;
      if (input) {
        const motherDeceased = Boolean(input.special_circumstances.mother_deceased);
        const roleHasMaternity =
          !input.parental_only &&
          ((doc.parent_role === input.applicant_role &&
            (doc.parent_role === 'MOTHER' || input.stage === 'ADOPTION') &&
            !motherDeceased) ||
            (doc.parent_role === 'FATHER' && motherDeceased && input.stage !== 'ADOPTION'));
        needsStandaloneMaternity = roleHasMaternity && !hasMaternityCoveringDoc;
      } else {
        needsStandaloneMaternity = !hasSpecificRequest;
      }

      if (!needsStandaloneMaternity && hasSpecificRequest) {
        continue;
      }
    }

    let startDate = doc.start_date;
    let endDate = doc.end_date;
    if (doc.id === 'ZAM' && !startDate && !endDate) {
      const inferred = inferMaternityDatesForZam(doc.parent_role, documents, input, plan, params);
      startDate = inferred.start;
      endDate = inferred.end;
    }

    const workFraction = resolveWorkFraction(doc, input, plan, parentCtx.isEmployee);
    let workExtensionStart: string | null = null;
    let workExtensionEnd: string | null = null;
    let workExtensionDays = 0;

    if (workFraction > 0 && startDate && endDate) {
      const baseDays = diffDaysIso(startDate, endDate) + 1;
      if (baseDays > 0) {
        workExtensionDays = Math.floor(baseDays / (1 - workFraction)) - baseDays;
        if (workExtensionDays > 0) {
          workExtensionStart = addDaysIso(endDate, 1);
          workExtensionEnd = addDaysIso(endDate, workExtensionDays);
        }
      }
    }

    let relatedParentalRange: ApplicationItem['relatedParentalRange'] = null;
    if (doc.id === 'COMBINED_RATE' && !stillbirthAllLost) {
      const roleParental = parentalSorted.filter((item) => item.parent_role === doc.parent_role);
      const firstParental = roleParental[0];
      const lastParental = roleParental[roleParental.length - 1];
      if (firstParental?.start_date && lastParental?.end_date) {
        relatedParentalRange = {
          start: firstParental.start_date,
          end: lastParental.end_date,
          weeksLabel: formatDurationRange(
            firstParental.start_date,
            lastParental.end_date,
            params.calendar.daysPerWeek,
          ),
        };
      }
    }

    items.push({
      key: documentKey(doc),
      doc,
      parentCtx,
      sharedWithBothParents: doc.id === 'USC_COPY' && uscRoles.size > 1,
      startDate,
      endDate,
      partNumber: parentalIndexMap.get(doc) ?? null,
      partTotal: parentalSorted.length,
      workFraction,
      workExtensionStart,
      workExtensionEnd,
      workExtensionDays,
      stillbirthOnly:
        stillbirthAllLost &&
        (doc.id === 'COMBINED_RATE' || doc.id === 'ZAM' || doc.id === 'USC_COPY'),
      relatedParentalRange,
    });
  }

  const nonUsc = items.filter((item) => item.doc.id !== 'USC_COPY');
  const usc = items.filter((item) => item.doc.id === 'USC_COPY');
  return [...nonUsc, ...usc];
}

function applicationCode(item: ApplicationItem, params: BenefitParams): string {
  const { doc, parentCtx, stillbirthOnly } = item;
  if (doc.id === 'USC_COPY') return 'USC / AKT';
  if (doc.id === 'ZAS-53') return 'ZUS ZAS-53';
  if (parentCtx.isNonEmployee) return 'ZUS ZAM';
  if (doc.id === 'COMBINED_RATE' && !stillbirthOnly) {
    return `WNIOSEK-${formatRate(params.rates.combined)}`;
  }
  if (parentCtx.isEmployee) return 'WNIOSEK-KP';
  return doc.id === 'ZAM' ? 'ZUS ZAM' : 'WNIOSEK';
}

function applicationTitle(item: ApplicationItem, params: BenefitParams): string {
  const { doc, parentCtx, partNumber, partTotal, stillbirthOnly } = item;
  const combinedRate = formatRate(params.rates.combined);
  const partSuffix =
    partNumber !== null
      ? partTotal > 1
        ? ` (część ${partNumber} z ${partTotal})`
        : ' (część 1)'
      : '';

  if (doc.id === 'USC_COPY') return 'Wniosek do USC o wydanie odpisu aktu urodzenia';
  if (doc.id === 'ZAS-53') return 'ZAS-53 – wniosek o zasiłek chorobowy';

  if (parentCtx.isNonEmployee) {
    if (stillbirthOnly) {
      return 'ZAM – wniosek o zasiłek macierzyński po stracie dziecka';
    }
    if (doc.id === 'COMBINED_RATE') {
      return `ZAM – wniosek o zasiłek macierzyński (stawka ${combinedRate})`;
    }
    if (doc.id === 'PARENTAL_REQUEST') {
      const extSuffix =
        doc.leave_type === 'PARENTAL_ZA_ZYCIEM_EXTENSION' ? ' – przedłużenie „Za życiem”' : '';
      return `ZAM – wniosek o zasiłek macierzyński za okres urlopu rodzicielskiego${partSuffix}${extSuffix}`;
    }
    if (doc.id === 'SUPPLEMENTARY_REQUEST') {
      return 'ZAM – wniosek o zasiłek macierzyński za okres uzupełniającego urlopu macierzyńskiego';
    }
    if (doc.id === 'PATERNITY_REQUEST') {
      return 'ZAM – wniosek o zasiłek macierzyński za okres urlopu ojcowskiego';
    }
    if (doc.id === 'TAKEOVER') {
      return 'ZAM – wniosek ojca o zasiłek za przejęty okres macierzyńskiego';
    }
    return 'ZAM – wniosek o zasiłek macierzyński';
  }

  if (parentCtx.isEmployee) {
    if (stillbirthOnly) {
      return 'Wniosek o urlop macierzyński po stracie dziecka';
    }
    if (doc.id === 'COMBINED_RATE') {
      return doc.leave_type === 'ADOPTION_MATERNITY'
        ? `Wniosek o urlop na warunkach macierzyńskiego i rodzicielski (stawka ${combinedRate})`
        : `Wniosek o urlop macierzyński i rodzicielski (stawka ${combinedRate})`;
    }
    if (doc.id === 'ADOPTION_LEAVE') {
      return 'Wniosek o urlop na warunkach urlopu macierzyńskiego';
    }
    if (doc.id === 'TAKEOVER') {
      return 'Wniosek ojca o przejęcie części urlopu macierzyńskiego';
    }
    if (doc.id === 'SUPPLEMENTARY_REQUEST') {
      return 'Wniosek o uzupełniający urlop macierzyński';
    }
    if (doc.id === 'PARENTAL_REQUEST') {
      const extSuffix =
        doc.leave_type === 'PARENTAL_ZA_ZYCIEM_EXTENSION' ? ' – przedłużenie „Za życiem”' : '';
      return `Wniosek o urlop rodzicielski${partSuffix}${extSuffix}`;
    }
    if (doc.id === 'PATERNITY_REQUEST') {
      return 'Wniosek o urlop ojcowski';
    }
    if (doc.id === 'ZAM') {
      return 'Wniosek o urlop macierzyński';
    }
  }

  if (doc.id === 'PARENTAL_REQUEST') {
    return `${doc.name_pl}${partSuffix}`;
  }
  return doc.name_pl;
}

function requiredFieldsForApplication(item: ApplicationItem): PersonalFieldKey[] {
  const { doc, parentCtx } = item;
  if (doc.id === 'USC_COPY' || (parentCtx.isEmployee && leaveApplication(doc, null, [], {})))
    return ['name'];
  if (
    doc.id === 'ZAM' ||
    doc.id === 'ZAS-53' ||
    parentCtx.isNonEmployee ||
    parentCtx.hasZ3 ||
    doc.submit_to === 'ZUS'
  ) {
    return ['name', 'pesel', 'bank'];
  }
  return ['name', 'pesel'];
}

function recipientShort(item: ApplicationItem): string {
  const { doc, parentCtx } = item;
  if (doc.submit_to === 'USC') return 'Urząd Stanu Cywilnego';
  if (doc.submit_to === 'ZUS') return 'ZUS (PUE / eZUS)';
  if (doc.submit_to === 'EMPLOYER') {
    if (parentCtx.isNonEmployee) return 'Płatnik składek (zleceniodawca)';
    if (parentCtx.hasZ3) return 'Pracodawca (przekazuje Z-3 do ZUS)';
    return 'Pracodawca';
  }
  return 'Do ustalenia';
}

function recipientFull(item: ApplicationItem, params: BenefitParams): string {
  const { doc, parentCtx } = item;
  const threshold = params.payerThresholdInsuredCount;
  if (doc.submit_to === 'USC') return 'Urząd Stanu Cywilnego (Rejestr Stanu Cywilnego / gov.pl)';
  if (doc.submit_to === 'ZUS') {
    if (parentCtx.hasZ3a) {
      return `Zakład Ubezpieczeń Społecznych (PUE / eZUS) – zleceniodawca (do ${threshold} ubezpieczonych) przekazuje Z-3a`;
    }
    return 'Zakład Ubezpieczeń Społecznych (PUE / eZUS)';
  }
  if (doc.submit_to === 'EMPLOYER') {
    if (parentCtx.isNonEmployee) {
      return `Uprawniony płatnik składek – zleceniodawca (> ${threshold} ubezpieczonych)`;
    }
    if (parentCtx.hasZ3) {
      return `Pracodawca (do ${threshold} ubezpieczonych – przekazuje wniosek i Z-3 do ZUS, wypłaca ZUS)`;
    }
    return `Pracodawca (płatnik składek > ${threshold} ubezpieczonych – ustala i wypłaca zasiłek)`;
  }
  return 'Do ustalenia (uzupełnij formę zatrudnienia i wielkość płatnika rodzica)';
}

function applicationChannel(item: ApplicationItem): string {
  const { doc, parentCtx } = item;
  if (doc.submit_to === 'USC') return 'Rejestr Stanu Cywilnego / gov.pl (symulacja)';
  if (doc.submit_to === 'ZUS') return 'Wysyłka elektroniczna przez PUE / eZUS (symulacja)';
  if (doc.submit_to === 'EMPLOYER') {
    if (parentCtx.isNonEmployee) {
      return 'Złożenie wniosku ZUS ZAM u uprawnionego płatnika składek (symulacja)';
    }
    return parentCtx.hasZ3
      ? 'Dział kadr pracodawcy – pracodawca przekazuje Z-3 do ZUS (symulacja)'
      : 'Dział kadr / system pracodawcy (symulacja)';
  }
  return 'Uzupełnij dane płatnika, aby określić kanał złożenia';
}

function applicationLegalNote(item: ApplicationItem, section?: string): string {
  const { doc, parentCtx } = item;
  if (doc.id === 'USC_COPY') return doc.legal_basis;
  if (section)
    return `${section} rozporządzenia MRPiPS z 11.03.2025 r. (Dz.U. z 2025 r. poz. 322). ${doc.legal_basis}`;
  if (parentCtx.isEmployee) {
    return `${doc.legal_basis}; Rozporządzenie MRPiPS z 11.03.2025 r. (Dz.U. z 2025 r. poz. 322)`;
  }
  if (parentCtx.isNonEmployee || doc.id === 'ZAM' || doc.id === 'ZAS-53') {
    return `${doc.legal_basis}; Rozporządzenie MRPiPS z 27.09.2026 r. (Dz.U. z 2026 r. poz. 1316)`;
  }
  return doc.legal_basis;
}

function applicationVerificationNote(item: ApplicationItem, params: BenefitParams): string | null {
  const { doc, parentCtx } = item;
  if (doc.id === 'USC_COPY') return null;
  if (parentCtx.isEmployee) {
    return 'Wzór zgodny z rozporządzeniem MRPiPS 2025 poz. 322 – do weryfikacji.';
  }
  if (parentCtx.isNonEmployee || doc.id === 'ZAM' || doc.id === 'ZAS-53') {
    return `Wzór formularza ZUS (od ${formatPolishDate(params.forms2026EffectiveDate)} r. ZAM zastępuje druki ZUR i ZAO; Z-3b zlikwidowany) zgodny z rozporządzeniem MRPiPS 2026 poz. 1316 – do weryfikacji na www.zus.pl.`;
  }
  return 'Zakres danych i wzór wniosku zależą od formy zatrudnienia rodzica – do weryfikacji.';
}

function rateAndVariantDescription(
  item: ApplicationItem,
  allDocuments: CaseDocument[],
  input: CaseInputs | null,
  params: BenefitParams,
): string | null {
  const { doc, stillbirthOnly } = item;
  if (doc.id === 'USC_COPY') return null;

  const r = params.rates;
  const nonTransferable = params.parentalLeave.nonTransferableWeeksPerParent;
  const applicantRole = input?.applicant_role ?? 'MOTHER';
  const hasCombinedForApplicant =
    !stillbirthOnly &&
    allDocuments.some(
      (candidate) => candidate.id === 'COMBINED_RATE' && candidate.parent_role === applicantRole,
    );

  if (doc.id === 'ZAS-53') {
    return `${formatRate(r.sicknessPregnancy)} podstawy wymiaru (ciąża – kod literowy „B” na e-ZLA)`;
  }
  if (doc.id === 'PATERNITY_REQUEST') {
    return `${formatRate(r.paternity)} podstawy wymiaru (urlop ojcowski)`;
  }
  if (doc.id === 'SUPPLEMENTARY_REQUEST') {
    return `${formatRate(r.supplementaryMaternity)} podstawy wymiaru (uzupełniający urlop macierzyński)`;
  }
  if (doc.id === 'TAKEOVER') {
    return `${formatRate(r.maternity)} podstawy wymiaru (przejęta część urlopu macierzyńskiego)`;
  }
  if (stillbirthOnly) {
    return `${formatRate(r.maternity)} podstawy wymiaru (${params.childDeath.weeksAfterBirthIfBeforeThreshold} tyg. po porodzie, bez urlopu rodzicielskiego)`;
  }
  if (doc.id === 'COMBINED_RATE') {
    return `${formatRate(r.combined)} za cały okres macierzyńskiego i rodzicielskiego (wniosek do ${params.combinedRateApplicationDeadlineDays} dni; nieprzenoszalne ${nonTransferable} tyg. drugiego rodzica: ${formatRate(r.secondParentNonTransferableInCombined)})`;
  }
  if (doc.id === 'ADOPTION_LEAVE') {
    return hasCombinedForApplicant
      ? `${formatRate(r.combined)} przy łącznym wniosku złożonym do ${params.combinedRateApplicationDeadlineDays} dni (inaczej ${formatRate(r.adoptionMaternity)})`
      : `${formatRate(r.adoptionMaternity)} podstawy wymiaru`;
  }
  if (doc.id === 'ZAM') {
    return `${formatRate(r.maternity)} podstawy wymiaru (wariant standardowy ${formatRate(r.maternity)} + ${formatRate(r.parental)})`;
  }
  if (doc.id === 'PARENTAL_REQUEST') {
    if (hasCombinedForApplicant && doc.parent_role === applicantRole) {
      return `${formatRate(r.combined)} podstawy wymiaru (wariant łączny)`;
    }
    if (hasCombinedForApplicant && doc.parent_role !== applicantRole) {
      return `${formatRate(r.secondParentNonTransferableInCombined)} podstawy wymiaru (wyłączna, nieprzenoszalna część drugiego rodzica – ${nonTransferable} tyg.)`;
    }
    return `${formatRate(r.parental)} podstawy wymiaru (wariant standardowy)`;
  }
  return null;
}

function employmentFormLabel(ctx: ParentApplicationContext): string | null {
  if (ctx.employmentType === 'UOP')
    return 'Umowa o pracę (pracownik – wniosek o urlop z Kodeksu pracy)';
  if (ctx.employmentType === 'ZLECENIE') {
    return 'Umowa zlecenie (niebędący pracownikiem – wniosek ZUS ZAM o zasiłek za okres odpowiadający urlopowi)';
  }
  if (ctx.employmentType === 'B2B') {
    return 'Działalność gospodarcza / JDG (niebędący pracownikiem – wniosek ZUS ZAM o zasiłek za okres odpowiadający urlopowi)';
  }
  if (ctx.isNonEmployee) {
    return 'Ubezpieczony niebędący pracownikiem (wniosek ZUS ZAM o zasiłek za okres odpowiadający urlopowi)';
  }
  return null;
}

function attachmentsForApplication(item: ApplicationItem, allDocuments: CaseDocument[]): string {
  const { doc, stillbirthOnly, parentCtx } = item;
  const hasHospital = allDocuments.some((candidate) => candidate.id === 'HOSPITAL_CERTIFICATE');
  const hasZaZyciem = allDocuments.some((candidate) => candidate.id === 'ZA_ZYCIEM_CERTIFICATE');
  const hasAdoption = allDocuments.some((candidate) => candidate.id === 'ADOPTION_ORDER');

  if (doc.id === 'USC_COPY') {
    return stillbirthOnly
      ? 'Brak załączników – odpis skrócony aktu urodzenia z adnotacją o martwym urodzeniu (do celów zasiłkowych bez opłaty skarbowej).'
      : 'Brak załączników – wniosek o skrócony odpis aktu urodzenia do celów zasiłkowych (bez opłaty skarbowej).';
  }
  if (doc.id === 'ZAS-53') {
    return 'Elektroniczne zaświadczenie lekarskie e-ZLA z kodem literowym „B” (lekarz przekazuje do ZUS automatycznie).';
  }
  if (stillbirthOnly) {
    return 'Skrócony odpis aktu urodzenia z adnotacją o martwym urodzeniu lub zaświadczenie lekarskie o martwym urodzeniu.';
  }
  if (doc.id === 'SUPPLEMENTARY_REQUEST') {
    return 'Zaświadczenie wydane przez szpital stanowiące podstawę do uzupełniającego urlopu macierzyńskiego.';
  }
  if (doc.id === 'ADOPTION_LEAVE') {
    return 'Dokument przyjęcia dziecka na wychowanie (zaświadczenie sądu o wystąpieniu o przysposobienie albo orzeczenie o rodzinie zastępczej niezawodowej).';
  }
  if (doc.id === 'TAKEOVER') {
    return 'Skrócony odpis aktu urodzenia dziecka oraz rezygnacja matki z dalszej części urlopu lub dokument potwierdzający podstawę wcześniejszego przejęcia.';
  }
  if (doc.id === 'PARENTAL_REQUEST') {
    const items = [
      hasAdoption
        ? 'dokument przyjęcia dziecka na wychowanie'
        : 'skrócony odpis aktu urodzenia dziecka',
    ];
    if (hasZaZyciem) items.push('zaświadczenie lekarskie „Za życiem” (art. 4 ust. 3)');
    if (parentCtx.hasZ3a)
      items.push('zaświadczenie płatnika składek Z-3a (przekazuje zleceniodawca do ZUS)');
    return items.join('; ') + '.';
  }
  if (doc.id === 'PATERNITY_REQUEST') {
    const items = [
      hasAdoption
        ? 'dokument przyjęcia dziecka na wychowanie'
        : 'skrócony odpis aktu urodzenia dziecka',
    ];
    if (parentCtx.hasZ3a)
      items.push('zaświadczenie płatnika składek Z-3a (przekazuje zleceniodawca do ZUS)');
    return items.join('; ') + '.';
  }
  const items = [
    hasAdoption
      ? 'dokument przyjęcia dziecka na wychowanie'
      : 'skrócony odpis aktu urodzenia dziecka',
  ];
  if (hasHospital && doc.id === 'ZAM') {
    items.push('zaświadczenie wydane przez szpital (dla okresu uzupełniającego)');
  }
  if (hasZaZyciem) items.push('zaświadczenie lekarskie „Za życiem” (art. 4 ust. 3)');
  if (parentCtx.hasZ3a)
    items.push('zaświadczenie płatnika składek Z-3a (przekazuje zleceniodawca do ZUS)');
  return items.join('; ') + '.';
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
  code: string;
  fields: { label: string; value: string }[];
  legalNote: string;
  attachments?: string[];
  verificationNote?: string;
  delivery?: DeliveryGuide;
  mailto?: string;
  pdf?: ApplicationPdfData;
}

const ZAM_LEAVE_BY_TYPE: Partial<Record<string, ZamLeave>> = {
  MATERNITY: 'maternity',
  ADOPTION_MATERNITY: 'maternity',
  PARENTAL: 'parental',
  PARENTAL_ZA_ZYCIEM_EXTENSION: 'parental',
  PARENTAL_WORK_EXTENSION: 'parental',
  SUPPLEMENTARY_MATERNITY: 'supplementary',
  PATERNITY: 'paternity',
};

/** Pola, które w piśmie są zbędne (informacje pomocnicze aplikacji, nie treść wniosku). */
const LETTER_SKIPPED_LABELS = new Set([
  'Wnioskodawca (rola)',
  'Forma ubezpieczenia',
  'Adresat',
  'Termin złożenia',
  'Załączniki',
  'Wariant i stawka zasiłku',
]);

export interface CaseApplicationsProps {
  documents: CaseDocument[];
  input?: CaseInputs | null;
  plan?: CasePlan | null;
  params?: BenefitParams;
}

export function CaseApplications({
  documents,
  input: inputProp,
  plan: planProp,
  params: paramsProp,
}: CaseApplicationsProps) {
  const { pathname, search } = useLocation();
  const { scenario, planInputs, simulatedIdentities } = useScenario();
  const [fetchedCase, setFetchedCase] = useState<{ caseId: string; input: CaseInputs } | null>(
    null,
  );
  const [personal, setPersonal] = useState<
    Partial<Record<ApplicantRole, Partial<Record<PersonalFieldKey, string>>>>
  >({});
  const [answers, setAnswers] = useState<Record<string, Record<string, string>>>({});
  const [receipts, setReceipts] = useState<Record<string, SentReceipt>>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [invalidField, setInvalidField] = useState<string | null>(null);
  const [previewModal, setPreviewModal] = useState<PreviewModalState | null>(null);

  const caseId = useMemo(() => new URLSearchParams(search).get('case'), [search]);
  const params = paramsProp ?? DEFAULT_PARAMS;

  useEffect(() => {
    if (inputProp || planInputs || !caseId) return;
    let active = true;
    void apiGet<CaseRecord>(`/cases/${encodeURIComponent(caseId)}`)
      .then((record) => {
        if (active && record?.inputs) {
          setFetchedCase({ caseId, input: record.inputs });
        }
      })
      .catch(() => {
        // W środowisku bez API (np. test jednostkowy) korzystamy z danych z documents.
      });
    return () => {
      active = false;
    };
  }, [inputProp, planInputs, caseId]);

  const effectiveInput =
    inputProp ?? planInputs ?? (fetchedCase?.caseId === caseId ? fetchedCase.input : null);

  const forms = useMemo(
    () => buildApplications(documents, effectiveInput, planProp ?? null, params),
    [documents, effectiveInput, planProp, params],
  );
  const wizardHref = scenario.situation ? `/wizard?situation=${scenario.situation}` : '/wizard';
  const openKey = useMemo(() => new URLSearchParams(search).get('open'), [search]);
  // Lista pól w panelu „Wypełnij i pobierz” jest ustalana raz na otwarty wniosek – pole nie może
  // zniknąć, gdy tylko zacznie się je wpisywać.
  const [promptFields, setPromptFields] = useState<{
    key: string | null;
    personal: PersonalFieldKey[];
    details: string[];
  }>({
    key: null,
    personal: [],
    details: [],
  });
  const hasOpenItem = openKey !== null && forms.some((item) => item.key === openKey);

  useEffect(() => {
    if (!hasOpenItem) return;
    const element = document.getElementById('apps-open');
    if (typeof element?.scrollIntoView === 'function') {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [hasOpenItem, openKey]);

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

  const todayIso = todayIsoDate();
  const refYear = todayIso.slice(0, 4);
  const daysPerWeek = params.calendar.daysPerWeek;

  function personalValue(role: ApplicantRole, field: PersonalFieldKey) {
    const edited = personal[role]?.[field];
    if (edited !== undefined) return edited;
    const profile = simulatedIdentities[role]?.profile;
    if (!profile || field === 'bank') return '';
    return field === 'name' ? `${profile.firstName} ${profile.lastName}` : profile[field];
  }

  function personalId(role: ApplicantRole, field: PersonalFieldKey) {
    return 'application-' + role + '-' + field;
  }

  function applicationDetails(item: ApplicationItem) {
    return item.parentCtx.isEmployee
      ? leaveApplication(
          item.doc,
          effectiveInput,
          planProp?.outcome.periods ?? [],
          answers[item.key] ?? {},
        )
      : null;
  }

  function buildFields(
    item: ApplicationItem,
  ): { label: string; value: string; missing?: boolean }[] {
    const { doc, parentCtx } = item;
    const required = requiredFieldsForApplication(item);
    const trimmedName = personalValue(doc.parent_role, 'name').trim();
    const trimmedPesel = personalValue(doc.parent_role, 'pesel').trim();
    const birthDate = personalValue(doc.parent_role, 'birthDate');
    const trimmedBank = personalValue(doc.parent_role, 'bank').trim();
    const parentRoleValue = item.sharedWithBothParents
      ? 'Matka / Ojciec (jeden wniosek dla obojga rodziców)'
      : parentLabels[doc.parent_role];

    const fields: { label: string; value: string; missing?: boolean }[] = [
      { label: 'Wnioskodawca (rola)', value: parentRoleValue },
    ];

    const formLabel = doc.id === 'USC_COPY' ? null : employmentFormLabel(parentCtx);
    if (formLabel) {
      fields.push({ label: 'Forma ubezpieczenia', value: formLabel });
    }

    fields.push({
      label: 'Imię i nazwisko',
      value: trimmedName || 'Do uzupełnienia',
      missing: !trimmedName,
    });
    if (required.includes('pesel')) {
      fields.push({
        label: 'PESEL',
        value: trimmedPesel || 'Do uzupełnienia',
        missing: !trimmedPesel,
      });
    }
    if (birthDate) {
      fields.push({ label: PERSONAL_FIELD_LABELS.birthDate, value: formatPolishDate(birthDate) });
    }
    if (required.includes('bank')) {
      fields.push({
        label: 'Numer rachunku do wypłaty',
        value: trimmedBank || 'Do uzupełnienia',
        missing: !trimmedBank,
      });
    }

    fields.push({ label: 'Adresat', value: recipientFull(item, params) });

    if (item.startDate && item.endDate) {
      const duration = formatDurationRange(item.startDate, item.endDate, daysPerWeek);
      const start = formatPolishDate(item.startDate);
      const startOnly =
        doc.id === 'PRE_BIRTH_REQUEST' ||
        (doc.id === 'TAKEOVER' &&
          parentCtx.isEmployee &&
          (effectiveInput?.special_circumstances.mother_deceased ||
            answers[item.key]?.takeoverBasis === 'hospital'));
      fields.push(
        startOnly
          ? { label: 'Data rozpoczęcia urlopu', value: start }
          : {
              label: parentCtx.isNonEmployee ? 'Wnioskowany okres zasiłku' : 'Wnioskowany okres',
              value: `${start}–${formatPolishDate(item.endDate)}${duration ? ` (${duration})` : ''}`,
            },
      );
    }

    if (item.relatedParentalRange) {
      const { start, end, weeksLabel } = item.relatedParentalRange;
      fields.push({
        label: 'Łącznie z pełnym rodzicielskim',
        value: `${formatPolishDate(start)}–${formatPolishDate(end)}${weeksLabel ? ` (${weeksLabel})` : ''}`,
      });
    }

    if (item.partNumber !== null) {
      const partLabel =
        item.partTotal > 1
          ? `Część ${item.partNumber} z ${item.partTotal} (limit w puli: maks. ${params.parentalLeave.maxParts} części)`
          : `Część 1 z 1 (limit w puli: maks. ${params.parentalLeave.maxParts} części)`;
      fields.push({
        label: parentCtx.isNonEmployee ? 'Część okresu rodzicielskiego' : 'Część urlopu',
        value: partLabel,
      });
    }

    if (item.workFraction > 0) {
      const workDesc = formatWorkFraction(item.workFraction);
      fields.push({
        label: 'Łączenie urlopu z pracą',
        value: `Tak – wymiar pracy ${workDesc} (maks. ${formatWorkFraction(params.parentalLeave.maxWorkTimeFraction)}; zasiłek pomniejszony proporcjonalnie)`,
      });
      if (item.workExtensionStart && item.workExtensionEnd && item.startDate) {
        const extDuration = formatDurationRange(
          item.workExtensionStart,
          item.workExtensionEnd,
          daysPerWeek,
        );
        const totalDuration = formatDurationRange(
          item.startDate,
          item.workExtensionEnd,
          daysPerWeek,
        );
        fields.push({
          label: 'Proporcjonalne wydłużenie urlopu',
          value: `${formatPolishDate(item.workExtensionStart)}–${formatPolishDate(item.workExtensionEnd)}${extDuration ? ` (+${extDuration})` : ''}${totalDuration ? `, łącznie ${totalDuration}` : ''}`,
        });
      }
    }

    const rateInfo = rateAndVariantDescription(item, documents, effectiveInput, params);
    if (rateInfo) {
      fields.push({ label: 'Wariant i stawka zasiłku', value: rateInfo });
    }

    if (doc.deadline) {
      fields.push({
        label: 'Termin złożenia',
        value: `${formatPolishDate(doc.deadline)}${doc.is_overdue ? ' (Termin minął)' : ''}`,
      });
    }

    if (!applicationDetails(item)) {
      fields.push({ label: 'Załączniki', value: attachmentsForApplication(item, documents) });
    }

    return fields;
  }

  function clearError() {
    setInvalidField(null);
    setValidationError(null);
  }

  function showError(id: string, message: string) {
    setStatusMessage(null);
    setInvalidField(id);
    setValidationError(message);
    const element = document.getElementById(id);
    element?.closest('details')?.setAttribute('open', '');
    element?.focus();
  }

  function validateItem(item: ApplicationItem, idPrefix = ''): boolean {
    const { doc, key } = item;
    const role = doc.parent_role;
    for (const field of requiredFieldsForApplication(item)) {
      const value = personalValue(role, field).trim();
      if (!isPersonalValueValid(field, value)) {
        showError(
          `${idPrefix}${personalId(role, field)}`,
          `Uzupełnij dane osobowe (${parentLabels[role]}): ${PERSONAL_FIELD_LABELS[field]}.`,
        );
        return false;
      }
    }
    for (const field of applicationDetails(item)?.fields ?? []) {
      const value = (field.value ?? answers[key]?.[field.id] ?? '').trim();
      if (!value || (field.type === 'number' && !/^\d+$/.test(value))) {
        showError(
          `${idPrefix}${key}-${field.id}`,
          `Uzupełnij pole „${field.label}” we wniosku „${doc.name_pl}”.`,
        );
        return false;
      }
    }
    return true;
  }

  function buildPdfData(
    item: ApplicationItem,
    title: string,
    fields: { label: string; value: string }[],
    attachments: string[] | undefined,
  ): ApplicationPdfData {
    const { doc } = item;
    const role = doc.parent_role;
    const kind: ApplicationPdfData['kind'] =
      doc.id === 'ZAS-53' ? 'zas53' : doc.submit_to === 'ZUS' ? 'zam' : 'letter';

    let zamPeriods: ZamPeriod[] | undefined;
    if (kind === 'zam') {
      const single = doc.leave_type ? ZAM_LEAVE_BY_TYPE[doc.leave_type] : undefined;
      if (item.startDate && item.endDate && single && doc.id !== 'COMBINED_RATE') {
        zamPeriods = [
          { leave: single, start: item.startDate, end: item.endDate, part: item.partNumber },
        ];
      } else {
        zamPeriods = (planProp?.outcome.periods ?? [])
          .filter((period) => period.parent_role === role && !period.denied)
          .flatMap((period) => {
            const leave = ZAM_LEAVE_BY_TYPE[period.leave_type];
            return leave ? [{ leave, start: period.start_date, end: period.end_date }] : [];
          });
      }
    }

    return {
      kind,
      title,
      recipient: recipientFull(item, params),
      applicant: {
        name: personalValue(role, 'name').trim(),
        pesel: personalValue(role, 'pesel').trim(),
        birthDate: personalValue(role, 'birthDate'),
        bank: personalValue(role, 'bank').trim(),
      },
      todayIso,
      sections: fields.filter(
        (field) =>
          !LETTER_SKIPPED_LABELS.has(field.label) &&
          !['Imię i nazwisko', 'PESEL', 'Numer rachunku do wypłaty', 'Data urodzenia'].includes(
            field.label,
          ),
      ),
      attachments: attachments ?? [],
      legalNote: applicationLegalNote(item, applicationDetails(item)?.section),
      zamPeriods,
      zamReason:
        effectiveInput?.adoption_type === 'ADOPTION'
          ? 'adoption'
          : effectiveInput?.adoption_type === 'FOSTER_FAMILY'
            ? 'foster'
            : 'birth',
      voluntarySickness: item.parentCtx.isNonEmployee
        ? (effectiveInput?.voluntary_sickness_insured ?? null)
        : null,
      fullLeaveDeclaration: doc.id === 'COMBINED_RATE',
      childDate: effectiveInput?.due_or_birth_date ?? null,
      manualFields: [],
    };
  }

  function openPreview(item: ApplicationItem) {
    const { doc, key } = item;
    const details = applicationDetails(item);
    const title = applicationTitle(item, params);
    const parentBadge = item.sharedWithBothParents
      ? 'Matka / Ojciec'
      : parentLabels[doc.parent_role];
    const attachments = details?.attachments;
    const verificationNote = applicationVerificationNote(item, params);
    const previewFields = [
      ...buildFields(item),
      ...(details?.fields.map((field) => {
        const value = field.value ?? answers[key]?.[field.id] ?? '';
        return {
          label: field.label,
          value: field.options?.find((option) => option.value === value)?.label ?? value,
        };
      }) ?? []),
    ];
    setPreviewModal({
      title: `${title} (${parentBadge})`,
      recipient: recipientFull(item, params),
      code: applicationCode(item, params),
      fields: previewFields,
      pdf: buildPdfData(item, title, previewFields, attachments),
      attachments,
      legalNote: applicationLegalNote(item, details?.section),
      verificationNote: verificationNote ?? undefined,
      delivery: deliveryGuide(doc, item.parentCtx.isNonEmployee),
      mailto: buildMailto({
        title,
        who: parentBadge,
        deadline: doc.deadline ? formatPolishDate(doc.deadline) : null,
        attachments,
      }),
    });
  }

  function send(requested: ApplicationItem[]) {
    const pending = requested.filter(({ doc, key }) => doc.submit_to && !receipts[key]);
    if (!pending.length) return;

    for (const item of pending) {
      if (!validateItem(item)) return;
    }

    const nextReceipts = { ...receipts };
    const references: string[] = [];
    let seq = Object.keys(receipts).length + 1;
    for (const item of pending) {
      const { doc, key } = item;
      const code = applicationCode(item, params)
        .replace(/[^A-Z0-9]/gi, '')
        .toUpperCase();
      const referenceNumber = `UPO-${refYear}-${code}-${String(seq).padStart(3, '0')}`;
      references.push(referenceNumber);
      nextReceipts[key] = {
        referenceNumber,
        sentAt: formatPolishDate(todayIso),
        recipient: recipientFull(item, params),
        applicantName: personalValue(doc.parent_role, 'name').trim(),
      };
      seq += 1;
    }
    clearError();
    setReceipts(nextReceipts);
    const skipped = requested.filter(({ doc }) => doc.submit_to === null).length;
    const range =
      references.length === 1 ? references[0] : `${references[0]} … ${references.at(-1)}`;
    setStatusMessage(
      skipped
        ? `Zakończono symulację wysyłki ${pending.length} wniosków (${range}). Pozostałe (${skipped}) wymagają ustalenia płatnika.`
        : `Zakończono symulację wysyłki ${requested.length === 1 ? 'wniosku' : `pakietu ${pending.length} wniosków`} (${range}).`,
    );
  }

  const sendableForms = forms.filter((item) => item.doc.submit_to !== null);
  const remainingSendable = sendableForms.filter((item) => !receipts[item.key]);
  const allSent = sendableForms.length > 0 && remainingSendable.length === 0;
  const anyNonEmployee = forms.some((item) => item.parentCtx.isNonEmployee);
  const anyEmployee = forms.some((item) => item.parentCtx.isEmployee);
  const hasTwoParents =
    new Set(forms.filter((item) => !item.sharedWithBothParents).map((item) => item.doc.parent_role))
      .size > 1;

  const deadlineItems = forms
    .filter((item) => item.doc.deadline !== null)
    .sort((a, b) => (a.doc.deadline ?? '').localeCompare(b.doc.deadline ?? ''));
  const nearestDeadline =
    deadlineItems.find((item) => !item.doc.is_overdue) ?? deadlineItems[0] ?? null;
  const hasOverdue = deadlineItems.some((item) => item.doc.is_overdue);

  const uniqueAddressees = Array.from(
    new Set(
      forms
        .map((item): string | null => {
          if (item.doc.submit_to === 'EMPLOYER') {
            return item.parentCtx.isNonEmployee ? 'płatnika składek' : 'pracodawcy';
          }
          if (item.doc.submit_to === 'ZUS') return 'ZUS';
          if (item.doc.submit_to === 'USC') return 'USC';
          return null;
        })
        .filter((value): value is string => value !== null),
    ),
  );

  const introSummaryParts: string[] = [
    `Przygotowaliśmy ${forms.length === 1 ? '1 wniosek' : `${forms.length} wniosków`}${
      uniqueAddressees.length > 0 ? ` (do: ${uniqueAddressees.join(', ')})` : ''
    }.`,
  ];
  if (nearestDeadline?.doc.deadline) {
    introSummaryParts.push(
      `${nearestDeadline.doc.is_overdue ? 'Uwaga – termin minął' : 'Najbliższy termin'}: ${formatPolishDate(nearestDeadline.doc.deadline)} (${applicationTitle(nearestDeadline, params)}).`,
    );
  }
  if (anyNonEmployee && !anyEmployee) {
    introSummaryParts.push(
      'Przy umowie zlecenia lub JDG składasz formularze ZUS (ZAM / ZAS-53), a nie wnioski o urlop z Kodeksu pracy.',
    );
  }

  const openItem = hasOpenItem ? (forms.find((item) => item.key === openKey) ?? null) : null;
  const openMissingPersonal = openItem
    ? requiredFieldsForApplication(openItem).filter(
        (field) => !isPersonalValueValid(field, personalValue(openItem.doc.parent_role, field)),
      )
    : [];
  const openMissingDetails = openItem
    ? (applicationDetails(openItem)?.fields ?? []).filter(
        (field) =>
          field.value === undefined &&
          (!(answers[openItem.key]?.[field.id] ?? '').trim() ||
            (field.type === 'number' && !/^\d+$/.test(answers[openItem.key]?.[field.id] ?? ''))),
      )
    : [];

  let frozenPrompt = promptFields;
  if (openItem && promptFields.key !== openItem.key) {
    frozenPrompt = {
      key: openItem.key,
      personal: openMissingPersonal,
      details: openMissingDetails.map((field) => field.id),
    };
    setPromptFields(frozenPrompt);
  }
  const promptPersonal = openItem ? frozenPrompt.personal : [];
  const promptDetails = openItem
    ? (applicationDetails(openItem)?.fields ?? []).filter(
        (field) => field.value === undefined && frozenPrompt.details.includes(field.id),
      )
    : [];

  return (
    <div className="plan-tab-content">
      <h2 className="case-paperwork__heading">Wnioski</h2>

      <section className="apps-intro" aria-labelledby="apps-intro-heading">
        <div className="apps-intro__top">
          <div className="apps-intro__copy">
            <h3 id="apps-intro-heading" className="plan-section__title">
              Przygotuj wnioski
            </h3>
            <p className="apps-intro__lead">{introSummaryParts.join(' ')}</p>
            {hasOverdue && (
              <p className="docs-compact-item__overdue">
                Co najmniej jeden termin złożenia wniosku już minął – sprawdź daty poniżej.
              </p>
            )}
          </div>
          <button
            type="button"
            className="plan-btn plan-btn--primary apps-intro__cta"
            disabled={allSent || sendableForms.length === 0}
            onClick={() => send(forms)}
          >
            {allSent
              ? 'Wszystkie wnioski wysłane'
              : remainingSendable.length === sendableForms.length
                ? `Wyślij wszystkie (${sendableForms.length}) ›`
                : `Wyślij pozostałe (${remainingSendable.length}) ›`}
          </button>
        </div>
      </section>

      {statusMessage && (
        <div className="plan-callout plan-callout--success" role="status">
          <strong>Potwierdzenie wysyłki (symulacja):</strong> {statusMessage}
        </div>
      )}

      {openItem && (
        <section
          id="apps-open"
          className="apps-open"
          aria-labelledby="apps-open-heading"
          tabIndex={-1}
        >
          <p className="apps-open__kicker">Wypełnij i pobierz</p>
          <h3 id="apps-open-heading" className="apps-open__title">
            {applicationTitle(openItem, params)}
          </h3>
          <p className="apps-open__lead">
            {openMissingPersonal.length + openMissingDetails.length === 0
              ? 'Wypełniliśmy wniosek danymi z Twojego formularza. Wszystko gotowe – sprawdź podgląd i pobierz PDF.'
              : `Wypełniliśmy wniosek danymi z Twojego formularza. Brakuje jeszcze ${
                  openMissingPersonal.length + openMissingDetails.length
                } ${openMissingPersonal.length + openMissingDetails.length === 1 ? 'informacji' : 'informacji'} – uzupełnij je poniżej.`}
          </p>

          {validationError && (
            <div className="plan-callout plan-callout--warning" role="alert">
              {validationError}
            </div>
          )}

          {(promptPersonal.length > 0 || promptDetails.length > 0) && (
            <div className="plan-controls__grid apps-open__fields">
              {promptPersonal.map((field) => {
                const id = `open-${personalId(openItem.doc.parent_role, field)}`;
                return (
                  <label key={id} className="plan-field">
                    <span className="plan-field__label">{PERSONAL_FIELD_LABELS[field]}</span>
                    <input
                      id={id}
                      type={field === 'birthDate' ? 'date' : 'text'}
                      autoComplete="off"
                      spellCheck={false}
                      inputMode={field === 'pesel' || field === 'bank' ? 'numeric' : undefined}
                      className={
                        invalidField === id
                          ? 'plan-field__input apps-field-error'
                          : 'plan-field__input'
                      }
                      aria-invalid={invalidField === id || undefined}
                      value={personalValue(openItem.doc.parent_role, field)}
                      onChange={(event) => {
                        const value = event.target.value;
                        setPersonal((current) => ({
                          ...current,
                          [openItem.doc.parent_role]: {
                            ...current[openItem.doc.parent_role],
                            [field]: value,
                          },
                        }));
                        clearError();
                      }}
                    />
                  </label>
                );
              })}
              {promptDetails.map((field) => {
                const id = `open-${openItem.key}-${field.id}`;
                const value = answers[openItem.key]?.[field.id] ?? '';
                const update = (next: string) => {
                  setAnswers((current) => ({
                    ...current,
                    [openItem.key]: { ...current[openItem.key], [field.id]: next },
                  }));
                  clearError();
                };
                return (
                  <label key={id} className="plan-field">
                    <span className="plan-field__label">{field.label}</span>
                    {field.options ? (
                      <select
                        id={id}
                        className="plan-field__input"
                        aria-invalid={invalidField === id || undefined}
                        value={value}
                        onChange={(event) => update(event.target.value)}
                      >
                        <option value="">Wybierz odpowiedź</option>
                        {field.options.map((option) => (
                          <option value={option.value} key={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id={id}
                        className="plan-field__input"
                        aria-invalid={invalidField === id || undefined}
                        type={field.type ?? 'text'}
                        min={field.type === 'number' ? 0 : undefined}
                        autoComplete="off"
                        value={value}
                        onChange={(event) => update(event.target.value)}
                      />
                    )}
                  </label>
                );
              })}
            </div>
          )}

          <div className="apps-open__actions">
            <button
              type="button"
              className="plan-btn plan-btn--primary"
              onClick={() => {
                if (validateItem(openItem, 'open-')) {
                  clearError();
                  openPreview(openItem);
                }
              }}
            >
              Podgląd i pobierz PDF ›
            </button>
            <Link
              to={`/plan/documents${search.replace(/([?&])open=[^&]*&?/, '$1').replace(/[?&]$/, '')}`}
              className="plan-btn plan-btn--ghost"
            >
              ← Wróć do mapy
            </Link>
          </div>
        </section>
      )}

      <section className="plan-section" aria-labelledby="apps-list-heading">
        <h3 id="apps-list-heading" className="plan-section__title">
          Lista wniosków ({forms.length})
        </h3>

        <div className="apps-compact-list">
          {forms.map((item) => {
            const { doc } = item;
            const code = applicationCode(item, params);
            const title = applicationTitle(item, params);
            const receipt = receipts[item.key];
            const fields = buildFields(item);
            const key = item.key;
            const details = applicationDetails(item);
            const attachments = details?.attachments;
            const legalNote = applicationLegalNote(item, details?.section);
            const verificationNote = applicationVerificationNote(item, params);
            const parentBadge = item.sharedWithBothParents
              ? 'Matka / Ojciec'
              : parentLabels[doc.parent_role];
            const duration = formatDurationRange(item.startDate, item.endDate, daysPerWeek);

            return (
              <article
                key={item.key}
                className={receipt ? 'apps-card apps-card--sent' : 'apps-card'}
              >
                <div className="apps-card__header">
                  <div className="apps-card__info">
                    <div className="apps-card__badges">
                      <span className="plan-badge plan-badge--code">{code}</span>
                      <span className="plan-badge plan-badge--navy">{parentBadge}</span>
                      <span
                        className={
                          receipt
                            ? 'plan-badge plan-badge--yes'
                            : doc.submit_to
                              ? 'plan-badge plan-badge--navy'
                              : 'plan-badge plan-badge--no'
                        }
                      >
                        {receipt ? 'Wysłano' : doc.submit_to ? 'Do wysłania' : 'Uzupełnij płatnika'}
                      </span>
                    </div>
                    <h4 className="apps-card__title">{title}</h4>
                    <p className="apps-card__recipient">
                      Do: <strong>{recipientShort(item)}</strong>
                      {item.startDate && item.endDate && (
                        <>
                          {' · '}Okres:{' '}
                          <strong>
                            {formatPolishDate(item.startDate)}–{formatPolishDate(item.endDate)}
                          </strong>
                          {duration && <> ({duration})</>}
                        </>
                      )}
                      {item.workFraction > 0 && (
                        <>
                          {' · '}Praca: <strong>{formatWorkFraction(item.workFraction)}</strong>
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
                      aria-label={`Wyślij ${title} (${parentBadge})`}
                      onClick={() => send([item])}
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
                    {doc.id === 'PARENTAL_REQUEST' &&
                      item.parentCtx.isEmployee &&
                      item.partNumber === 1 &&
                      documents.some(
                        (d) => d.id === 'COMBINED_RATE' && d.parent_role === doc.parent_role,
                      ) && (
                        <p className="apps-preview__subtitle">
                          Jeśli wniosek złożony do {params.combinedRateApplicationDeadlineDays} dni
                          po porodzie obejmował od razu pełny urlop rodzicielski bezpośrednio po
                          macierzyńskim, ten wniosek dotyczy tylko sytuacji dzielenia urlopu lub
                          zmiany terminu.
                        </p>
                      )}
                    {details?.fields.map((field) => {
                      const id = `${key}-${field.id}`;
                      const value = field.value ?? answers[key]?.[field.id] ?? '';
                      const update = (value: string) => {
                        setAnswers((current) => ({
                          ...current,
                          [key]: { ...current[key], [field.id]: value },
                        }));
                        clearError();
                      };
                      return field.value !== undefined ? (
                        <p key={id} className="plan-legal">
                          <strong>{field.label}</strong>
                          <br />
                          {value}
                        </p>
                      ) : (
                        <label key={id} className="plan-field">
                          <span className="plan-field__label">{field.label}</span>
                          {field.options ? (
                            <select
                              id={id}
                              className="plan-field__input"
                              aria-invalid={invalidField === id}
                              value={value}
                              onChange={(event) => update(event.target.value)}
                            >
                              <option value="">Wybierz odpowiedź</option>
                              {field.options.map((option) => (
                                <option value={option.value} key={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              id={id}
                              className="plan-field__input"
                              aria-invalid={invalidField === id}
                              type={field.type ?? 'text'}
                              min={field.type === 'number' ? 0 : undefined}
                              autoComplete="off"
                              value={value}
                              onChange={(event) => update(event.target.value)}
                            />
                          )}
                        </label>
                      );
                    })}
                    {attachments && (
                      <section>
                        <p className="plan-field__label">Załączniki</p>
                        {attachments.length > 0 ? (
                          <ul>
                            {attachments.map((attachment) => (
                              <li key={attachment}>{attachment}</li>
                            ))}
                          </ul>
                        ) : (
                          <p>Brak wymaganych załączników.</p>
                        )}
                      </section>
                    )}
                    <p className="plan-legal">Kanał: {applicationChannel(item)}</p>
                    <p className="plan-legal">Podstawa prawna: {legalNote}</p>
                    {verificationNote && <p className="plan-legal">{verificationNote}</p>}
                    <div>
                      <button
                        type="button"
                        className="plan-btn plan-btn--secondary"
                        onClick={() => openPreview(item)}
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
          {hasTwoParents &&
            ' W planie obojga rodziców każdy rodzic składa własne wnioski na swoje dane.'}
        </p>

        <Link
          to="/login"
          state={{
            returnTo: `${pathname}${search}`,
            applicantRoles: roles.filter((role) =>
              forms.some(({ doc }) => doc.parent_role === role),
            ),
          }}
          className="plan-btn plan-btn--secondary"
        >
          Pobierz dane z mObywatela (symulacja)
        </Link>

        {validationError && !openItem && (
          <div className="plan-callout plan-callout--warning apps-validation-alert" role="alert">
            {validationError}
          </div>
        )}

        {roles.map((role) => {
          const fields = [
            ...new Set(
              forms
                .filter((item) => item.doc.parent_role === role)
                .flatMap(requiredFieldsForApplication),
            ),
          ];
          if (!fields.length) return null;
          if (simulatedIdentities[role]) {
            if (!fields.includes('pesel')) fields.push('pesel');
            fields.push('birthDate');
          }
          return (
            <fieldset key={role} className="plan-section">
              <legend>{parentLabels[role]}</legend>
              <div className="plan-controls__grid">
                {fields.map((field) => {
                  const id = personalId(role, field);
                  return (
                    <label key={field} className="plan-field">
                      <span className="plan-field__label">{PERSONAL_FIELD_LABELS[field]}</span>
                      <input
                        id={id}
                        type={field === 'birthDate' ? 'date' : 'text'}
                        autoComplete="off"
                        inputMode={field === 'pesel' || field === 'bank' ? 'numeric' : undefined}
                        className={
                          invalidField === id
                            ? 'plan-field__input apps-field-error'
                            : 'plan-field__input'
                        }
                        aria-invalid={invalidField === id || undefined}
                        value={personalValue(role, field)}
                        onChange={(event) => {
                          const value = event.target.value;
                          setPersonal((current) => ({
                            ...current,
                            [role]: { ...current[role], [field]: value },
                          }));
                          clearError();
                        }}
                      />
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
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
          code={previewModal.code}
          fields={previewModal.fields}
          attachments={previewModal.attachments}
          legalNote={previewModal.legalNote}
          verificationNote={previewModal.verificationNote}
          delivery={previewModal.delivery}
          mailto={previewModal.mailto}
          pdf={previewModal.pdf}
          onClose={() => setPreviewModal(null)}
        />
      )}
    </div>
  );
}
