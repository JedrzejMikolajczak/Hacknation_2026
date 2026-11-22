import type { SpecialSituationGuide } from './caseSupportData';
import { SuperText } from '../../components/SuperText';

interface SpecialSituationCardProps {
  item: SpecialSituationGuide;
  /** Karta rozwinięta na start (np. gdy to jedyna sytuacja pasująca do planu). */
  defaultOpen?: boolean;
}

/** Zwijana karta: z listy widać same tytuły, a „Co się zmienia / Co zrobić” po rozwinięciu. */
function SpecialSituationCard({ item, defaultOpen = false }: SpecialSituationCardProps) {
  return (
    <details
      className={
        item.calmTone ? 'support-special-card support-special-card--calm' : 'support-special-card'
      }
      open={defaultOpen || undefined}
    >
      <summary className="support-special-card__summary">
        <h4 className="support-special-card__title">{item.title}</h4>
      </summary>
      <div className="support-special-card__body">
        <p className="support-special-card__text">
          <strong>Co się zmienia:</strong> {item.whatChanges}
        </p>
        <div className="support-special-card__steps-block">
          <p className="support-special-card__label">Co zrobić:</p>
          <ul className="support-special-card__steps">
            {item.whatToDo.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </div>
        <details className="support-inline-details">
          <summary className="support-inline-details__summary">Podstawa prawna</summary>
          <div className="support-inline-details__body">
            <p className="support-legal"><SuperText text={item.legalBasis} /></p>
          </div>
        </details>
      </div>
    </details>
  );
}

interface MatchedSpecialSituationsProps {
  situations: SpecialSituationGuide[];
}

export function MatchedSpecialSituations({ situations }: MatchedSpecialSituationsProps) {
  if (situations.length === 0) return null;

  return (
    <div className="support-special-list" aria-label="Sytuacje szczególne dotyczące Twojego planu">
      {situations.map((item) => (
        <SpecialSituationCard key={item.id} item={item} defaultOpen={situations.length === 1} />
      ))}
    </div>
  );
}

interface OtherSpecialSituationsDetailsProps {
  situations: SpecialSituationGuide[];
  hasMatched: boolean;
}

export function OtherSpecialSituationsDetails({
  situations,
  hasMatched,
}: OtherSpecialSituationsDetailsProps) {
  if (situations.length === 0) return null;

  return (
    <details className="support-accordion">
      <summary className="support-accordion__summary">
        {hasMatched
          ? 'Inne sytuacje szczególne'
          : 'Sytuacje szczególne (wcześniak, „Za życiem”, utrata dziecka, choroba mamy)'}
      </summary>
      <div className="support-accordion__body">
        <div className="support-special-list">
          {situations.map((item) => (
            <SpecialSituationCard key={item.id} item={item} />
          ))}
        </div>
      </div>
    </details>
  );
}
