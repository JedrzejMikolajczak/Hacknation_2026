import type { BenefitParams, CaseInputs, IsoDate } from '@shared/types';

export const PLAN_TABS = [
  { id: 'entitlements', label: 'Uprawnienia' },
  { id: 'calculator', label: 'Kalkulator' },
  { id: 'leave-plan', label: 'Plan urlopów' },
  { id: 'documents', label: 'Dokumenty i terminy' },
  { id: 'applications', label: 'Wnioski' },
  { id: 'support', label: 'Wsparcie' },
] as const;

export type PlanTabId = (typeof PLAN_TABS)[number]['id'];

export function isPlanTab(value: string | undefined): value is PlanTabId {
  return PLAN_TABS.some(({ id }) => id === value);
}

export function todayIsoDate(): IsoDate {
  const today = new Date();
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
}

export function addDaysIso(iso: IsoDate, days: number): IsoDate {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function diffDaysIso(from: IsoDate, to: IsoDate): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

export function combinedRateUnavailable(input: CaseInputs, params: BenefitParams): boolean {
  if (
    input.special_circumstances.mother_deceased ||
    (input.applicant_role === 'FATHER' && input.stage !== 'ADOPTION')
  )
    return true;
  if (input.stage !== 'ADOPTION' && input.stage !== 'POST_BIRTH') return false;
  const event =
    input.stage === 'ADOPTION'
      ? input.adopted_or_foster_child_acceptance_date
      : input.due_or_birth_date;
  if (!event) return false;
  const filing = input.application_to_payer_date ?? input.application_date;
  const elapsed = filing ? diffDaysIso(event, filing) : input.days_from_birth_to_application;
  return elapsed === null
    ? !!input.reference_date &&
        input.reference_date > addDaysIso(event, params.combinedRateApplicationDeadlineDays)
    : elapsed < 0 || elapsed > params.combinedRateApplicationDeadlineDays;
}

const PLN = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' });
const DATE = new Intl.DateTimeFormat('pl-PL', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});

export function formatPln(amount: number | null | undefined): string {
  return amount == null || !Number.isFinite(amount) ? 'Brak danych' : PLN.format(amount);
}

export function formatPolishDate(iso: IsoDate | null | undefined): string {
  return iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? DATE.format(new Date(iso)) : 'Brak daty';
}
