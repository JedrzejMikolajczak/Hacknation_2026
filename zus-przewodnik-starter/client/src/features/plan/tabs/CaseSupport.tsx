import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { BenefitParams, CaseInputs, CasePlan } from '@shared/types';
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
import {
  getCaseWarningGuide,
  getMatchingSpecialSituationIds,
  getSpecialSituations,
  isDifficultCase,
} from '../../support/caseSupportData';
import { todayIsoDate } from '../planScenario';
import './SupportTab.css';
import './CaseSupport.css';

export function CaseSupport({
  input,
  plan,
  params,
}: {
  input: CaseInputs;
  plan: CasePlan;
  params: BenefitParams;
}) {
  const { search } = useLocation();
  const { scenario } = useScenario();

  const warnings = plan.outcome.warnings;
  const allSpecialSituations = useMemo(() => getSpecialSituations(params), [params]);
  const matchingSpecialIds = useMemo(() => getMatchingSpecialSituationIds(input), [input]);

  const matchingSpecial = useMemo(
    () => allSpecialSituations.filter((item) => matchingSpecialIds.includes(item.id)),
    [allSpecialSituations, matchingSpecialIds],
  );
  const otherSpecial = useMemo(
    () => allSpecialSituations.filter((item) => !matchingSpecialIds.includes(item.id)),
    [allSpecialSituations, matchingSpecialIds],
  );

  const difficult = isDifficultCase(input);
  const hasCharitableSpecialMatch = matchingSpecialIds.some(
    (id) => id === 'loss' || id === 'premature' || id === 'zaZyciem' || id === 'motherIllness',
  );
  const missingCoreDate =
    input.stage === 'ADOPTION'
      ? !input.adopted_or_foster_child_acceptance_date
      : !input.due_or_birth_date;
  const hasCriticalRisk = warnings.some(
    (warning) => !getCaseWarningGuide(warning, params).isReminder,
  );
  const wizardHref = scenario.situation ? `/wizard?situation=${scenario.situation}` : '/wizard';

  let answerClass = 'support-answer';
  if (difficult) {
    answerClass = 'support-answer support-answer--empathetic';
  } else if (missingCoreDate) {
    answerClass = 'support-answer support-answer--missing';
  } else if (hasCriticalRisk) {
    answerClass = 'support-answer support-answer--warning';
  }

  let keyLeadText: string;
  if (difficult) {
    keyLeadText =
      'Przygotowaliśmy spokojne zestawienie zasad dla Twojej sytuacji oraz bezpłatną pomoc organizacji charytatywnych. Formalności możesz załatwić elektronicznie, bez wizyty w placówce.';
  } else if (missingCoreDate) {
    keyLeadText =
      'Aby sprawdzić wszystkie ryzyka i terminy dla Twojej sytuacji, uzupełnij brakującą datę zdarzenia w kreatorze.';
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
      <h2 className="case-support__heading">Wsparcie</h2>

      <section className={answerClass} aria-labelledby="support-key-heading">
        <h3 id="support-key-heading" className="support-answer__title">
          Najważniejsze dla Ciebie
        </h3>
        <p className="support-answer__text">{keyLeadText}</p>

        {missingCoreDate && (
          <div className="plan-missing-data support-missing-box" role="status">
            <Link to={wizardHref} className="plan-btn plan-btn--primary support-missing-cta">
              Uzupełnij dane ›
            </Link>
          </div>
        )}

        <UserRiskAlerts warnings={warnings} params={params} />
        <MatchedSpecialSituations situations={matchingSpecial} />
      </section>

      <section className="support-more" aria-labelledby="support-more-heading">
        <h3 id="support-more-heading" className="support-more__title">
          Dodatkowe informacje, pomoc i narzędzia
        </h3>

        <div className="support-accordions">
          <GeneralRisksDetails params={params} />
          <OtherSpecialSituationsDetails
            situations={otherSpecial}
            hasMatched={matchingSpecial.length > 0}
          />
          <OrganizationsDetails
            organizations={plan.support.organizations}
            defaultOpen={hasCharitableSpecialMatch}
          />
          <PueSimulationDetails input={input} usePrimarySubmit={!missingCoreDate} />
          <OfficialLinksAndUscDetails
            referenceDate={input.reference_date ?? todayIsoDate()}
            links={plan.support.official_links}
          />
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
