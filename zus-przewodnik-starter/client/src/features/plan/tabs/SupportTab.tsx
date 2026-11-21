import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import type { BenefitParams, ScenarioInput, Warning } from '@shared/types';
import { useScenario } from '../../../app/ScenarioContext';
import { FaqDetails } from '../../support/FaqSection';
import { OrganizationsDetails } from '../../support/OrganizationsSection';
import {
  OfficialLinksAndUscDetails,
  PueSimulationDetails,
} from '../../support/PueSimulationSection';
import { GeneralRisksDetails, UserRiskAlerts } from '../../support/RiskAlertsSection';
import {
  MatchedSpecialSituations,
  OtherSpecialSituationsDetails,
} from '../../support/SpecialSituationsSection';
import { computeScenarioWarningsLocally, fetchScenarioWarnings } from '../../support/supportApi';
import {
  getMatchingSpecialSituationIds,
  getOrderedOrganizations,
  getSpecialSituations,
} from '../../support/supportData';
import { getMissingFieldsForTab, isDifficultSituation, resolvePlanContext } from '../planScenario';
import './SupportTab.css';

interface SupportTabProps {
  scenario: ScenarioInput;
  params: BenefitParams;
}

export function SupportTab({ scenario, params }: SupportTabProps) {
  const { search } = useLocation();
  const [searchParams] = useSearchParams();
  const { scenario: draft } = useScenario();

  const resolvedMeta = useMemo(
    () => resolvePlanContext(draft, searchParams).meta,
    [draft, searchParams],
  );

  const hasMotherInPlan = resolvedMeta.hasMotherInPlan;
  const motherInsuranceKnown =
    hasMotherInPlan &&
    (scenario.mother.insuranceTitle !== 'none' || resolvedMeta.motherInsuranceKnown);
  const fatherInsuranceKnown =
    scenario.father !== null &&
    (scenario.father.insuranceTitle !== 'none' || resolvedMeta.fatherInsuranceKnown);

  const missingFields = useMemo(
    () =>
      getMissingFieldsForTab('entitlements', scenario, {
        hasMotherInPlan,
        motherInsuranceKnown,
        fatherInsuranceKnown,
      }),
    [scenario, hasMotherInPlan, motherInsuranceKnown, fatherInsuranceKnown],
  );

  const hasMissingData = missingFields.length > 0;
  const sicknessStartDate = draft.pregnancySickLeave?.startDate ?? undefined;

  const localWarnings = useMemo(() => {
    if (hasMissingData) return [];
    return computeScenarioWarningsLocally(scenario, params, {
      hasMotherInPlan,
      sicknessStartDate,
    });
  }, [hasMissingData, scenario, params, hasMotherInPlan, sicknessStartDate]);

  const [apiWarnings, setApiWarnings] = useState<{ key: string; warnings: Warning[] } | null>(null);
  const scenarioKey = useMemo(
    () =>
      JSON.stringify({
        scenario,
        hasMotherInPlan,
        sicknessStartDate,
        paramsVersion: params.version,
      }),
    [scenario, hasMotherInPlan, sicknessStartDate, params.version],
  );

  useEffect(() => {
    if (hasMissingData) return;
    let active = true;
    void fetchScenarioWarnings(scenario, params, { hasMotherInPlan, sicknessStartDate }).then(
      (warnings) => {
        if (!active) return;
        setApiWarnings({ key: scenarioKey, warnings });
      },
    );
    return () => {
      active = false;
    };
  }, [hasMissingData, scenario, params, hasMotherInPlan, sicknessStartDate, scenarioKey]);

  const warnings = hasMissingData
    ? []
    : apiWarnings?.key === scenarioKey
      ? apiWarnings.warnings
      : localWarnings;

  const allSpecialSituations = useMemo(() => getSpecialSituations(params), [params]);
  const matchingSpecialIds = useMemo(
    () => getMatchingSpecialSituationIds(scenario, params),
    [scenario, params],
  );

  const matchingSpecial = useMemo(
    () => allSpecialSituations.filter((item) => matchingSpecialIds.includes(item.id)),
    [allSpecialSituations, matchingSpecialIds],
  );
  const otherSpecial = useMemo(
    () => allSpecialSituations.filter((item) => !matchingSpecialIds.includes(item.id)),
    [allSpecialSituations, matchingSpecialIds],
  );

  const organizations = useMemo(
    () => getOrderedOrganizations(matchingSpecialIds),
    [matchingSpecialIds],
  );

  const difficult = isDifficultSituation(scenario);
  const hasCharitableSpecialMatch = matchingSpecialIds.some(
    (id) =>
      id === 'loss' ||
      id === 'motherDeceased' ||
      id === 'premature' ||
      id === 'zaZyciem' ||
      id === 'motherIllness',
  );
  const wizardHref = `/wizard?situation=${scenario.situation}`;

  const hasCriticalRisk = warnings.some(
    (w) => w.code !== 'COMBINED_RATE_DEADLINE' || w.message.includes('upłynął'),
  );

  let answerClass = 'support-answer';
  if (difficult) {
    answerClass = 'support-answer support-answer--empathetic';
  } else if (hasMissingData) {
    answerClass = 'support-answer support-answer--missing';
  } else if (hasCriticalRisk) {
    answerClass = 'support-answer support-answer--warning';
  }

  let keyLeadText: string;
  if (difficult) {
    keyLeadText =
      'Przygotowaliśmy spokojne zestawienie zasad dla Twojej sytuacji oraz bezpłatną pomoc organizacji charytatywnych. Formalności możesz załatwić elektronicznie, bez wizyty w placówce.';
  } else if (hasMissingData) {
    keyLeadText =
      'Aby sprawdzić ryzyka utraty lub obniżenia zasiłku dla Twojej sytuacji, uzupełnij brakujące dane w kreatorze.';
  } else if (warnings.length > 0 && matchingSpecial.length > 0) {
    keyLeadText =
      'Poniżej znajdziesz kwestie wymagające uwagi oraz zasady dla wskazanej sytuacji szczególnej.';
  } else if (warnings.length > 0) {
    keyLeadText =
      warnings.length === 1
        ? 'Dla podanych danych wykryliśmy 1 kwestię wymagającą uwagi.'
        : `Dla podanych danych wykryliśmy ${warnings.length} kwestie wymagające uwagi.`;
  } else if (matchingSpecial.length > 0) {
    keyLeadText =
      'Nie wykryliśmy ryzyk utraty świadczeń. Poniżej znajdziesz zasady dla wskazanej sytuacji szczególnej.';
  } else {
    keyLeadText =
      'Dla podanych danych nie wykryliśmy ryzyk utraty ani obniżenia zasiłku. Poniżej znajdziesz dodatkowe informacje, organizacje charytatywne oraz kontakt z ZUS.';
  }

  return (
    <div className="support-tab">
      <section className={answerClass} aria-labelledby="support-key-heading">
        <h2 id="support-key-heading" className="support-answer__title">
          Najważniejsze dla Ciebie
        </h2>
        <p className="support-answer__text">{keyLeadText}</p>

        {hasMissingData && (
          <div className="plan-missing-data support-missing-box" role="status">
            <ul className="plan-missing-data__list">
              {missingFields.map((field) => (
                <li key={field}>{field}</li>
              ))}
            </ul>
            <Link to={wizardHref} className="plan-btn plan-btn--primary support-missing-cta">
              Uzupełnij dane ›
            </Link>
          </div>
        )}

        <UserRiskAlerts warnings={warnings} params={params} />
        <MatchedSpecialSituations situations={matchingSpecial} />
      </section>

      <section className="support-more" aria-labelledby="support-more-heading">
        <h2 id="support-more-heading" className="support-more__title">
          Dodatkowe informacje, pomoc i narzędzia
        </h2>

        <div className="support-accordions">
          <GeneralRisksDetails params={params} />
          <OtherSpecialSituationsDetails
            situations={otherSpecial}
            hasMatched={matchingSpecial.length > 0}
          />
          <OrganizationsDetails
            organizations={organizations}
            defaultOpen={hasCharitableSpecialMatch}
          />
          <PueSimulationDetails
            scenario={scenario}
            hasMotherInPlan={hasMotherInPlan}
            motherInsuranceKnown={motherInsuranceKnown}
            usePrimarySubmit={!hasMissingData}
          />
          <OfficialLinksAndUscDetails referenceDate={scenario.referenceDate} />
          <FaqDetails params={params} />
        </div>
      </section>

      <nav className="support-next-nav" aria-label="Powrót do planu">
        <Link to={`/plan${search}`} className="support-next-link">
          Wróć do planu ›
        </Link>
      </nav>
    </div>
  );
}
