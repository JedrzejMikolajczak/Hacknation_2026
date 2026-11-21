import { useState } from 'react';
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
  getScenarioEventDate,
} from '../planScenario';

interface ApplicationsTabProps {
  scenario: ScenarioInput;
  params: BenefitParams;
  maternity: MaternityCalculationResult;
  checklist: DocumentChecklist;
}

interface ApplicationFormItem {
  id: string;
  code: string;
  title: string;
  subtitle: string;
  submitTo: Payer | 'usc';
  channelLabel: string;
  legalBasis: string;
  fields: { label: string; value: string }[];
}

interface SentReceipt {
  applicationId: string;
  referenceNumber: string;
  sentAt: string;
  recipient: string;
  applicantName: string;
}

export function ApplicationsTab({
  scenario,
  params,
  maternity,
  checklist,
}: ApplicationsTabProps) {
  const [applicantName, setApplicantName] = useState('Anna Kowalska');
  const [peselMasked, setPeselMasked] = useState('940512*****');
  const [bankAccount, setBankAccount] = useState('PL 61 1090 1014 0000 0712 1981 2874');
  const [receipts, setReceipts] = useState<Record<string, SentReceipt>>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const eventDate = getScenarioEventDate(scenario);
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
    title: 'Wniosek o skrócony odpis aktu urodzenia dziecka',
    subtitle:
      'Elektroniczny odpis z Rejestru Stanu Cywilnego (załącznik niezbędny do przyznania zasiłku macierzyńskiego).',
    submitTo: 'usc',
    channelLabel: 'Elektronicznie do Urzędu Stanu Cywilnego (ePUAP / mObywatel – symulacja)',
    legalBasis: 'Prawo o aktach stanu cywilnego; Rozporządzenie MRPiPS poz. 1316',
    fields: [
      { label: 'Wnioskodawca (rodzic)', value: applicantName },
      { label: 'Data zdarzenia (porodu)', value: formatPolishDate(eventDate) },
      { label: 'Liczba dzieci', value: String(scenario.childrenCount) },
      { label: 'Cel pobrania', value: 'Złożenie wniosku o zasiłek macierzyński w ZUS / u pracodawcy (zwolniony z opłaty skarbowej)' },
    ],
  });

  // 2. Wniosek do pracodawcy o urlop macierzyński i rodzicielski (dla UoP)
  if (scenario.mother.insuranceTitle === 'employment') {
    const isCombined = scenario.rateVariant === 'combined';
    forms.push({
      id: 'employer-leave-request',
      code: isCombined ? 'WNIOSEK-81,5%' : 'WNIOSEK-KP',
      title: isCombined
        ? `Wniosek do pracodawcy o pełny urlop macierzyński i rodzicielski (${formatRate(params.rates.combined)})`
        : 'Wniosek do pracodawcy o urlop macierzyński i urlop rodzicielski',
      subtitle:
        'Automatycznie uzupełniony na podstawie danych z planu i Kodeksu pracy (Rozporządzenie MRPiPS poz. 322).',
      submitTo: 'employer',
      channelLabel: 'Elektronicznie do pracodawcy (dział kadr / system płatnika – symulacja)',
      legalBasis: 'KP art. 180, art. 182¹a; ustawa zasiłkowa art. 30a',
      fields: [
        { label: 'Pracownik', value: `${applicantName} (PESEL: ${peselMasked})` },
        { label: 'Data rozpoczęcia urlopu', value: formatPolishDate(eventDate) },
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
    subtitle:
      'Zintegrowany druk ZUS (od 24.10.2026 obejmuje także dawne formularze ZUR i ZAO).',
    submitTo: checklist.payer,
    channelLabel:
      checklist.payer === 'employer'
        ? 'Przekaz do pracodawcy (> 20 ubezpieczonych) – symulacja'
        : 'Wysyłka elektroniczna przez PUE / eZUS bezpośrednio do ZUS – symulacja',
    legalBasis: 'Ustawa zasiłkowa art. 29–31; Rozporządzenie poz. 1316',
    fields: [
      { label: 'Ubezpieczony', value: `${applicantName} (PESEL: ${peselMasked})` },
      { label: 'Tytuł ubezpieczenia', value: formatInsuranceTitle(scenario.mother.insuranceTitle) },
      { label: 'Podstawa wymiaru zasiłku', value: formatPln(scenario.mother.benefitBase) },
      { label: 'Numer rachunku do wypłaty', value: bankAccount },
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
      channelLabel: 'Automatyczny przekaz przez PUE / eZUS (symulacja)',
      legalBasis: 'Ustawa zasiłkowa art. 61b',
      fields: [
        { label: 'Ubezpieczony', value: applicantName },
        { label: 'Tytuł ubezpieczenia', value: formatInsuranceTitle(scenario.mother.insuranceTitle) },
        { label: 'Podstawa wymiaru', value: formatPln(scenario.mother.benefitBase) },
      ],
    });
  }

  // 5. ZUS ZAS-53 (w ciąży)
  if (scenario.situation === 'pregnant') {
    forms.push({
      id: 'zus-zas53',
      code: 'ZUS ZAS-53',
      title: 'Wniosek o zasiłek chorobowy w okresie ciąży (kod „B” – 100%)',
      subtitle: 'Wniosek powiązany ze zwolnieniem lekarskim e-ZLA z kodem literowym „B”.',
      submitTo: checklist.payer,
      channelLabel:
        checklist.payer === 'employer'
          ? 'Przekaz do pracodawcy – symulacja'
          : 'Wysyłka elektroniczna przez PUE / eZUS – symulacja',
      legalBasis: 'Ustawa zasiłkowa art. 8, art. 11 ust. 2 pkt 1',
      fields: [
        { label: 'Ubezpieczona', value: `${applicantName} (PESEL: ${peselMasked})` },
        { label: 'Stawka zasiłku', value: `${formatRate(params.rates.sicknessPregnancy)} podstawy wymiaru` },
        { label: 'Rachunek bankowy', value: bankAccount },
      ],
    });
  }

  function sendOne(form: ApplicationFormItem) {
    const cleanCode = form.code.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    const seq = String(Object.keys(receipts).length + 1).padStart(3, '0');
    const ref = `UPO-2026-${cleanCode}-${seq}`;
    const recipient =
      form.submitTo === 'employer'
        ? 'Pracodawca (Płatnik składek)'
        : form.submitTo === 'usc'
          ? 'Urząd Stanu Cywilnego (RSC / mObywatel)'
          : 'Zakład Ubezpieczeń Społecznych (PUE / eZUS)';

    setReceipts((prev) => ({
      ...prev,
      [form.id]: {
        applicationId: form.id,
        referenceNumber: ref,
        sentAt: `${scenario.referenceDate} 15:50`,
        recipient,
        applicantName,
      },
    }));
    setStatusMessage(`Wysłano wniosek ${form.code} do: ${recipient} (nr potwierdzenia: ${ref}).`);
  }

  function sendAll() {
    const nextReceipts: Record<string, SentReceipt> = { ...receipts };
    let seq = Object.keys(receipts).length + 1;
    let count = 0;

    for (const form of forms) {
      if (!nextReceipts[form.id]) {
        const cleanCode = form.code.replace(/[^A-Z0-9]/gi, '').toUpperCase();
        const ref = `UPO-2026-${cleanCode}-${String(seq).padStart(3, '0')}`;
        const recipient =
          form.submitTo === 'employer'
            ? 'Pracodawca (Płatnik składek)'
            : form.submitTo === 'usc'
              ? 'Urząd Stanu Cywilnego (RSC / mObywatel)'
              : 'Zakład Ubezpieczeń Społecznych (PUE / eZUS)';
        nextReceipts[form.id] = {
          applicationId: form.id,
          referenceNumber: ref,
          sentAt: `${scenario.referenceDate} 15:50`,
          recipient,
          applicantName,
        };
        seq += 1;
        count += 1;
      }
    }
    setReceipts(nextReceipts);
    if (count > 0) {
      setStatusMessage(
        `Wysłano elektronicznie pakiet ${count} wniosków (symulacja PUE/eZUS, pracodawca oraz USC).`,
      );
    }
  }

  const allSent = forms.every((form) => Boolean(receipts[form.id]));

  return (
    <div className="plan-tab-content">
      <section className="plan-section" aria-labelledby="apps-prefill-heading">
        <div className="docs-header-row">
          <div>
            <h2 id="apps-prefill-heading" className="plan-section__title">
              Automatycznie wypełnione wnioski i odpis aktu urodzenia
            </h2>
            <p className="plan-section__lead">
              Dane z Twojego planu są automatycznie wpisane w poniższe formularze. Wersja
              demonstracyjna symuluje wysyłkę elektroniczną (bez przesyłania danych osobowych na
              serwer).
            </p>
          </div>
          <button
            type="button"
            className="plan-btn plan-btn--primary"
            disabled={allSent}
            onClick={sendAll}
          >
            {allSent ? 'Wszystkie wnioski wysłane ✓' : `Wyślij wszystkie wnioski (${forms.length}) ›`}
          </button>
        </div>

        <div className="plan-controls__grid">
          <label className="plan-field">
            <span className="plan-field__label">Imię i nazwisko wnioskodawcy</span>
            <input
              type="text"
              className="plan-field__input"
              value={applicantName}
              onChange={(e) => setApplicantName(e.target.value)}
            />
          </label>
          <label className="plan-field">
            <span className="plan-field__label">PESEL (symulacja)</span>
            <input
              type="text"
              className="plan-field__input"
              value={peselMasked}
              onChange={(e) => setPeselMasked(e.target.value)}
            />
          </label>
          <label className="plan-field">
            <span className="plan-field__label">Numer rachunku do wypłaty zasiłku</span>
            <input
              type="text"
              className="plan-field__input"
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value)}
            />
          </label>
        </div>
      </section>

      {statusMessage && (
        <div className="plan-callout plan-callout--success" role="status">
          <strong>Potwierdzenie wysyłki (symulacja):</strong> {statusMessage}
        </div>
      )}

      <div className="apps-list">
        {forms.map((form) => {
          const receipt = receipts[form.id];
          return (
            <article
              key={form.id}
              className={receipt ? 'app-card app-card--sent' : 'app-card'}
            >
              <div className="app-card__badges">
                <span className="plan-badge plan-badge--code">{form.code}</span>
                <span className="plan-badge plan-badge--navy">
                  Adresat:{' '}
                  {form.submitTo === 'employer'
                    ? 'Pracodawca'
                    : form.submitTo === 'usc'
                      ? 'Urząd Stanu Cywilnego'
                      : 'ZUS (PUE / eZUS)'}
                </span>
                {receipt && <span className="plan-badge plan-badge--yes">Wysłano ✓</span>}
              </div>

              <h3 className="app-card__title">{form.title}</h3>
              <p className="app-card__subtitle">{form.subtitle}</p>
              <p className="plan-legal">Podstawa prawna: {form.legalBasis}</p>

              <dl className="app-card__fields">
                {form.fields.map((field) => (
                  <div key={field.label}>
                    <dt>{field.label}</dt>
                    <dd>{field.value}</dd>
                  </div>
                ))}
              </dl>

              {receipt ? (
                <div
                  className="app-card__receipt"
                  role="region"
                  aria-label={`Potwierdzenie wysłania ${form.code}`}
                >
                  <strong>UPO – Potwierdzenie złożenia ({receipt.referenceNumber})</strong>
                  <p>
                    Odbiorca: <strong>{receipt.recipient}</strong> · Nadawca:{' '}
                    <strong>{receipt.applicantName}</strong> · Data: {receipt.sentAt}
                  </p>
                </div>
              ) : (
                <div className="app-card__footer">
                  <span className="app-card__channel">{form.channelLabel}</span>
                  <button
                    type="button"
                    className="plan-btn plan-btn--primary"
                    onClick={() => sendOne(form)}
                  >
                    {`Wyślij wniosek ${form.code} ›`}
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
