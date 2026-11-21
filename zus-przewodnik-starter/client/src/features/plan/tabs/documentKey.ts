import type { CaseDocument } from '@shared/types';

/** Stabilny klucz dokumentu w planie – ten sam w mapie składania i we wnioskach. */
export const documentKey = (doc: CaseDocument) =>
  `${doc.parent_role}-${doc.id}-${doc.start_date ?? ''}-${doc.end_date ?? ''}`;
