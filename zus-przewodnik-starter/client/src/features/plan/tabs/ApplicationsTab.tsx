import { useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type {
  BenefitParams,
  DocumentChecklist,
  MaternityCalculationResult,
  Payer,
  ScenarioInput,
} from '@shared/types';
import { formatRate } from '../../../app/benefitParams';
import {
  formatInsuranceTitle,
  formatPln,
  formatPolishDate,
  getExplicitEventDate,
} from '../planScenario';
import './ApplicationsTab.css';

interface ApplicationsTabProps {
  scenario: ScenarioInput;
  params: BenefitParams;
  maternity: MaternityCalculationResult;
  checklist: DocumentChecklist;
}

type PersonalFieldKey = 'applicantName' | 'pesel' | 'bankAccount';

interface ApplicationFormItem {
  id: string;
  code: string;
  title: string;
  subtitle: string;
  submitTo: Payer | 'usc';
  channelLabel: string;
  legalBasis: string;
  requiredPersonalFields: PersonalFieldKey[];
  fields: { label: string; value: string; missing?: boolean }[];
}

interface SentReceipt {
  applicationId: string;
  referenceNumber: string;
  sentAt: string;
  recipient: string;
  applicantName: string;
}

const PERSONAL_FIELD_LABELS: Record<PersonalFieldKey, string> = {
  applicantName: 'imię i nazwisko',
  pesel: 'PESEL',
  bankAccount: 'numer rachunku bankowego',
};

function formatRecipientShort(submitTo: Payer | 'usc'): string {
  if (submitTo === 'employer') return 'Pracodawca';
  if (submitTo === 'usc') return 'Urząd Stanu Cywilnego';
  return 'ZUS (PUE / eZUS)';
}

function formatRecipientFull(submitTo: Payer | 'usc'): string {
  if (submitTo === 'employer') return 'Pracodawca (płatnik składek)';
  if (submitTo === 'usc') return 'Urząd Stanu Cywilnego (RSC / mObywatel)';
  return 'Zakład Ubezpieczeń Społecznych (PUE / eZUS)';
}

export function ApplicationsTab({ scenario, params, maternity, checklist }: ApplicationsTabProps) {
  const { search } = useLocation();
  const [applicantName, setApplicantName] = useState('');
  const [pesel, setPesel] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [receipts, setReceipts] = useState<Record<string, SentReceipt>>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [invalidFields, setInvalidFields] = useState<PersonalFieldKey[]>([]);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const peselInputRef = useRef<HTMLInputElement>(null);
  const bankInputRef = useRef<HTMLInputElement>(null);

  const explicitEventDate = getExplicitEventDate(scenario);

  if (!explicitEventDate) {
    const wizardHref = `/wizard?situation=${scenario.situation}`;
    return (
      <div className="plan-tab-content">
        <section className="plan-section" aria-labelledby="apps-missing-heading">
          <div className="plan-missing-data" role="status">
            <h2 id="apps-missing-heading" className="plan-section__title">
              Uzupełnij dane, aby przygotować wnioski
            </h2>
            <p className="plan-section__lead">
              Aby przygotować właściwe formularze do pracodawcy, ZUS i Urzędu Stanu Cywilnego, podaj
              datę zdarzenia i formę ubezpieczenia.
            </p>
            <Link to={wizardHref} className="plan-btn plan-btn--primary">
              Uzupełnij dane ›
            </Link>
          </div>
        </section>

        <nav className="apps-next-nav" aria-label="Następny krok planu">
          <Link to={`/plan/support${search}`} className="apps-next-link">
            Dalej: Wsparcie ›
          </Link>
        </nav>
      </div>
    );
  }

  const trimmedName = applicantName.trim();
  const trimmedPesel = pesel.trim();
  const trimmedBank = bankAccount.trim();

  const nameDisplay = trimmedName || 'Do uzupełnienia';
  const peselDisplay = trimmedPesel || 'Do uzupełnienia';
  const bankDisplay = trimmedBank || 'Do uzupełnienia';

  const maternityWeeks =
    maternity.periods.find(
      (p) => p.leaveType === 'maternityLeave' || p.leaveType === 'adoptionMaternityLeave',
    )?.weeks ?? params.maternityLeave.weeksByChildrenCount['1'];
  const motherParentalWeeks =
    maternity.periods.find((p) => p.leaveType === 'parentalLeave' && p.parentRole === 'mother')
      ?.weeks ??
    params.parentalLeave.weeksSingleChild - params.parentalLeave.nonTransferableWeeksPerParent;

  const forms: ApplicationFormItem[] = [];

  // 1. Odpis skrócony aktu urodzenia (Rejestr Stanu Cywilnego / mObywatel)
  forms.push({
    id: 'birth-certificate',
    code: 'USC / AKT',
    title: scenario.special.stillbirth
      ? 'Wniosek o skrócony odpis aktu urodzenia (z adnotacją o martwym urodzeniu)'
      : 'Wniosek o skrócony odpis aktu urodzenia dziecka',
    subtitle:
      'Elektroniczny odpis z Rejestru Stanu Cywilnego potrzebny do przyznania zasiłku macierzyńskiego.',
    submitTo: 'usc',
    channelLabel: 'Urząd Stanu Cywilnego (ePUAP / mObywatel – symulacja)',
    legalBasis: 'Prawo o aktach stanu cywilnego; Rozporządzenie MRPiPS poz. 1316',
    requiredPersonalFields: ['applicantName'],
    fields: [
      { label: 'Wnioskodawca (rodzic)', value: nameDisplay, missing: !trimmedName },
      { label: 'Data zdarzenia', value: formatPolishDate(explicitEventDate) },
      { label: 'Liczba dzieci', value: String(scenario.childrenCount) },
      {
        label: 'Cel pobrania',
        value:
          'Złożenie wniosku o zasiłek macierzyński w ZUS / u pracodawcy (bez opłaty skarbowej)',
      },
    ],
  });

  // 2. Wniosek do pracodawcy o urlop macierzyński i rodzicielski (dla UoP)
  if (scenario.mother.insuranceTitle === 'employment') {
    const isCombined = scenario.rateVariant === 'combined';
    forms.push({
      id: 'employer-leave-request',
      code: isCombined ? 'WNIOSEK-81,5%' : 'WNIOSEK-KP',
      title: isCombined
        ? `Wniosek do pracodawcy o pełny urlop (${formatRate(params.rates.combined)})`
        : 'Wniosek do pracodawcy o urlop macierzyński i rodzicielski',
      subtitle:
        'Wstępnie uzupełniony na podstawie danych z planu i Kodeksu pracy (Rozporządzenie MRPiPS poz. 322).',
      submitTo: 'employer',
      channelLabel: 'Dział kadr / system pracodawcy – symulacja',
      legalBasis: 'KP art. 180, art. 182¹a; ustawa zasiłkowa art. 30a',
      requiredPersonalFields: ['applicantName', 'pesel'],
      fields: [
        {
          label: 'Pracownik',
          value: `${nameDisplay} (PESEL: ${peselDisplay})`,
          missing: !trimmedName || !trimmedPesel,
        },
        { label: 'Data rozpoczęcia urlopu', value: formatPolishDate(explicitEventDate) },
        {
          label: 'Wnioskowany wymiar',
          value: `${maternityWeeks} tyg. macierzyńskiego + ${motherParentalWeeks} tyg. rodzicielskiego`,
        },
        {
          label: 'Wnioskowana stawka zasiłku',
          value: isCombined
            ? `${formatRate(params.rates.combined)} za cały okres (wniosek w ${params.combinedRateApplicationDeadlineDays} dni)`
            : `${formatRate(params.rates.maternity)} (macierzyński) + ${formatRate(params.rates.parental)} (rodzicielski)`,
        },
      ],
    });
  }

  // 3. ZUS ZAM – zasiłek macierzyński
  forms.push({
    id: 'zus-zam',
    code: 'ZUS ZAM',
    title: 'Wniosek o zasiłek macierzyński (ZUS ZAM)',
    subtitle: 'Zintegrowany druk ZUS (od 24.10.2026 obejmuje także dawne formularze ZUR i ZAO).',
    submitTo: checklist.payer,
    channelLabel:
      checklist.payer === 'employer'
        ? `Przekaz do pracodawcy (> ${params.payerThresholdInsuredCount} ubezpieczonych) – symulacja`
        : 'Wysyłka elektroniczna przez PUE / eZUS – symulacja',
    legalBasis: 'Ustawa zasiłkowa art. 29–31; Rozporządzenie poz. 1316',
    requiredPersonalFields: ['applicantName', 'pesel', 'bankAccount'],
    fields: [
      {
        label: 'Ubezpieczony',
        value: `${nameDisplay} (PESEL: ${peselDisplay})`,
        missing: !trimmedName || !trimmedPesel,
      },
      { label: 'Tytuł ubezpieczenia', value: formatInsuranceTitle(scenario.mother.insuranceTitle) },
      { label: 'Podstawa wymiaru zasiłku', value: formatPln(scenario.mother.benefitBase) },
      { label: 'Numer rachunku do wypłaty', value: bankDisplay, missing: !trimmedBank },
      { label: 'Szacowana łączna kwota świadczeń', value: formatPln(maternity.totalAmount) },
    ],
  });

  // 4. ZUS Z-3 / Z-3a (gdy ZUS jest płatnikiem dla UoP lub zlecenia)
  if (
    checklist.payer === 'zus' &&
    (scenario.mother.insuranceTitle === 'employment' ||
      scenario.mother.insuranceTitle === 'mandateContract')
  ) {
    const code = scenario.mother.insuranceTitle === 'employment' ? 'ZUS Z-3' : 'ZUS Z-3a';
    forms.push({
      id: 'zus-z3',
      code,
      title: `Zaświadczenie płatnika składek (${code})`,
      subtitle: 'Dane o przychodach przekazywane przez płatnika do ZUS (Z-3b został zlikwidowany).',
      submitTo: 'zus',
      channelLabel: 'Automatyczny przekaz przez PUE / eZUS – symulacja',
      legalBasis: 'Ustawa zasiłkowa art. 61b',
      requiredPersonalFields: ['applicantName'],
      fields: [
        { label: 'Ubezpieczony', value: nameDisplay, missing: !trimmedName },
        {
          label: 'Tytuł ubezpieczenia',
          value: formatInsuranceTitle(scenario.mother.insuranceTitle),
        },
        { label: 'Podstawa wymiaru', value: formatPln(scenario.mother.benefitBase) },
      ],
    });
  }

  // 5. ZUS ZAS-53 (w ciąży)
  if (scenario.situation === 'pregnant') {
    forms.push({
      id: 'zus-zas53',
      code: 'ZUS ZAS-53',
      title: `Wniosek o zasiłek chorobowy w ciąży (${formatRate(params.rates.sicknessPregnancy)})`,
      subtitle: 'Wniosek powiązany ze zwolnieniem lekarskim e-ZLA z kodem literowym „B”.',
      submitTo: checklist.payer,
      channelLabel:
        checklist.payer === 'employer'
          ? 'Przekaz do pracodawcy – symulacja'
          : 'Wysyłka elektroniczna przez PUE / eZUS – symulacja',
      legalBasis: 'Ustawa zasiłkowa art. 8, art. 11 ust. 2 pkt 1',
      requiredPersonalFields: ['applicantName', 'pesel', 'bankAccount'],
      fields: [
        {
          label: 'Ubezpieczona',
          value: `${nameDisplay} (PESEL: ${peselDisplay})`,
          missing: !trimmedName || !trimmedPesel,
        },
        {
          label: 'Stawka zasiłku',
          value: `${formatRate(params.rates.sicknessPregnancy)} podstawy wymiaru`,
        },
        { label: 'Rachunek bankowy', value: bankDisplay, missing: !trimmedBank },
      ],
    });
  }

  function findMissingPersonalFields(required: PersonalFieldKey[]): PersonalFieldKey[] {
    const missing: PersonalFieldKey[] = [];
    if (required.includes('applicantName') && !trimmedName) missing.push('applicantName');
    if (required.includes('pesel') && !trimmedPesel) missing.push('pesel');
    if (required.includes('bankAccount') && !trimmedBank) missing.push('bankAccount');
    return missing;
  }

  function focusFirstMissingField(missing: PersonalFieldKey[]) {
    const first = missing[0];
    if (first === 'applicantName') nameInputRef.current?.focus();
    else if (first === 'pesel') peselInputRef.current?.focus();
    else if (first === 'bankAccount') bankInputRef.current?.focus();
  }

  function clearFieldError(field: PersonalFieldKey) {
    if (invalidFields.includes(field)) {
      const remaining = invalidFields.filter((item) => item !== field);
      setInvalidFields(remaining);
      if (remaining.length === 0) {
        setValidationError(null);
      }
    }
  }

  const refYear = scenario.referenceDate.slice(0, 4);

  function sendOne(form: ApplicationFormItem) {
    const missing = findMissingPersonalFields(form.requiredPersonalFields);
    if (missing.length > 0) {
      setInvalidFields(missing);
      setStatusMessage(null);
      setValidationError(
        `Aby wysłać wniosek ${form.code}, uzupełnij dane osobowe: ${missing
          .map((key) => PERSONAL_FIELD_LABELS[key])
          .join(', ')}.`,
      );
      focusFirstMissingField(missing);
      return;
    }

    const cleanCode = form.code.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    const seq = String(Object.keys(receipts).length + 1).padStart(3, '0');
    const ref = `UPO-${refYear}-${cleanCode}-${seq}`;
    const recipient = formatRecipientFull(form.submitTo);

    setInvalidFields([]);
    setValidationError(null);
    setReceipts((prev) => ({
      ...prev,
      [form.id]: {
        applicationId: form.id,
        referenceNumber: ref,
        sentAt: formatPolishDate(scenario.referenceDate),
        recipient,
        applicantName: trimmedName,
      },
    }));
    setStatusMessage(`Wysłano wniosek ${form.code} do: ${recipient} (nr potwierdzenia: ${ref}).`);
  }

  function sendAll() {
    const pendingForms = forms.filter((form) => !receipts[form.id]);
    if (pendingForms.length === 0) return;

    const requiredSet = new Set<PersonalFieldKey>();
    for (const form of pendingForms) {
      for (const field of form.requiredPersonalFields) {
        requiredSet.add(field);
      }
    }

    const missing = findMissingPersonalFields(Array.from(requiredSet));
    if (missing.length > 0) {
      setInvalidFields(missing);
      setStatusMessage(null);
      setValidationError(
        `Aby wysłać wszystkie wnioski, uzupełnij dane osobowe: ${missing
          .map((key) => PERSONAL_FIELD_LABELS[key])
          .join(', ')}.`,
      );
      focusFirstMissingField(missing);
      return;
    }

    const nextReceipts: Record<string, SentReceipt> = { ...receipts };
    let seq = Object.keys(receipts).length + 1;
    let count = 0;

    for (const form of pendingForms) {
      const cleanCode = form.code.replace(/[^A-Z0-9]/gi, '').toUpperCase();
      const ref = `UPO-${refYear}-${cleanCode}-${String(seq).padStart(3, '0')}`;
      nextReceipts[form.id] = {
        applicationId: form.id,
        referenceNumber: ref,
        sentAt: formatPolishDate(scenario.referenceDate),
        recipient: formatRecipientFull(form.submitTo),
        applicantName: trimmedName,
      };
      seq += 1;
      count += 1;
    }

    setInvalidFields([]);
    setValidationError(null);
    setReceipts(nextReceipts);
    setStatusMessage(
      `Wysłano elektronicznie pakiet ${count} wniosków (symulacja PUE/eZUS, pracodawca oraz USC).`,
    );
  }

  const allSent = forms.every((form) => Boolean(receipts[form.id]));

  return (
    <div className="plan-tab-content">
      <section className="apps-intro" aria-labelledby="apps-intro-heading">
        <div className="apps-intro__top">
          <div className="apps-intro__copy">
            <h2 id="apps-intro-heading" className="plan-section__title">
              Gotowe wnioski do wysłania
            </h2>
            <p className="apps-intro__lead">
              Na podstawie Twojego planu przygotowaliśmy listę wymaganych wniosków. Uzupełnij swoje
              dane osobowe poniżej i wyślij je pojedynczo lub razem (wysyłka jest symulowana).
            </p>
          </div>
          <button
            type="button"
            className="plan-btn plan-btn--primary apps-intro__cta"
            disabled={allSent}
            onClick={sendAll}
          >
            {allSent ? 'Wszystkie wnioski wysłane' : `Wyślij wszystkie (${forms.length}) ›`}
          </button>
        </div>
      </section>

      {statusMessage && (
        <div className="plan-callout plan-callout--success" role="status">
          <strong>Potwierdzenie wysyłki (symulacja):</strong> {statusMessage}
        </div>
      )}

      <section className="plan-section" aria-labelledby="apps-list-heading">
        <h2 id="apps-list-heading" className="plan-section__title">
          Lista wniosków ({forms.length})
        </h2>

        <div className="apps-compact-list">
          {forms.map((form) => {
            const receipt = receipts[form.id];
            return (
              <article
                key={form.id}
                className={receipt ? 'apps-card apps-card--sent' : 'apps-card'}
              >
                <div className="apps-card__header">
                  <div className="apps-card__info">
                    <div className="apps-card__badges">
                      <span className="plan-badge plan-badge--code">{form.code}</span>
                      <span
                        className={
                          receipt ? 'plan-badge plan-badge--yes' : 'plan-badge plan-badge--navy'
                        }
                      >
                        {receipt ? 'Wysłano' : 'Do wysłania'}
                      </span>
                    </div>
                    <h3 className="apps-card__title">{form.title}</h3>
                    <p className="apps-card__recipient">
                      Do: <strong>{formatRecipientShort(form.submitTo)}</strong>
                    </p>
                  </div>

                  {!receipt && (
                    <button
                      type="button"
                      className="plan-btn plan-btn--secondary apps-card__action"
                      aria-label={`Wyślij ${form.code}`}
                      onClick={() => sendOne(form)}
                    >
                      Wyślij ›
                    </button>
                  )}
                </div>

                {receipt && (
                  <div
                    className="apps-card__receipt"
                    role="region"
                    aria-label={`Potwierdzenie wysłania ${form.code}`}
                  >
                    <strong className="apps-card__receipt-title">
                      UPO – Potwierdzenie złożenia ({receipt.referenceNumber})
                    </strong>
                    <p>
                      Odbiorca: <strong>{receipt.recipient}</strong> · Nadawca:{' '}
                      <strong>{receipt.applicantName}</strong> · Data: {receipt.sentAt}
                    </p>
                  </div>
                )}

                <details className="apps-preview">
                  <summary className="apps-preview__summary">Podgląd wniosku</summary>
                  <div className="apps-preview__body">
                    <p className="apps-preview__subtitle">{form.subtitle}</p>
                    <dl className="apps-preview__fields">
                      {form.fields.map((field) => (
                        <div key={field.label}>
                          <dt>{field.label}</dt>
                          <dd className={field.missing ? 'apps-preview__empty-value' : undefined}>
                            {field.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <p className="plan-legal">Kanał: {form.channelLabel}</p>
                    <p className="plan-legal">Podstawa prawna: {form.legalBasis}</p>
                  </div>
                </details>
              </article>
            );
          })}
        </div>
      </section>

      <section className="plan-section" aria-labelledby="apps-personal-heading">
        <h2 id="apps-personal-heading" className="plan-section__title">
          Dane osobowe do wniosków
        </h2>
        <p className="apps-personal-note">
          Dane osobowe uzupełnisz po zalogowaniu przez mObywatela (symulacja) albo wpiszesz ręcznie
          – nie wysyłamy ich na serwer.
        </p>

        {validationError && (
          <div className="plan-callout plan-callout--warning apps-validation-alert" role="alert">
            {validationError}
          </div>
        )}

        <div className="plan-controls__grid">
          <label className="plan-field">
            <span className="plan-field__label">Imię i nazwisko wnioskodawcy</span>
            <input
              ref={nameInputRef}
              type="text"
              className={
                invalidFields.includes('applicantName')
                  ? 'plan-field__input apps-field-error'
                  : 'plan-field__input'
              }
              placeholder="Wpisz imię i nazwisko"
              aria-invalid={invalidFields.includes('applicantName') || undefined}
              value={applicantName}
              onChange={(e) => {
                setApplicantName(e.target.value);
                clearFieldError('applicantName');
              }}
            />
          </label>

          <label className="plan-field">
            <span className="plan-field__label">PESEL (symulacja)</span>
            <input
              ref={peselInputRef}
              type="text"
              inputMode="numeric"
              className={
                invalidFields.includes('pesel')
                  ? 'plan-field__input apps-field-error'
                  : 'plan-field__input'
              }
              placeholder="Wpisz 11-cyfrowy numer PESEL"
              aria-invalid={invalidFields.includes('pesel') || undefined}
              value={pesel}
              onChange={(e) => {
                setPesel(e.target.value);
                clearFieldError('pesel');
              }}
            />
          </label>

          <label className="plan-field">
            <span className="plan-field__label">Numer rachunku do wypłaty zasiłku</span>
            <input
              ref={bankInputRef}
              type="text"
              className={
                invalidFields.includes('bankAccount')
                  ? 'plan-field__input apps-field-error'
                  : 'plan-field__input'
              }
              placeholder="Wpisz 26-cyfrowy numer rachunku"
              aria-invalid={invalidFields.includes('bankAccount') || undefined}
              value={bankAccount}
              onChange={(e) => {
                setBankAccount(e.target.value);
                clearFieldError('bankAccount');
              }}
            />
          </label>
        </div>
      </section>

      <nav className="apps-next-nav" aria-label="Następny krok planu">
        <Link to={`/plan/support${search}`} className="apps-next-link">
          Dalej: Wsparcie ›
        </Link>
      </nav>
    </div>
  );
}
