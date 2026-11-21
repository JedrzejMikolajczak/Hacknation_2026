import type { CaseInputs, CasePlan, PlannedParentalPart } from '@shared/types';
import { addDaysIso, formatPolishDate } from '../planScenario';
import { roles } from '../caseLabels';
import { PeriodCards } from './CaseResults';

function editableParts(input: CaseInputs, plan: CasePlan): PlannedParentalPart[] {
  return input.parental_leave_parts ?? plan.outcome.periods
    .filter((period) => period.leave_type === 'PARENTAL' || period.leave_type === 'PARENTAL_ZA_ZYCIEM_EXTENSION')
    .map(({ start_date, end_date, parent_role, work_fraction }) => ({ start_date, end_date, parent_role, work_fraction }));
}

export function CasePlanner({ input, plan, update }: {
  plan: CasePlan; input: CaseInputs; update: (patch: Partial<CaseInputs>) => void;
}) {
  const parts = editableParts(input, plan);
  const base = plan.default_father_parental_start_date ?? parts.at(-1)?.end_date ?? input.due_or_birth_date ??
    input.adopted_or_foster_child_acceptance_date;
  function edit(index: number, patch: Partial<PlannedParentalPart>) {
    update({ parental_leave_parts: parts.map((part, i) => index === i ? { ...part, ...patch } : part) });
  }
  return <>
    <h2>Plan urlopów</h2>
    <p>Wspólna pula rodzicielskiego · <strong>{plan.outcome.parental_pool_weeks} tyg.</strong>{' '}
      · Do wykorzystania do <strong>{formatPolishDate(plan.outcome.parental_deadline)}</strong></p>
    <PeriodCards periods={plan.outcome.periods.filter((period) => !period.denied && period.leave_type !== 'SICKNESS')} />
    {plan.documents.some((doc) => doc.is_overdue) && <p className="plan-callout plan-callout--warning">Termin minął. Sprawdź pozycje w zakładce Dokumenty i terminy.</p>}
    <h3>Części urlopu rodzicielskiego</h3>
    {parts.map((part, index) => <fieldset className="case-plan-part" key={index}>
      <legend>Część {index + 1}</legend>
      <div className="case-plan-fields">
        <label>Rodzic <select className="plan-field__input" value={part.parent_role ?? input.applicant_role}
          onChange={(event) => edit(index, { parent_role: event.target.value === roles[1] ? roles[1] : roles[0] })}>
          <option value="MOTHER">Matka</option><option value="FATHER">Ojciec</option>
        </select></label>
        <label>Początek <input aria-label={`Początek części ${index + 1}`} type="date" className="plan-field__input" value={part.start_date}
          onChange={(event) => { if (event.target.value) edit(index, { start_date: event.target.value }); }} /></label>
        <label>Koniec <input aria-label={`Koniec części ${index + 1}`} type="date" className="plan-field__input" value={part.end_date}
          onChange={(event) => { if (event.target.value) edit(index, { end_date: event.target.value }); }} /></label>
        <label>Część etatu podczas urlopu <input className="plan-field__input" type="number" min="0" max="0.5" step="0.05"
          value={part.work_fraction ?? 0} onChange={(event) => edit(index, { work_fraction: Number(event.target.value) })} /></label>
      </div>
      <button type="button" className="plan-btn plan-btn--secondary" onClick={() =>
        update({ parental_leave_parts: parts.filter((_, i) => i !== index) })}>Usuń część</button>
    </fieldset>)}
    {base && <button type="button" className="plan-btn plan-btn--primary" onClick={() =>
      update({ parental_leave_parts: [...parts, { start_date: base, end_date: addDaysIso(base, 6) }] })}>Dodaj część</button>}
    {input.parental_leave_parts && !input.parental_only && <button type="button" className="plan-btn plan-btn--secondary"
      onClick={() => update({ parental_leave_parts: undefined })}>Przywróć proponowany rozkład</button>}
    <h3>Pozostałe daty</h3>
    <div className="case-plan-fields">
      {input.applicant_role === 'MOTHER' && input.stage !== 'ADOPTION' && <label>Początek macierzyńskiego <input type="date" className="plan-field__input"
        value={input.maternity_leave_start_date ?? input.due_or_birth_date ?? ''}
        onChange={(event) => update({ maternity_leave_start_date: event.target.value || undefined })} /></label>}
      <label>Początek ojcowskiego <input type="date" className="plan-field__input" value={input.paternity_leave_start_date ?? ''}
        onChange={(event) => update({ paternity_leave_start_date: event.target.value || undefined })} /></label>
      {input.applicant_role === 'MOTHER' && input.stage !== 'ADOPTION' && <label>Przejęcie macierzyńskiego przez ojca <input type="date" className="plan-field__input"
        value={input.father_takeover_date ?? ''} onChange={(event) => update({ father_takeover_date: event.target.value || undefined })} /></label>}
    </div>
  </>;
}
