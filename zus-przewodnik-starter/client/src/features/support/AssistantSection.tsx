import type { BenefitParams } from '@shared/types';
import { FaqDetails } from './FaqSection';

interface AssistantSectionProps {
  params: BenefitParams;
}

/** Zachowany eksport dla zgodności – prezentuje bazę „Najczęstsze pytania” bez fałszywej etykiety AI. */
export function AssistantSection({ params }: AssistantSectionProps) {
  return <FaqDetails params={params} />;
}
