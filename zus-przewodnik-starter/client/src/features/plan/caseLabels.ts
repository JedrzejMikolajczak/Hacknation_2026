import type { ApplicantRole, CaseEntitlement, CasePayer } from '@shared/types';

export const benefitLabels: Record<CaseEntitlement['benefit_type'], string> = {
  SICKNESS: 'Zasiłek chorobowy',
  MATERNITY: 'Macierzyński',
  SUPPLEMENTARY_MATERNITY: 'Uzupełniający macierzyński',
  PARENTAL: 'Rodzicielski',
  PARENTAL_ZA_ZYCIEM_EXTENSION: 'Rodzicielski · Za życiem',
  PARENTAL_WORK_EXTENSION: 'Wydłużenie rodzicielskiego przy pracy',
  PATERNITY: 'Ojcowski',
  ADOPTION_MATERNITY: 'Na warunkach macierzyńskiego',
  REHABILITATION: 'Świadczenie rehabilitacyjne',
  MATERNITY_EQUIVALENT: 'Zasiłek w wysokości macierzyńskiego',
};
export const parentLabels: Record<ApplicantRole, string> = { MOTHER: 'Matka', FATHER: 'Ojciec' };
export const roles = ['MOTHER', 'FATHER'] as const;
export const payerLabels: Record<CasePayer | 'USC', string> = {
  EMPLOYER: 'Pracodawca',
  ZUS: 'ZUS',
  SPLIT_EMPLOYER_THEN_ZUS: 'Najpierw pracodawca, następnie ZUS',
  USC: 'Urząd stanu cywilnego',
};
export const payerLabel = (payer: CasePayer | 'USC' | null) =>
  payer ? payerLabels[payer] : 'Do ustalenia';
export const percent = (value: number | null) =>
  value === null ? '—' : `${value.toLocaleString('pl-PL')}%`;
