import { useState } from 'react';
import { MAX_WIZARD_YEAR, MIN_WIZARD_YEAR, todayLocal } from './wizardModel';

const months = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień',
];
const years = Array.from(
  { length: MAX_WIZARD_YEAR - MIN_WIZARD_YEAR + 1 },
  (_, index) => MIN_WIZARD_YEAR + index,
);
const emptyDate = { day: '', month: '', year: '' };

function todayFields() {
  const [year, month, day] = todayLocal().split('-');
  return { year, month, day };
}

function daysInMonth(month: string, year: string) {
  return month ? new Date(Date.UTC(Number(year || '2000'), Number(month), 0)).getUTCDate() : 31;
}

export function WizardDateFields({
  value,
  describedBy,
  invalid,
  onChange,
}: {
  value: string;
  describedBy?: string;
  invalid: boolean;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState(todayFields);
  const [year = '', month = '', day = ''] = value.split('-');
  const current = value === 'unknown' ? emptyDate : value ? { year, month, day } : draft;

  function select(part: keyof typeof emptyDate, selection: string) {
    const next = { ...current, [part]: selection };
    if (Number(next.day) > daysInMonth(next.month, next.year)) next.day = '';
    setDraft(next);
    const { day, month, year } = next;
    const date = day && month && year ? `${year}-${month}-${day}` : '';
    if (date !== value) onChange(date);
  }

  return (
    <fieldset
      className="wizard__choices wizard__date-fields"
      aria-labelledby="question-title"
      aria-describedby={describedBy}
      aria-invalid={invalid}
      disabled={value === 'unknown'}
    >
      <label className="wizard__field">
        Dzień
        <select name="date-day" value={current.day} onChange={(event) => select('day', event.target.value)}>
          <option value="">Wybierz</option>
          {Array.from({ length: daysInMonth(current.month, current.year) }, (_, index) => {
            const day = String(index + 1).padStart(2, '0');
            return <option key={day} value={day}>{index + 1}</option>;
          })}
        </select>
      </label>
      <label className="wizard__field">
        Miesiąc
        <select name="date-month" value={current.month} onChange={(event) => select('month', event.target.value)}>
          <option value="">Wybierz</option>
          {months.map((month, index) => (
            <option key={month} value={String(index + 1).padStart(2, '0')}>{month}</option>
          ))}
        </select>
      </label>
      <label className="wizard__field">
        Rok
        <select name="date-year" value={current.year} onChange={(event) => select('year', event.target.value)}>
          <option value="">Wybierz</option>
          {years.map((year) => <option key={year}>{year}</option>)}
        </select>
      </label>
    </fieldset>
  );
}
