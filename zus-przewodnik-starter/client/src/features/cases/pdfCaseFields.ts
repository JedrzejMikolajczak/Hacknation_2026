import type { CaseInputs } from '@shared/types';

const ISO_DATE = /\d{4}-\d{2}-\d{2}/;
const POLISH_DATE = /\d{1,2}[./-]\d{1,2}[./-]\d{4}/;
const DATE_VALUE = new RegExp('(?:' + ISO_DATE.source + '|' + POLISH_DATE.source + ')');
const MONEY_VALUE = /[+−–—-]?[ \t]*(?:\d{1,3}(?: \d{3})+|\d+)(?:[,.]\d{1,2})?(?![\d,.])/;

type ExtractedField =
  | 'birthDate'
  | 'dueDate'
  | 'acceptanceDate'
  | 'applicationDate'
  | 'sicknessStart'
  | 'sicknessEnd'
  | 'children'
  | 'base';

export type ExtractedFields = Partial<Record<ExtractedField, string>>;

function isoDate(value: string): string | undefined {
  const pieces = value.split(/[./-]/);
  if (pieces.length !== 3) return;
  const [first, middle, last] = pieces;
  const iso =
    first.length === 4 ? value : [last, middle.padStart(2, '0'), first.padStart(2, '0')].join('-');
  const timestamp = Date.parse(iso + 'T00:00:00Z');
  if (Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === iso)
    return iso;
}

function uniqueValue(
  text: string,
  label: RegExp,
  pattern: RegExp,
  normalize: (value: string) => string | undefined,
  separator = '[:–-]?',
): string | undefined {
  const matches = text.matchAll(
    new RegExp(
      '(?:^|[^\\p{L}\\p{N}])(?:' +
        label.source +
        ')[ \\t]*' + separator + '[ \\t]*(?:\\r?\\n[ \\t]*)?(' +
        pattern.source +
        ')(?!\\d)',
      'giu',
    ),
  );
  const values = new Set<string>();
  for (const match of matches) {
    const value = normalize(match[1]);
    if (value !== undefined) values.add(value);
  }
  if (values.size === 1) return values.values().next().value;
}

export function extractCaseFields(source: string): ExtractedFields {
  const text = source.normalize('NFC').replace(/[\u00a0\u202f]/g, ' ');
  return {
    birthDate: uniqueValue(text, /data (?:urodzenia dziecka|porodu)/, DATE_VALUE, isoDate),
    dueDate: uniqueValue(text, /(?:przewidywana data porodu|termin porodu)/, DATE_VALUE, isoDate),
    acceptanceDate: uniqueValue(
      text,
      /data przyjęcia dziecka(?: na wychowanie)?/,
      DATE_VALUE,
      isoDate,
    ),
    applicationDate: uniqueValue(
      text,
      /data (?:złożenia wniosku|wpływu wniosku)/,
      DATE_VALUE,
      isoDate,
    ),
    sicknessStart: uniqueValue(text, /(?:niezdolność do pracy|zwolnienie) od/, DATE_VALUE, isoDate),
    sicknessEnd: uniqueValue(text, /(?:niezdolność do pracy|zwolnienie) do/, DATE_VALUE, isoDate),
    children: uniqueValue(text, /liczba dzieci(?: urodzonych| przyjętych)?/, /\d{1,2}/, (value) =>
      Number(value) > 0 ? String(Number(value)) : undefined,
    ),
    base: uniqueValue(text, /podstawa wymiaru zasiłku(?: \(zł\))?/, MONEY_VALUE, (value) => {
      const amount = Number(value.replace(/\s/g, '').replace(',', '.'));
      return Number.isFinite(amount) && amount >= 0 ? String(amount) : undefined;
    }, ':?'),
  };
}

function optionalNumber(data: FormData, field: string): number | null {
  const value = String(data.get(field) ?? '');
  if (!value) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error('Podaj poprawną liczbę.');
  return number;
}

function optionalDate(data: FormData, field: string): string | undefined {
  const value = String(data.get(field) ?? '');
  if (!value) return;
  const date = isoDate(value);
  if (!date) throw new Error('Sprawdź poprawność dat.');
  return date;
}

function yesNo(data: FormData, field: string): boolean | null {
  const value = data.get(field);
  return value === 'yes' ? true : value === 'no' ? false : null;
}

/** The deployed POST /plan uses CaseInputs rather than the old ScenarioInput. */
export function toPdfCaseInputs(data: FormData): CaseInputs {
  const stage = data.get('stage');
  if (stage !== 'POST_BIRTH' && stage !== 'PREGNANCY' && stage !== 'ADOPTION') {
    throw new Error('Wybierz sytuację.');
  }
  const employment = data.get('employment');
  if (
    employment !== 'UOP' &&
    employment !== 'ZLECENIE' &&
    employment !== 'B2B' &&
    employment !== 'NONE'
  ) {
    throw new Error('Wybierz tytuł ubezpieczenia.');
  }
  const eventDate = optionalDate(
    data,
    stage === 'ADOPTION' ? 'acceptanceDate' : stage === 'PREGNANCY' ? 'dueDate' : 'birthDate',
  );
  const sicknessStart = optionalDate(data, 'sicknessStart');
  const sicknessEnd = optionalDate(data, 'sicknessEnd');
  if (!eventDate && (stage !== 'PREGNANCY' || !sicknessStart)) {
    throw new Error('Podaj datę zdarzenia lub początek niezdolności do pracy.');
  }
  if (sicknessStart && sicknessEnd && sicknessEnd < sicknessStart) {
    throw new Error('Koniec niezdolności do pracy wypada przed początkiem.');
  }
  const adoptionType = data.get('adoptionType');
  const insuredCount = data.get('insuredCount');
  const children = optionalNumber(data, 'children');
  if (
    (stage !== 'PREGNANCY' && children === null) ||
    (children !== null && (!Number.isInteger(children) || children < 1))
  ) {
    throw new Error('Podaj całkowitą liczbę dzieci, co najmniej 1.');
  }
  const payment = data.get('payment') === 'COMBINED_81_5' ? 'COMBINED_81_5' : 'SPLIT_100_70';
  const applicationDate = optionalDate(data, 'applicationDate');
  return {
    applicant_role: data.get('applicant') === 'FATHER' ? 'FATHER' : 'MOTHER',
    stage,
    co_parenting: false,
    other_parent_insured: null,
    employment_type: employment,
    contract_type: null,
    contract_end_date: optionalDate(data, 'contractEnd') ?? null,
    payer_insured_count_nov_30:
      insuredCount === '<= 20' || insuredCount === '> 20' ? insuredCount : null,
    voluntary_sickness_insured: yesNo(data, 'voluntary'),
    insurance_duration_days: optionalNumber(data, 'insuranceDays'),
    has_b2b_arrears: yesNo(data, 'arrears'),
    applicant_age_50_plus: yesNo(data, 'age50'),
    benefit_base_amount_pln: optionalNumber(data, 'base'),
    due_or_birth_date: stage === 'ADOPTION' ? null : (eventDate ?? null),
    application_date: applicationDate ?? null,
    days_from_birth_to_application: null,
    children_count: children ?? 1,
    requested_payment_variant: payment,
    father_parental_weeks: 0,
    part_time_work_fraction: 0,
    special_circumstances: {
      has_code_b_on_ezla: yesNo(data, 'codeB'),
      premature_or_hospitalized_newborn: false,
      za_zyciem_certificate: data.get('zaZyciem') === 'on',
      stillbirth_or_child_death: 'NONE',
      mother_hospitalized_or_incapable: false,
      employer_bankruptcy_or_liquidation: false,
      adopted_or_foster_child_age_years: optionalNumber(data, 'childAge'),
      is_professional_foster_family: false,
    },
    ...(stage === 'PREGNANCY'
      ? {
          sickness_leave_start_date: sicknessStart,
          sickness_leave_end_date: sicknessEnd,
        }
      : {}),
    ...(stage === 'ADOPTION'
      ? {
          adopted_or_foster_child_acceptance_date: eventDate,
          adoption_type: adoptionType === 'FOSTER_FAMILY' ? 'FOSTER_FAMILY' : 'ADOPTION',
        }
      : {}),
  };
}
