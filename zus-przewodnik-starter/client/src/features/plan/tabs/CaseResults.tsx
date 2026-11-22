import { Link, useLocation } from 'react-router-dom';
import { secondParentTotalForVariant } from '@shared/engine';
import type {
  ApplicantRole,
  BenefitParams,
  CaseEntitlement,
  CaseInputs,
  CasePayer,
  CasePeriod,
  CasePlan,
  CaseWarning,
  PaymentVariant,
} from '@shared/types';
import { DEFAULT_PARAMS, formatRate } from '../../../app/benefitParams';
import { useScenario } from '../../../app/ScenarioContext';
import { formatDaysPl } from '../../leavePlan/leavePlanHelpers';
import { ContributionDebtCertificate, SickLeavePreview } from '../../login/ZusSimulationPanels';
import { benefitLabels, parentLabels, payerLabel, percent, roles } from '../caseLabels';
import {
  combinedRateUnavailable,
  formatPln,
  formatPolishDate,
  livingChildren,
  todayIsoDate,
} from '../planScenario';
import './CaseResults.css';

const PARENT_GROUP_LABELS: Record<ApplicantRole, string> = {
  MOTHER: 'Mama',
  FATHER: 'Tata',
};

function formatPayerClause(payer: CasePayer | null): string {
  if (payer === 'EMPLOYER') return 'wypłaca pracodawca';
  if (payer === 'ZUS') return 'wypłaca ZUS';
  if (payer === 'SPLIT_EMPLOYER_THEN_ZUS') return 'wypłaca najpierw pracodawca, następnie ZUS';
  return 'płatnik do ustalenia';
}

function warningTitle(code: string, params: BenefitParams): string {
  switch (code) {
    case 'SELF_EMPLOYED_DEBT':
      return 'Zadłużenie składkowe (JDG)';
    case 'NO_INSURANCE_ON_BIRTH_DATE':
      return 'Brak ubezpieczenia chorobowego';
    case 'CONTRACT_ENDS_BEFORE_BIRTH':
      return 'Koniec umowy przed porodem';
    case 'SHAM_CONTRACT_RISK':
      return 'Możliwa kontrola tytułu ubezpieczenia';
    case 'BASE_INCREASE_IN_PREGNANCY':
      return 'Podwyższenie składek w ciąży';
    case 'EMPLOYMENT_CONTEXT_RISK':
      return 'Możliwa kontrola warunków zatrudnienia';
    case 'COMBINED_RATE_DEADLINE':
      return `Termin wniosku o stawkę ${formatRate(params.rates.combined)}`;
    case 'WAITING_PERIOD_NOT_MET':
      return 'Okres wyczekiwania na zasiłek chorobowy';
    case 'QUALIFICATION_CHECK':
      return 'Brak potwierdzonych uprawnień';
    case 'SUPPLEMENTARY_TRANSITION':
      return 'Urlop uzupełniający – przepisy przejściowe';
    case 'SUPPLEMENTARY_DATA':
      return 'Brakuje danych do urlopu uzupełniającego';
    default:
      return 'Ważna uwaga do planu';
  }
}

/** Ogólne uwagi (bez własnego tytułu) – w kalkulatorze lądują na samym dole zakładki. */
function isGeneralWarning(warning: CaseWarning, params: BenefitParams): boolean {
  return warningTitle(warning.code, params) === 'Ważna uwaga do planu';
}

function isInfoWarning(warning: CaseWarning): boolean {
  return (
    warning.code === 'COMBINED_RATE_DEADLINE' &&
    !warning.message_pl.toLowerCase().includes('upłynął') &&
    !warning.message_pl.toLowerCase().includes('minął')
  );
}

function splitFirstSentence(text: string): { lead: string; rest: string } {
  const match = text.match(/^(.+?[.!?])(\s+[\s\S]+)$/);
  if (!match) return { lead: text, rest: '' };
  return { lead: match[1], rest: match[2].trim() };
}

/**
 * Ostrzeżenia silnika mają postać „<co się dzieje>. <kontekst>. Co zrobić: <działanie>”.
 * Rodzic najpierw widzi pierwsze zdanie i wyróżnione „Co zrobić”; kontekst chowamy w szczegółach.
 */
function splitWarningMessage(text: string): { lead: string; context: string; action: string } {
  const marker = 'Co zrobić:';
  const index = text.indexOf(marker);
  const before = (index >= 0 ? text.slice(0, index) : text).trim();
  const action = index >= 0 ? text.slice(index + marker.length).trim() : '';
  const { lead, rest } = splitFirstSentence(before);
  return { lead, context: rest, action };
}

function buildParentRightSummary(
  role: ApplicantRole,
  items: CaseEntitlement[],
): { role: ApplicantRole; label: string; sentence: string; anyQualified: boolean } {
  const label = parentLabels[role];
  const qualified = items.filter((item) => item.is_qualified === true);
  const denied = items.filter((item) => item.is_qualified === false);

  if (qualified.length > 0) {
    const maternity = qualified.find(
      (item) => item.benefit_type === 'MATERNITY' || item.benefit_type === 'ADOPTION_MATERNITY',
    );
    const parental = qualified.find((item) => item.benefit_type === 'PARENTAL');
    const paternity = qualified.find((item) => item.benefit_type === 'PATERNITY');
    const sickness = qualified.find((item) => item.benefit_type === 'SICKNESS');
    const supplementary = qualified.find((item) => item.benefit_type === 'SUPPLEMENTARY_MATERNITY');
    const primaryPayer =
      maternity?.who_pays ??
      parental?.who_pays ??
      paternity?.who_pays ??
      sickness?.who_pays ??
      qualified[0].who_pays;
    const payerText = formatPayerClause(primaryPayer);

    if (role === 'MOTHER') {
      if (maternity) {
        if (sickness) {
          return {
            role,
            label,
            sentence: `Przysługuje zasiłek macierzyński i chorobowy w ciąży – ${formatPayerClause(sickness.who_pays ?? primaryPayer)}.`,
            anyQualified: true,
          };
        }
        if (supplementary) {
          return {
            role,
            label,
            sentence: `Przysługuje zasiłek macierzyński, uzupełniający i rodzicielski – ${payerText}.`,
            anyQualified: true,
          };
        }
        if (parental) {
          return {
            role,
            label,
            sentence: `Przysługuje zasiłek macierzyński i rodzicielski – ${payerText}.`,
            anyQualified: true,
          };
        }
        return {
          role,
          label,
          sentence: `Przysługuje zasiłek macierzyński – ${payerText}.`,
          anyQualified: true,
        };
      }
      if (parental) {
        return {
          role,
          label,
          sentence: `Przysługuje zasiłek za urlop rodzicielski – ${payerText}.`,
          anyQualified: true,
        };
      }
      if (sickness) {
        return {
          role,
          label,
          sentence: `Przysługuje zasiłek chorobowy w ciąży – ${payerText}.`,
          anyQualified: true,
        };
      }
    } else {
      const fatherBenefits: string[] = [];
      if (maternity) fatherBenefits.push('zasiłek macierzyński');
      if (parental) fatherBenefits.push('urlop rodzicielski');
      if (paternity) fatherBenefits.push('urlop ojcowski');
      if (fatherBenefits.length > 0) {
        const joined =
          fatherBenefits.length === 1
            ? fatherBenefits[0]
            : `${fatherBenefits.slice(0, -1).join(', ')} i ${fatherBenefits.at(-1)}`;
        return {
          role,
          label,
          sentence: `Przysługuje ${joined} – ${payerText}.`,
          anyQualified: true,
        };
      }
    }

    return {
      role,
      label,
      sentence: `Przysługuje ${benefitLabels[qualified[0].benefit_type].toLowerCase()} – ${payerText}.`,
      anyQualified: true,
    };
  }

  const hasUnknown = items.some((item) => item.is_qualified === null);
  if (denied.length > 0 && !hasUnknown) {
    return {
      role,
      label,
      sentence: 'Świadczenia z ubezpieczenia chorobowego nie przysługują.',
      anyQualified: false,
    };
  }

  const mainDenied = denied.some(
    (item) =>
      item.benefit_type === 'MATERNITY' ||
      item.benefit_type === 'ADOPTION_MATERNITY' ||
      item.benefit_type === 'PARENTAL',
  );
  if (
    mainDenied &&
    !items.some((item) => item.is_qualified === null && item.benefit_type === 'PARENTAL')
  ) {
    return {
      role,
      label,
      sentence: 'Zasiłek macierzyński nie przysługuje.',
      anyQualified: false,
    };
  }

  return {
    role,
    label,
    sentence: 'Uprawnienia do sprawdzenia – uzupełnij dane ubezpieczenia.',
    anyQualified: false,
  };
}

function WarningList({ warnings, params }: { warnings: CaseWarning[]; params: BenefitParams }) {
  if (warnings.length === 0) return null;
  return (
    <ul className="results-risks__list">
      {warnings.map((warning, index) => {
        const info = isInfoWarning(warning);
        const { lead, context, action } = splitWarningMessage(warning.message_pl);
        const hasDetails = Boolean(context || warning.legal_basis);
        return (
          <li
            key={`${warning.code}-${index}`}
            className={info ? 'results-risk results-risk--info' : 'results-risk'}
            role={info ? undefined : 'alert'}
          >
            <strong className="results-risk__title">{warningTitle(warning.code, params)}</strong>
            <p className="results-risk__text">{lead}</p>
            {action && (
              <p className="results-risk__action">
                <span className="results-risk__action-label">Co zrobić:</span> {action}
              </p>
            )}
            {hasDetails && (
              <details className="results-details results-details--inline">
                <summary className="results-details__summary">Szczegóły i podstawa prawna</summary>
                <div className="results-details__body">
                  {context && <p>{context}</p>}
                  {warning.legal_basis && (
                    <p className="results-legal">Podstawa prawna: {warning.legal_basis}</p>
                  )}
                </div>
              </details>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** „4 przysługują · 4 do sprawdzenia” – skrót stanu świadczeń na zwiniętym bloku szczegółów. */
function summarizeBenefitCounts(items: CasePlan['entitlements']): string {
  const yes = items.filter((item) => item.is_qualified === true).length;
  const unknown = items.filter((item) => item.is_qualified === null).length;
  const no = items.filter((item) => item.is_qualified === false).length;
  const parts: string[] = [];
  if (yes > 0) parts.push(`${yes} ${yes === 1 ? 'przysługuje' : 'przysługują'}`);
  if (unknown > 0) parts.push(`${unknown} do sprawdzenia`);
  if (no > 0) parts.push(`${no} ${no === 1 ? 'nie przysługuje' : 'nie przysługują'}`);
  return parts.join(' · ');
}

export function CaseRights({
  plan,
  input,
  params = DEFAULT_PARAMS,
}: {
  plan: CasePlan;
  input?: CaseInputs;
  params?: BenefitParams;
}) {
  const { search } = useLocation();
  const { authSession } = useScenario();
  const visibleRoles: ApplicantRole[] = roles.filter((role) => {
    if (input && !input.co_parenting && role !== input.applicant_role) return false;
    return plan.entitlements.some((item) => item.parent_role === role);
  });
  const activeRoles = visibleRoles.length > 0 ? visibleRoles : [...roles];

  const parentSummaries = activeRoles.map((role) =>
    buildParentRightSummary(
      role,
      plan.entitlements.filter((item) => item.parent_role === role),
    ),
  );
  const anyQualified = parentSummaries.some((summary) => summary.anyQualified);
  const visibleEntitlements = plan.entitlements.filter((item) =>
    activeRoles.includes(item.parent_role),
  );
  const benefitCountSummary = summarizeBenefitCounts(visibleEntitlements);

  return (
    <div className="results-tab">
      <section
        className={anyQualified ? 'results-answer' : 'results-answer results-answer--none'}
        aria-labelledby="rights-answer-heading"
      >
        <h2 id="rights-answer-heading" className="results-answer__title">
          Uprawnienia
        </h2>
        <ul className="results-answer__list">
          {parentSummaries.map((summary) => (
            <li key={summary.role} className="results-answer__item">
              <span className="results-answer__role">{summary.label}:</span>
              <span>{summary.sentence}</span>
            </li>
          ))}
        </ul>
        {plan.outcome.warnings.length === 0 && (
          <p className="results-answer__note">
            Nie wykryto ryzyk utraty świadczeń dla podanych danych.
          </p>
        )}
      </section>

      {plan.outcome.warnings.length > 0 && (
        <section className="results-section" aria-labelledby="rights-warnings-heading">
          <h3 id="rights-warnings-heading" className="results-section__title">
            Na co zwrócić uwagę
          </h3>
          <WarningList warnings={plan.outcome.warnings} params={params} />
        </section>
      )}

      <details className="results-benefits" open={!anyQualified || undefined}>
        <summary className="results-benefits__summary">
          <span className="results-benefits__title">Szczegóły świadczeń</span>
          <span className="results-benefits__count">{benefitCountSummary}</span>
        </summary>
        <div className="results-rights-grid">
          {visibleEntitlements.map((item) => {
            const statusClass =
              item.is_qualified === true
                ? 'results-right-item__status results-right-item__status--yes'
                : item.is_qualified === false
                  ? 'results-right-item__status results-right-item__status--no'
                  : 'results-right-item__status results-right-item__status--unknown';
            const statusLabel =
              item.is_qualified === true
                ? 'Przysługuje'
                : item.is_qualified === false
                  ? 'Nie przysługuje'
                  : 'Do sprawdzenia';
            return (
              <article
                key={`${item.parent_role}-${item.benefit_type}`}
                className="results-right-item"
              >
                <div className="results-right-item__top">
                  <h4 className="results-right-item__title">{benefitLabels[item.benefit_type]}</h4>
                  <span className={statusClass}>{statusLabel}</span>
                </div>
                <p className="results-right-item__meta">
                  {parentLabels[item.parent_role]}
                  {item.is_qualified ? ` · Wypłaca: ${payerLabel(item.who_pays)}` : ''}
                </p>
                <details className="results-details results-details--inline">
                  <summary className="results-details__summary">
                    Uzasadnienie i podstawa prawna
                  </summary>
                  <div className="results-details__body">
                    <p>{item.reason_pl}</p>
                    {item.is_qualified && (
                      <p className="results-legal">
                        Płatnik świadczenia: {payerLabel(item.who_pays)}
                      </p>
                    )}
                    <p className="results-legal">Podstawa prawna: {item.legal_basis}</p>
                  </div>
                </details>
              </article>
            );
          })}
        </div>
      </details>

      {authSession &&
        (input?.employment_type === 'B2B' ||
          authSession.profile.mother.insuranceTitle === 'selfEmployed') && (
          <section className="results-section" aria-label="Zaświadczenie o zadłużeniu ZUS">
            <ContributionDebtCertificate
              payerName={`${authSession.profile.firstName} ${authSession.profile.lastName}`}
              asOfDate={
                input?.sickness_leave_start_date ??
                input?.due_or_birth_date ??
                input?.adopted_or_foster_child_acceptance_date ??
                input?.reference_date ??
                todayIsoDate()
              }
              contributionDebt={input?.debt_amount_pln ?? authSession.zusData.contributionDebt}
              params={params}
            />
          </section>
        )}

      {authSession && authSession.zusData.sickLeaveCertificates.length > 0 && (
        <section className="results-section" aria-label="Podgląd e-ZLA z danych ZUS">
          <SickLeavePreview certificates={authSession.zusData.sickLeaveCertificates} />
        </section>
      )}

      <nav className="results-next" aria-label="Następny krok">
        <Link to={`/plan/calculator${search}`} className="results-next__link">
          Dalej: Kalkulator ›
        </Link>
      </nav>
    </div>
  );
}

function formatWeeksPl(weeks: number): string {
  const rounded = Math.round(weeks);
  if (rounded === 1) return '1 tydzień';
  const mod10 = rounded % 10;
  const mod100 = rounded % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${rounded} tygodnie`;
  }
  return `${rounded} tygodni`;
}

function formatDurationPl(weeks: number, days: number): string {
  if (weeks > 0 && Math.abs(weeks - Math.round(weeks)) < 0.01) {
    return formatWeeksPl(weeks);
  }
  if (weeks >= 1) {
    return `${formatDaysPl(days)} (ok. ${weeks.toLocaleString('pl-PL', { maximumFractionDigits: 1 })} tyg.)`;
  }
  return formatDaysPl(days);
}

function summarizeCasePeriods(periods: CasePeriod[]): {
  days: number;
  weeks: number;
  totalAmount: number | null;
  weightedMonthly: number | null;
} {
  const days = periods.reduce((sum, period) => sum + period.days, 0);
  const weeks = periods.reduce((sum, period) => sum + period.weeks, 0);
  const allHaveTotal =
    periods.length > 0 && periods.every((period) => period.total_amount_pln !== null);
  const totalAmount = allHaveTotal
    ? periods.reduce((sum, period) => sum + (period.total_amount_pln ?? 0), 0)
    : null;
  const priced = periods.filter((period) => period.monthly_amount_pln !== null && period.days > 0);
  const pricedDays = priced.reduce((sum, period) => sum + period.days, 0);
  const weightedMonthly =
    pricedDays > 0
      ? priced.reduce((sum, period) => sum + (period.monthly_amount_pln ?? 0) * period.days, 0) /
        pricedDays
      : null;
  return { days, weeks, totalAmount, weightedMonthly };
}

function Amounts({ period }: { period: CasePeriod }) {
  if (period.denied) {
    return <p className="period-card__denial">Odmowa. {period.denial_reason_pl}</p>;
  }
  if (period.amount_segments?.length) {
    return (
      <ul className="period-card__segments">
        {period.amount_segments.map((segment) => (
          <li key={segment.start_date}>
            {formatPolishDate(segment.start_date)}–{formatPolishDate(segment.end_date)} ·{' '}
            {formatPln(segment.daily_amount_pln)} dziennie · {formatPln(segment.monthly_amount_pln)}{' '}
            za 30 dni
          </li>
        ))}
      </ul>
    );
  }
  if (period.daily_amount_pln === null) {
    return <p className="period-card__dates">Kwota do ustalenia po podaniu podstawy.</p>;
  }
  return (
    <p className="period-card__amounts">
      {formatPln(period.daily_amount_pln)} dziennie · {formatPln(period.monthly_amount_pln)} za 30
      dni
      {period.total_amount_pln !== null && <> · razem {formatPln(period.total_amount_pln)}</>}
    </p>
  );
}

export function PeriodCards({
  periods,
  showAmounts = false,
}: {
  periods: CasePeriod[];
  showAmounts?: boolean;
}) {
  if (!periods.length) return <p>Brak okresów do wyświetlenia dla podanych danych.</p>;

  const presentRoles = Array.from(new Set(periods.map((period) => period.parent_role))).sort(
    (a, b) => (a === b ? 0 : a === 'MOTHER' ? -1 : 1),
  );

  return (
    <div className="period-groups">
      {presentRoles.map((role) => {
        const groupPeriods = periods.filter((period) => period.parent_role === role);
        const activeGroupPeriods = groupPeriods.filter((period) => !period.denied);
        const summary = summarizeCasePeriods(activeGroupPeriods);
        return (
          <section
            key={role}
            className={role === 'FATHER' ? 'period-group period-group--father' : 'period-group'}
            aria-label={`Okresy: ${PARENT_GROUP_LABELS[role]}`}
          >
            <div className="period-group__header">
              <h4 className="period-group__title">{PARENT_GROUP_LABELS[role]}</h4>
              {summary.days > 0 && (
                <span className="period-group__summary">
                  {formatDurationPl(summary.weeks, summary.days)}
                  {showAmounts && summary.totalAmount !== null
                    ? ` · ${formatPln(summary.totalAmount)}`
                    : ''}
                </span>
              )}
            </div>
            <ol className="period-list">
              {groupPeriods.map((period) => (
                <li
                  key={`${period.parent_role}-${period.leave_type}-${period.start_date}-${period.denied}`}
                  className={period.denied ? 'period-card period-card--denied' : 'period-card'}
                >
                  <div className="period-card__top">
                    <strong className="period-card__type">
                      {benefitLabels[period.leave_type]}
                    </strong>
                    {period.rate_percent !== null && (
                      <span className="period-card__rate">{percent(period.rate_percent)}</span>
                    )}
                  </div>
                  <div className="period-card__dates">
                    <time dateTime={period.start_date}>{formatPolishDate(period.start_date)}</time>–
                    <time dateTime={period.end_date}>{formatPolishDate(period.end_date)}</time>
                    {' · '}
                    {formatDaysPl(period.days)} (
                    {period.weeks.toLocaleString('pl-PL', { maximumFractionDigits: 2 })} tyg.)
                    {period.work_fraction > 0 && (
                      <> · praca {percent(period.work_fraction * 100)} etatu</>
                    )}
                    {period.who_pays && <> · {payerLabel(period.who_pays)}</>}
                  </div>
                  {!showAmounts && period.denied && (
                    <p className="period-card__denial">Odmowa. {period.denial_reason_pl}</p>
                  )}
                  {showAmounts && <Amounts period={period} />}
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

export function CaseCalculator({
  plan,
  input,
  params = DEFAULT_PARAMS,
  update,
}: {
  plan: CasePlan;
  input: CaseInputs;
  params?: BenefitParams;
  update: (patch: Partial<CaseInputs>) => void;
}) {
  const { search } = useLocation();
  const { outcome, additional_title_outcomes: additionalTitles } = plan;

  const difficult = input.special_circumstances.stillbirth_or_child_death !== 'NONE';
  const living = livingChildren(input);
  const childLostAll = difficult && living <= 0;

  const activePeriods = outcome.periods.filter((period) => !period.denied);
  const maternityPeriods = activePeriods.filter((period) => period.leave_type !== 'SICKNESS');
  const displayPeriods = maternityPeriods.length > 0 ? maternityPeriods : activePeriods;

  const primaryRole = input.applicant_role;
  const secondaryRole: ApplicantRole = primaryRole === 'MOTHER' ? 'FATHER' : 'MOTHER';
  const primaryPeriods = displayPeriods.filter((period) => period.parent_role === primaryRole);
  const secondaryPeriods = displayPeriods.filter((period) => period.parent_role === secondaryRole);

  const primarySummary = summarizeCasePeriods(primaryPeriods);
  const secondarySummary = summarizeCasePeriods(secondaryPeriods);
  const allParentsTotal =
    primarySummary.totalAmount !== null && secondarySummary.totalAmount !== null
      ? primarySummary.totalAmount + secondarySummary.totalAmount
      : primarySummary.totalAmount;

  const appliedVariant = outcome.applied_payment_variant;
  const variantLabel = childLostAll
    ? `stawka ${formatRate(params.rates.maternity)}`
    : input.parental_only
      ? `stawka ${formatRate(params.rates.parental)}`
      : appliedVariant === 'COMBINED_81_5'
        ? `wariant ${formatRate(params.rates.combined)}`
        : `wariant ${formatRate(params.rates.maternity)} + ${formatRate(params.rates.parental)}`;

  const otherVariant: PaymentVariant =
    appliedVariant === 'COMBINED_81_5' ? 'SPLIT_100_70' : 'COMBINED_81_5';
  const otherVariantLabel =
    otherVariant === 'COMBINED_81_5'
      ? `Wariant ${formatRate(params.rates.combined)}`
      : `Wariant ${formatRate(params.rates.maternity)} + ${formatRate(params.rates.parental)}`;
  // outcome.variants dotyczą wnioskodawcy; do porównania z sumą rodziny doliczamy drugiego
  // rodzica przeliczonego na drugi wariant (w wariancie 81,5% tylko jego nieprzenoszalne tygodnie
  // rodzicielskiego są po 70%, w wariancie 100% + 70% całe rodzicielskie).
  const otherVariantApplicantTotal = outcome.variants[otherVariant];
  const otherVariantSecondaryTotal = secondParentTotalForVariant(
    secondaryPeriods,
    otherVariant,
    params,
  );
  const otherVariantTotal =
    otherVariantApplicantTotal !== null && otherVariantSecondaryTotal !== null
      ? otherVariantApplicantTotal + otherVariantSecondaryTotal
      : otherVariantApplicantTotal;
  const variantDiff =
    otherVariantTotal !== null && allParentsTotal !== null
      ? otherVariantTotal - allParentsTotal
      : null;

  const showVariantSwitch = !childLostAll && !input.parental_only;
  const combinedUnavailable = combinedRateUnavailable(input, params);
  const durationText = formatDurationPl(primarySummary.weeks, primarySummary.days);
  const secondaryLabel = secondaryRole === 'FATHER' ? 'tata' : 'mama';
  const specificWarnings = outcome.warnings.filter((w) => !isGeneralWarning(w, params));
  const generalWarnings = outcome.warnings.filter((w) => isGeneralWarning(w, params));

  return (
    <div className="results-tab">
      <section
        className={
          displayPeriods.length > 0 ? 'results-answer' : 'results-answer results-answer--info'
        }
        aria-labelledby="calc-answer-heading"
      >
        <h2 id="calc-answer-heading" className="results-answer__title">
          Kalkulator
        </h2>

        {displayPeriods.length === 0 ? (
          <>
            <p className="results-answer__headline">
              {additionalTitles?.length
                ? 'Z tytułu głównego świadczenie nie przysługuje.'
                : 'Dla podanych danych świadczenie nie przysługuje.'}
            </p>
            <p className="results-answer__sub">
              {outcome.denial_or_reduction_reason_pl ??
                'Sprawdź przyczyny w zakładce Uprawnienia lub uzupełnij dane.'}
            </p>
          </>
        ) : (
          <>
            {primarySummary.weightedMonthly !== null ? (
              <p className="results-answer__headline">
                {difficult
                  ? `Szacowany zasiłek: ok. ${formatPln(primarySummary.weightedMonthly)} miesięcznie przez ${durationText} (${variantLabel}).`
                  : `Otrzymasz ok. ${formatPln(primarySummary.weightedMonthly)} miesięcznie przez ${durationText} (${variantLabel}).`}
              </p>
            ) : (
              <>
                <p className="results-answer__headline">
                  Wymiar świadczenia: {durationText} ({variantLabel}).
                </p>
                <p className="results-answer__sub">
                  Podaj podstawę wymiaru, aby zobaczyć dokładną kwotę miesięczną i łączną.
                </p>
              </>
            )}

            {primarySummary.totalAmount !== null ? (
              <p className="results-answer__total">
                {additionalTitles?.length ? 'Łącznie w planie głównym:' : 'Łącznie:'}{' '}
                <strong>{formatPln(allParentsTotal)}</strong>
                {outcome.benefit_base_pln !== null && (
                  <span className="results-answer__sub">
                    {' '}
                    · podstawa wymiaru: {formatPln(outcome.benefit_base_pln)}
                  </span>
                )}
                {secondarySummary.days > 0 && (
                  <span className="results-answer__sub">
                    {' '}
                    (w tym {secondaryLabel}:{' '}
                    {formatDurationPl(secondarySummary.weeks, secondarySummary.days)}
                    {secondarySummary.totalAmount !== null
                      ? ` – ${formatPln(secondarySummary.totalAmount)}`
                      : ' – podaj podstawę, aby policzyć kwotę'}
                    )
                  </span>
                )}
              </p>
            ) : (
              secondarySummary.days > 0 && (
                <p className="results-answer__sub">
                  Dodatkowo {secondaryLabel}:{' '}
                  {formatDurationPl(secondarySummary.weeks, secondarySummary.days)}
                  {secondarySummary.totalAmount !== null
                    ? ` – ${formatPln(secondarySummary.totalAmount)}`
                    : '.'}
                </p>
              )
            )}

            {showVariantSwitch && (
              <p className="results-answer__compare">
                {otherVariantTotal !== null ? (
                  <>
                    {otherVariantLabel}: łącznie <strong>{formatPln(otherVariantTotal)}</strong>
                    {variantDiff !== null && Math.abs(variantDiff) >= 0.01 && (
                      <span>
                        {' '}
                        ({variantDiff > 0 ? '+' : ''}
                        {formatPln(variantDiff)} względem wybranego)
                      </span>
                    )}
                  </>
                ) : otherVariant === 'COMBINED_81_5' ? (
                  <>
                    {otherVariantLabel}: dostępny przy wniosku złożonym w ciągu{' '}
                    {params.combinedRateApplicationDeadlineDays} dni od porodu (podaj datę wniosku u
                    płatnika, aby porównać).
                  </>
                ) : (
                  <>
                    {otherVariantLabel}: podaj podstawę wymiaru, aby porównać kwotę łączną obu
                    wariantów.
                  </>
                )}
              </p>
            )}
          </>
        )}
      </section>

      {showVariantSwitch && (
        <section className="results-variant-bar" aria-label="Wybór wariantu wypłaty">
          <span className="plan-field__label">Wariant wypłaty</span>
          <div className="results-variant-bar__segmented" role="group" aria-label="Wariant wypłaty">
            <button
              type="button"
              className={
                input.requested_payment_variant === 'COMBINED_81_5' && !combinedUnavailable
                  ? 'results-variant-bar__btn results-variant-bar__btn--active'
                  : 'results-variant-bar__btn'
              }
              aria-pressed={input.requested_payment_variant === 'COMBINED_81_5' && !combinedUnavailable}
              disabled={combinedUnavailable}
              onClick={() => update({ requested_payment_variant: 'COMBINED_81_5' })}
            >
              {formatRate(params.rates.combined)} za cały okres
            </button>
            <button
              type="button"
              className={
                input.requested_payment_variant === 'SPLIT_100_70' || combinedUnavailable
                  ? 'results-variant-bar__btn results-variant-bar__btn--active'
                  : 'results-variant-bar__btn'
              }
              aria-pressed={input.requested_payment_variant === 'SPLIT_100_70' || combinedUnavailable}
              onClick={() => update({ requested_payment_variant: 'SPLIT_100_70' })}
            >
              {formatRate(params.rates.maternity)} + {formatRate(params.rates.parental)}
            </button>
          </div>
        </section>
      )}

      {additionalTitles?.map(({ employment_type: title, outcome: result, documents }, index) => {
        const titleLabel = { UOP: 'Umowa o pracę', ZLECENIE: 'Umowa zlecenie', B2B: 'JDG' }[title];
        const periods = [...result.periods, ...result.employer_sick_pay];
        const payer = title === 'ZLECENIE' && result.who_pays === 'EMPLOYER'
          ? 'wypłaca zleceniodawca'
          : formatPayerClause(result.who_pays);
        return (
          <section className="results-answer results-answer--info" key={index}>
            <h2 className="results-answer__title">Dodatkowy tytuł {index + 1} · {titleLabel}</h2>
            {result.is_qualified ? (
              <p className="results-answer__sub">
                Łącznie {formatPln(result.calculated_amount_pln)} · podstawa{' '}
                {formatPln(result.benefit_base_pln)} · {payer}
              </p>
            ) : (
              <p className="results-answer__sub">{result.decision_summary_pl}</p>
            )}
            {periods.length > 0 && (
              <details className="results-details">
                <summary className="results-details__summary">Okresy i kwoty z tego tytułu</summary>
                <div className="results-details__body">
                  <PeriodCards periods={periods} showAmounts />
                </div>
              </details>
            )}
            {documents.length > 0 && (
              <details className="results-details">
                <summary className="results-details__summary">Dokumenty z tego tytułu</summary>
                <ul className="results-details__body">
                  {documents.map((document, documentIndex) => (
                    <li key={`${document.id}-${documentIndex}`}>{document.name_pl}</li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        );
      })}

      {specificWarnings.length > 0 && (
        <section aria-label="Ostrzeżenia kalkulatora">
          <WarningList warnings={specificWarnings} params={params} />
        </section>
      )}

      <div className="results-details-stack">
        <details className="results-details">
          <summary className="results-details__summary">Zobacz okresy i kwoty</summary>
          <div className="results-details__body">
            <PeriodCards periods={outcome.periods} showAmounts />
          </div>
        </details>

        {outcome.employer_sick_pay.length > 0 && (
          <details className="results-details">
            <summary className="results-details__summary">
              Wynagrodzenie chorobowe od pracodawcy
            </summary>
            <div className="results-details__body">
              <PeriodCards periods={outcome.employer_sick_pay} showAmounts />
            </div>
          </details>
        )}

        <details className="results-details">
          <summary className="results-details__summary">
            Zmień podstawę wymiaru lub datę wniosku (
            {outcome.benefit_base_pln !== null
              ? formatPln(outcome.benefit_base_pln)
              : 'brak podstawy'}
            )
          </summary>
          <div className="results-details__body">
            <div className="case-plan-fields">
              <label className="plan-field">
                <span className="plan-field__label">Podstawa wymiaru w PLN</span>
                <input
                  className="plan-field__input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={input.benefit_base_amount_pln ?? ''}
                  onChange={(event) =>
                    update({
                      benefit_base_amount_pln:
                        event.target.value === '' ? null : Number(event.target.value),
                    })
                  }
                />
              </label>

              {input.co_parenting && input.other_parent && (
                <label className="plan-field">
                  <span className="plan-field__label">Podstawa wymiaru drugiego rodzica w PLN</span>
                  <input
                    className="plan-field__input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={input.other_parent.benefit_base_amount_pln ?? ''}
                    onChange={(event) =>
                      update({
                        other_parent: {
                          ...input.other_parent!,
                          benefit_base_amount_pln:
                            event.target.value === '' ? null : Number(event.target.value),
                        },
                      })
                    }
                  />
                </label>
              )}

              <label className="plan-field">
                <span className="plan-field__label">Data złożenia wniosku u płatnika</span>
                <input
                  className="plan-field__input"
                  type="date"
                  value={input.application_to_payer_date ?? input.application_date ?? ''}
                  onChange={(event) =>
                    update({
                      application_to_payer_date: event.target.value || undefined,
                      application_date: event.target.value || null,
                      days_from_birth_to_application: null,
                    })
                  }
                />
              </label>
            </div>
          </div>
        </details>

        {(outcome.legal_basis_cited.length > 0 || outcome.decision_summary_pl) && (
          <details className="results-details">
            <summary className="results-details__summary">
              Podstawa prawna i szczegóły wyliczenia
            </summary>
            <div className="results-details__body">
              <p>{outcome.decision_summary_pl}</p>
              {outcome.denial_or_reduction_reason_pl && (
                <p className="results-legal">{outcome.denial_or_reduction_reason_pl}</p>
              )}
              {outcome.benefit_base_pln !== null && (
                <p className="results-legal">
                  Podstawa wymiaru: <strong>{formatPln(outcome.benefit_base_pln)}</strong> · Wariant
                  zastosowany:{' '}
                  <strong>
                    {appliedVariant === 'COMBINED_81_5'
                      ? formatRate(params.rates.combined)
                      : `${formatRate(params.rates.maternity)} i ${formatRate(params.rates.parental)}`}
                  </strong>
                </p>
              )}
              {outcome.legal_basis_cited.length > 0 && (
                <ul className="results-legal-list">
                  {outcome.legal_basis_cited.map((basis) => (
                    <li key={basis}>{basis}</li>
                  ))}
                </ul>
              )}
            </div>
          </details>
        )}
      </div>

      {generalWarnings.length > 0 && (
        <section aria-label="Ważne uwagi do planu">
          <WarningList warnings={generalWarnings} params={params} />
        </section>
      )}

      <nav className="results-next" aria-label="Następny krok">
        <Link to={`/plan/leave-plan${search}`} className="results-next__link">
          Dalej: Plan urlopów ›
        </Link>
      </nav>
    </div>
  );
}
