import { Link, useLocation } from 'react-router-dom';
import type { EligibilityResult, Entitlement, ParentRole, Payer, Warning } from '@shared/types';
import { DEFAULT_PARAMS, formatRate } from '../../../app/benefitParams';
import {
  formatBenefitName,
  formatParentRole,
  formatPayer,
  formatPolishDate,
} from '../planScenario';
import './EntitlementsTab.css';

interface EntitlementsTabProps {
  eligibility: EligibilityResult;
  missingFields?: string[];
  wizardHref?: string;
  hasMotherInPlan?: boolean;
}

const WARNING_TITLES: Record<Warning['code'], string> = {
  SELF_EMPLOYED_DEBT: 'Zadłużenie składkowe (JDG)',
  NO_INSURANCE_ON_BIRTH_DATE: 'Brak ubezpieczenia chorobowego',
  CONTRACT_ENDS_BEFORE_BIRTH: 'Koniec umowy przed porodem',
  SHAM_CONTRACT_RISK: 'Możliwa kontrola tytułu ubezpieczenia',
  BASE_INCREASE_IN_PREGNANCY: 'Podwyższenie składek w ciąży',
  COMBINED_RATE_DEADLINE: `Termin wniosku o stawkę ${formatRate(DEFAULT_PARAMS.rates.combined)}`,
  WAITING_PERIOD_NOT_MET: 'Okres wyczekiwania na zasiłek chorobowy',
};

function formatShortPayer(payer: Payer | null): string {
  if (payer === 'employer') return 'pracodawca';
  if (payer === 'zus') return 'ZUS';
  return 'pracodawca lub ZUS';
}

function formatPayerClause(payer: Payer | null): string {
  if (payer === 'employer') return 'wypłaca pracodawca';
  if (payer === 'zus') return 'wypłaca ZUS';
  return 'wypłaca pracodawca lub ZUS (zależnie od wielkości firmy)';
}

function buildParentSummary(
  role: ParentRole,
  items: Entitlement[],
): {
  role: ParentRole;
  label: string;
  sentence: string;
  anyEntitled: boolean;
} {
  const label = role === 'mother' ? 'Matka' : 'Ojciec';
  const maternity = items.find((item) => item.benefit === 'maternityBenefit');
  const sickness = items.find((item) => item.benefit === 'sicknessBenefit');
  const equivalent = items.find((item) => item.benefit === 'maternityEquivalentBenefit');
  const anyEntitled = items.some((item) => item.entitled);

  if (maternity?.entitled) {
    const payerText = formatPayerClause(maternity.payer);
    if (sickness?.entitled) {
      const sentence =
        sickness.payer === maternity.payer
          ? `Przysługuje zasiłek macierzyński i chorobowy w ciąży – ${payerText}.`
          : `Przysługuje zasiłek macierzyński (${payerText}) oraz świadczenia chorobowe w ciąży.`;
      return { role, label, sentence, anyEntitled: true };
    }
    if (sickness && !sickness.entitled) {
      return {
        role,
        label,
        sentence: `Przysługuje zasiłek macierzyński – ${payerText} (zasiłek chorobowy w ciąży obecnie nie przysługuje).`,
        anyEntitled: true,
      };
    }
    if (equivalent?.entitled) {
      return {
        role,
        label,
        sentence: `Przysługuje zasiłek macierzyński oraz zasiłek do dnia porodu – ${payerText}.`,
        anyEntitled: true,
      };
    }
    return {
      role,
      label,
      sentence: `Przysługuje zasiłek macierzyński – ${payerText}.`,
      anyEntitled: true,
    };
  }

  if (maternity && !maternity.entitled) {
    if (sickness?.entitled) {
      return {
        role,
        label,
        sentence: `Zasiłek macierzyński nie przysługuje; przysługuje zasiłek chorobowy w ciąży – ${formatPayerClause(sickness.payer)}.`,
        anyEntitled: true,
      };
    }
    if (equivalent?.entitled) {
      return {
        role,
        label,
        sentence: `Zasiłek macierzyński nie przysługuje; przysługuje zasiłek do dnia porodu – ${formatPayerClause(equivalent.payer)}.`,
        anyEntitled: true,
      };
    }
    return {
      role,
      label,
      sentence: 'Zasiłek macierzyński nie przysługuje.',
      anyEntitled: false,
    };
  }

  const firstEntitled = items.find((item) => item.entitled);
  if (firstEntitled) {
    return {
      role,
      label,
      sentence: `Przysługuje ${formatBenefitName(firstEntitled.benefit).toLowerCase()} – ${formatPayerClause(firstEntitled.payer)}.`,
      anyEntitled: true,
    };
  }

  return {
    role,
    label,
    sentence: 'Świadczenia z ubezpieczenia chorobowego nie przysługują.',
    anyEntitled: anyEntitled,
  };
}

function getWarningPlainAction(warning: Warning): string {
  switch (warning.code) {
    case 'SELF_EMPLOYED_DEBT':
      return 'Zasiłek nie zostanie wypłacony do czasu spłaty zaległości. Spłać całe zadłużenie w ZUS, aby odblokować prawo do wypłaty.';
    case 'NO_INSURANCE_ON_BIRTH_DATE':
      return 'Bez czynnego ubezpieczenia chorobowego zasiłek z ZUS nie przysługuje. Sprawdź możliwość uzyskania świadczenia rodzicielskiego („Kosiniakowe”) w urzędzie gminy.';
    case 'CONTRACT_ENDS_BEFORE_BIRTH':
      return 'Ubezpieczenie wygasa przed datą zdarzenia, co może pozbawić prawa do zasiłku. Sprawdź, czy umowa przedłuży się do dnia porodu, albo zadbaj o ciągłość ubezpieczenia.';
    case 'SHAM_CONTRACT_RISK':
      return 'ZUS może skontrolować tytuł ubezpieczenia i zakwestionować prawo do zasiłku. Zachowaj dokumenty potwierdzające faktyczną pracę lub prowadzenie firmy.';
    case 'BASE_INCREASE_IN_PREGNANCY':
      return 'ZUS może zakwestionować podniesienie składek w ciąży i obniżyć podstawę zasiłku. Zachowaj dokumenty uzasadniające zmianę zarobków lub składek.';
    case 'COMBINED_RATE_DEADLINE': {
      const dateMatch = warning.message.match(/\d{4}-\d{2}-\d{2}/);
      const formattedDate = dateMatch ? formatPolishDate(dateMatch[0]) : null;
      if (warning.message.includes('upłynął')) {
        return formattedDate
          ? `Minął termin (${formattedDate}) na wybór jednolitej stawki. Obowiązuje wariant standardowy.`
          : 'Minął termin na wybór jednolitej stawki. Obowiązuje wariant standardowy.';
      }
      return formattedDate
        ? `Złóż wniosek o pełny urlop do ${formattedDate}, inaczej jednolita stawka nie będzie obowiązywać.`
        : 'Złóż wniosek o pełny urlop w ustawowym terminie, aby otrzymać jednolitą stawkę.';
    }
    case 'WAITING_PERIOD_NOT_MET':
      return 'Zasiłek chorobowy w ciąży nie przysługuje przed upływem okresu wyczekiwania. Zasiłek macierzyński przysługuje bez okresu wyczekiwania.';
  }
}

export function EntitlementsTab({
  eligibility,
  missingFields = [],
  wizardHref = '/wizard',
  hasMotherInPlan = true,
}: EntitlementsTabProps) {
  const { search } = useLocation();

  if (missingFields.length > 0) {
    return (
      <div className="entitlements-tab">
        <section
          className="entitlements-answer entitlements-answer--missing"
          aria-labelledby="entitlements-missing-heading"
        >
          <div className="plan-missing-data" role="status">
            <h2 id="entitlements-missing-heading" className="entitlements-answer__title">
              Uzupełnij dane, aby sprawdzić uprawnienia
            </h2>
            <p className="entitlements-answer__lead">
              Nie przyjmujemy zmyślonych założeń. Do oceny uprawnień brakuje:
            </p>
            <ul className="plan-missing-data__list">
              {missingFields.map((field) => (
                <li key={field}>{field}</li>
              ))}
            </ul>
            <Link to={wizardHref} className="plan-btn plan-btn--primary">
              Uzupełnij dane ›
            </Link>
          </div>
        </section>

        <nav className="entitlements-next" aria-label="Następny krok">
          <Link to={`/plan/calculator${search}`} className="entitlements-next__link">
            Dalej: Kalkulator ›
          </Link>
        </nav>
      </div>
    );
  }

  const visibleEntitlements = hasMotherInPlan
    ? eligibility.entitlements
    : eligibility.entitlements.filter((item) => item.parentRole === 'father');

  const visibleWarnings = hasMotherInPlan
    ? eligibility.warnings
    : eligibility.warnings.filter((w) => w.code !== 'NO_INSURANCE_ON_BIRTH_DATE');

  const parentRoles: ParentRole[] = (['mother', 'father'] as ParentRole[]).filter((role) =>
    visibleEntitlements.some((item) => item.parentRole === role),
  );

  const parentSummaries = parentRoles.map((role) =>
    buildParentSummary(
      role,
      visibleEntitlements.filter((item) => item.parentRole === role),
    ),
  );

  const anyParentEntitled = parentSummaries.some((summary) => summary.anyEntitled);

  return (
    <div className="entitlements-tab">
      <section
        className={
          anyParentEntitled
            ? 'entitlements-answer'
            : 'entitlements-answer entitlements-answer--none'
        }
        aria-labelledby="entitlements-answer-heading"
      >
        <h2 id="entitlements-answer-heading" className="entitlements-answer__title">
          Twoje uprawnienia
        </h2>
        <ul className="entitlements-answer__list">
          {parentSummaries.map((summary) => (
            <li key={summary.role} className="entitlements-answer__item">
              <span className="entitlements-answer__role">{summary.label}:</span>
              <span>{summary.sentence}</span>
            </li>
          ))}
        </ul>
        {!hasMotherInPlan && (
          <p className="entitlements-answer__note">
            Plan obejmuje uprawnienia samodzielnego ojca (urlop rodzicielski i ojcowski).
          </p>
        )}
        {visibleWarnings.length === 0 && (
          <p className="entitlements-answer__note">
            Nie wykryto ryzyk utraty świadczeń dla podanych danych.
          </p>
        )}
      </section>

      {visibleWarnings.length > 0 && (
        <section className="entitlements-section" aria-labelledby="warnings-heading">
          <h2 id="warnings-heading" className="entitlements-section__title">
            Na co zwrócić uwagę
          </h2>
          <ul className="entitlements-risks__list">
            {visibleWarnings.map((warning) => {
              const isDeadlineReminder =
                warning.code === 'COMBINED_RATE_DEADLINE' && !warning.message.includes('upłynął');
              return (
                <li
                  key={`${warning.code}-${warning.message}`}
                  className={
                    isDeadlineReminder
                      ? 'entitlements-risk entitlements-risk--info'
                      : 'entitlements-risk'
                  }
                  role={isDeadlineReminder ? undefined : 'alert'}
                >
                  <strong className="entitlements-risk__title">
                    {WARNING_TITLES[warning.code]}
                  </strong>
                  <p className="entitlements-risk__action">{getWarningPlainAction(warning)}</p>
                  <details className="entitlements-details">
                    <summary className="entitlements-details__summary">
                      Szczegóły i podstawa prawna
                    </summary>
                    <div className="entitlements-details__body">
                      <p>{warning.message}</p>
                      {warning.legalBasis && (
                        <p className="entitlements-legal">Podstawa prawna: {warning.legalBasis}</p>
                      )}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="entitlements-section" aria-labelledby="entitlements-heading">
        <h2 id="entitlements-heading" className="entitlements-section__title">
          Szczegóły świadczeń
        </h2>

        <div className="entitlements-grid">
          {visibleEntitlements.map((item) => (
            <article key={`${item.benefit}-${item.parentRole}`} className="entitlement-item">
              <div className="entitlement-item__top">
                <h3 className="entitlement-item__title">{formatBenefitName(item.benefit)}</h3>
                <span
                  className={
                    item.entitled
                      ? 'entitlement-item__status entitlement-item__status--yes'
                      : 'entitlement-item__status entitlement-item__status--no'
                  }
                >
                  {item.entitled ? 'Przysługuje' : 'Nie przysługuje'}
                </span>
              </div>

              <p className="entitlement-item__meta">
                {formatParentRole(item.parentRole)}
                {item.entitled ? ` · Wypłaca: ${formatShortPayer(item.payer)}` : ''}
              </p>

              <details className="entitlements-details">
                <summary className="entitlements-details__summary">
                  Uzasadnienie i podstawa prawna
                </summary>
                <div className="entitlements-details__body">
                  <p>{item.reason.message}</p>
                  {item.entitled && (
                    <p className="entitlements-legal">
                      Płatnik świadczenia: {formatPayer(item.payer)}
                    </p>
                  )}
                  {item.reason.legalBasis && (
                    <p className="entitlements-legal">Podstawa prawna: {item.reason.legalBasis}</p>
                  )}
                </div>
              </details>
            </article>
          ))}
        </div>
      </section>

      <nav className="entitlements-next" aria-label="Następny krok">
        <Link to={`/plan/calculator${search}`} className="entitlements-next__link">
          Dalej: Kalkulator ›
        </Link>
      </nav>
    </div>
  );
}
