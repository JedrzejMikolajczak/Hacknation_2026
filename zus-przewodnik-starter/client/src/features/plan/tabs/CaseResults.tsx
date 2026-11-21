import type { CaseInputs, CasePeriod, CasePlan } from '@shared/types';
import { benefitLabels, parentLabels, payerLabel, percent, roles } from '../caseLabels';
import { formatPln, formatPolishDate } from '../planScenario';

export function CaseRights({ plan }: { plan: CasePlan }) {
  return <>
    <h2>Uprawnienia</h2>
    <div className="case-plan-grid">{roles.map((role) => <section className="case-plan-card" key={role}>
      <h3>{parentLabels[role]}</h3>
      <ul>{plan.entitlements.filter((item) => item.parent_role === role).map((item) => <li key={item.benefit_type}>
        <strong>{benefitLabels[item.benefit_type]}</strong>{' · '}
        {item.is_qualified === true ? 'Przysługuje' : item.is_qualified === false ? 'Nie przysługuje' : 'Do sprawdzenia'}
        {item.is_qualified && <> · Płatnik: {payerLabel(item.who_pays)}</>}
        <p>{item.reason_pl} <small>{item.legal_basis}</small></p>
      </li>)}</ul>
    </section>)}</div>
    {plan.outcome.warnings.length > 0 && <section className="plan-callout plan-callout--warning" aria-label="Ostrzeżenia">
      <h3>Ostrzeżenia</h3>
      <ul>{plan.outcome.warnings.map((item) => <li key={item.code}>{item.message_pl} {item.legal_basis && <small>{item.legal_basis}</small>}</li>)}</ul>
    </section>}
  </>;
}

function Amounts({ period }: { period: CasePeriod }) {
  if (period.denied) return <p>Odmowa. {period.denial_reason_pl}</p>;
  if (period.amount_segments?.length) return <ul>{period.amount_segments.map((segment) =>
    <li key={segment.start_date}>{formatPolishDate(segment.start_date)}–{formatPolishDate(segment.end_date)} · {formatPln(segment.daily_amount_pln)} dziennie · {formatPln(segment.monthly_amount_pln)} za 30 dni</li>)}</ul>;
  if (period.daily_amount_pln === null) return <p>Kwota do ustalenia po podaniu podstawy.</p>;
  return <p>{formatPln(period.daily_amount_pln)} dziennie · {formatPln(period.monthly_amount_pln)} za 30 dni</p>;
}

export function PeriodCards({ periods, showAmounts = false }: { periods: CasePeriod[]; showAmounts?: boolean }) {
  if (!periods.length) return <p>Brak okresów do wyświetlenia dla podanych danych.</p>;
  return <ol className="case-plan-timeline">{periods.map((period) =>
    <li key={`${period.parent_role}-${period.leave_type}-${period.start_date}-${period.denied}`}>
      <strong>{benefitLabels[period.leave_type]}</strong>{' · '}{parentLabels[period.parent_role]}
      <div><time dateTime={period.start_date}>{formatPolishDate(period.start_date)}</time>–<time dateTime={period.end_date}>{formatPolishDate(period.end_date)}</time>
      {' · '}{period.days} dni · {period.weeks.toLocaleString('pl-PL', { maximumFractionDigits: 2 })} tyg. · {percent(period.rate_percent)}
      {period.work_fraction > 0 && <> · praca {percent(period.work_fraction * 100)} etatu</>}
      </div>
      {!showAmounts && period.denied && <p>Odmowa. {period.denial_reason_pl}</p>}
      {showAmounts && <Amounts period={period} />}
    </li>)}</ol>;
}

export function CaseCalculator({ plan, input, update }: {
  plan: CasePlan; input: CaseInputs; update: (patch: Partial<CaseInputs>) => void;
}) {
  const { outcome } = plan;
  return <>
    <h2>Kalkulator</h2>
    <div className="case-plan-fields">
      <label>Wariant wypłaty <select className="plan-field__input" value={input.requested_payment_variant}
        onChange={(event) => update({ requested_payment_variant: event.target.value === 'COMBINED_81_5' ? 'COMBINED_81_5' : 'SPLIT_100_70' })}>
        <option value="COMBINED_81_5">81,5%</option><option value="SPLIT_100_70">100% i 70%</option>
      </select></label>
      <label>Data złożenia wniosku u płatnika <input className="plan-field__input" type="date"
        value={input.application_to_payer_date ?? input.application_date ?? ''}
        onChange={(event) => update({ application_to_payer_date: event.target.value || undefined, application_date: event.target.value || null, days_from_birth_to_application: null })} /></label>
      <label>Podstawa wymiaru w PLN <input className="plan-field__input" type="number" min="0" step="0.01"
        value={input.benefit_base_amount_pln ?? ''}
        onChange={(event) => update({ benefit_base_amount_pln: event.target.value === '' ? null : Number(event.target.value) })} /></label>
    </div>
    <p>Podstawa wymiaru: <strong>{formatPln(outcome.benefit_base_pln)}</strong> · Wariant zastosowany: <strong>{outcome.applied_payment_variant === 'COMBINED_81_5' ? '81,5%' : '100% i 70%'}</strong></p>
    <p>Suma dla wnioskodawcy · 100% i 70%: {formatPln(outcome.variants.SPLIT_100_70)} · 81,5%: {formatPln(outcome.variants.COMBINED_81_5)}</p>
    {outcome.employer_sick_pay.length > 0 && <><h3>Wynagrodzenie chorobowe od pracodawcy</h3><PeriodCards periods={outcome.employer_sick_pay} showAmounts /></>}
    <h3>Okresy świadczeń</h3>
    <PeriodCards periods={outcome.periods} showAmounts />
  </>;
}
