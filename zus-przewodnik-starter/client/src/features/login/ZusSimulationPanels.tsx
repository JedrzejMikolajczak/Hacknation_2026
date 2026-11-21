import type { BenefitParams, IsoDate, SickLeaveCertificate } from '@shared/types';
import { DEFAULT_PARAMS } from '../../app/benefitParams';
import { diffDaysIso, formatPln, formatPolishDate } from '../plan/planScenario';
import './ZusSimulationPanels.css';

interface ContributionDebtCertificateProps {
  payerName?: string | null;
  asOfDate: IsoDate;
  contributionDebt: number;
  params?: BenefitParams;
  onApplyDebt?: (amount: number) => void;
}

/**
 * Symulacja zaświadczenia ZUS o stanie zadłużenia składkowego dla JDG
 * na dzień powstania prawa do świadczenia (art. 2a ustawy zasiłkowej).
 */
export function ContributionDebtCertificate({
  payerName,
  asOfDate,
  contributionDebt,
  params = DEFAULT_PARAMS,
  onApplyDebt,
}: ContributionDebtCertificateProps) {
  const threshold =
    Math.round(
      params.benefitBase.minimumWage * params.selfEmployedDebtThresholdShareOfMinimumWage * 100,
    ) / 100;
  const aboveThreshold = contributionDebt > threshold;
  const hasAnyDebt = contributionDebt > 0;
  const panelClass = aboveThreshold
    ? 'zus-panel zus-panel--warning'
    : 'zus-panel zus-panel--ok';

  return (
    <section
      className={panelClass}
      aria-label="Zaświadczenie o stanie zadłużenia składkowego (symulacja)"
    >
      <div className="zus-panel__header">
        <h3 className="zus-panel__title">Zaświadczenie o stanie zadłużenia składkowego</h3>
        <span className={aboveThreshold ? 'zus-panel__badge zus-panel__badge--warn' : 'zus-panel__badge zus-panel__badge--ok'}>
          {aboveThreshold ? 'Przekracza próg' : hasAnyDebt ? 'W progu ustawowym' : 'Brak zaległości'}
        </span>
      </div>

      <dl className="zus-panel__meta">
        {payerName && (
          <div className="zus-panel__meta-row">
            <dt>Płatnik składek (JDG)</dt>
            <dd>{payerName}</dd>
          </div>
        )}
        <div className="zus-panel__meta-row">
          <dt>Stan na dzień powstania prawa</dt>
          <dd>{formatPolishDate(asOfDate)}</dd>
        </div>
        <div className="zus-panel__meta-row">
          <dt>Zadłużenie z tytułu składek</dt>
          <dd>{formatPln(contributionDebt)}</dd>
        </div>
        <div className="zus-panel__meta-row">
          <dt>Próg ustawowy (1% minimalnego wynagrodzenia)</dt>
          <dd>{formatPln(threshold)}</dd>
        </div>
      </dl>

      <p className="zus-panel__status" role={aboveThreshold ? 'alert' : undefined}>
        {aboveThreshold
          ? `Zaległość (${formatPln(contributionDebt)}) przekracza próg ${formatPln(threshold)} – ZUS nie wypłaci zasiłku do czasu spłaty (art. 2a ustawy zasiłkowej).`
          : hasAnyDebt
            ? `Zaległość (${formatPln(contributionDebt)}) nie przekracza progu ${formatPln(threshold)} – prawo do zasiłku jest zachowane.`
            : 'Brak zaległości w składkach ZUS na dzień powstania prawa – warunek art. 2a ustawy zasiłkowej jest spełniony.'}
      </p>

      <p className="zus-panel__note">
        Symulacja danych ZUS · kwota zadłużenia jest przekazywana bezpośrednio do silnika obliczeń.
      </p>

      {onApplyDebt && (
        <div>
          <button
            type="button"
            className="zus-panel__action"
            onClick={() => onApplyDebt(contributionDebt)}
          >
            Przepisz kwotę zadłużenia z ZUS ({formatPln(contributionDebt)})
          </button>
        </div>
      )}
    </section>
  );
}

interface SickLeavePreviewProps {
  certificates: SickLeaveCertificate[];
  onSelectStartDate?: (cert: SickLeaveCertificate) => void;
  selectedStartDate?: string | null;
}

/**
 * Symulacja podglądu elektronicznych zwolnień lekarskich e-ZLA z danych ZUS,
 * z wyróżnieniem kodu literowego „B” (ciąża) i możliwością podpowiedzi daty w formularzu.
 */
export function SickLeavePreview({
  certificates,
  onSelectStartDate,
  selectedStartDate,
}: SickLeavePreviewProps) {
  if (certificates.length === 0) return null;

  const sorted = certificates
    .slice()
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const pregnancyCount = sorted.filter((cert) => cert.pregnancyCode).length;

  return (
    <section className="zus-panel" aria-label="Podgląd e-ZLA z kodem „B” (symulacja)">
      <div className="zus-panel__header">
        <h3 className="zus-panel__title">Podgląd zwolnień e-ZLA (symulacja ZUS)</h3>
        <span className="zus-panel__badge zus-panel__badge--code-b">
          {pregnancyCount > 0 ? `Kod „B” (ciąża): ${pregnancyCount}` : `Łącznie: ${sorted.length}`}
        </span>
      </div>

      <ul className="zus-ezla-list" role="list">
        {sorted.map((cert) => {
          const days = diffDaysIso(cert.startDate, cert.endDate) + 1;
          const isApplied = selectedStartDate === cert.startDate;
          return (
            <li
              key={cert.id}
              className={
                cert.pregnancyCode
                  ? 'zus-ezla-item zus-ezla-item--pregnancy'
                  : 'zus-ezla-item'
              }
            >
              <div className="zus-ezla-item__info">
                <div className="zus-ezla-item__top">
                  <span className="zus-ezla-item__id">{cert.id}</span>
                  <span
                    className={
                      cert.pregnancyCode
                        ? 'zus-panel__badge zus-panel__badge--code-b'
                        : 'zus-panel__badge'
                    }
                  >
                    {cert.pregnancyCode ? 'Kod „B” (ciąża – 100%)' : 'Zwolnienie zwykłe'}
                  </span>
                </div>
                <span className="zus-ezla-item__dates">
                  {formatPolishDate(cert.startDate)}–{formatPolishDate(cert.endDate)} ({days} dni)
                </span>
              </div>

              {onSelectStartDate && cert.pregnancyCode && (
                <button
                  type="button"
                  className="zus-panel__action"
                  onClick={() => onSelectStartDate(cert)}
                >
                  {isApplied
                    ? `Wybrano początek (${formatPolishDate(cert.startDate)})`
                    : `Podpowiedz początek (${formatPolishDate(cert.startDate)})`}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <p className="zus-panel__note">
        Dane symulowane z PUE/eZUS. Zwolnienie z kodem literowym „B” potwierdza niezdolność do
        pracy w okresie ciąży i podpowiada początek zwolnienia w formularzu.
      </p>
    </section>
  );
}
