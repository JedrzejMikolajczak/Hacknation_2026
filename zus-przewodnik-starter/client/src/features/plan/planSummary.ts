import type { CaseDocument, IsoDate } from '@shared/types';
import { diffDaysIso } from './planScenario';

/** Dokumenty, które „załatwia się samo” – wystawia je lekarz albo płatnik, rodzic ich nie składa. */
const PASSIVE_DOCUMENT_IDS = new Set(['e-ZLA', 'Z-3', 'Z-3a', 'ZAS-12']);

export interface DeliveryItem {
  key: string;
  /** Nazwa dokumentu lub wniosku, np. „Wniosek o urlop ojcowski”. */
  title: string;
  /** Kto składa: „Matka” / „Ojciec” (jak w zakładce Dokumenty). */
  who: string;
  /** Gdzie złożyć, np. „u pracodawcy”. */
  where: string;
  deadline: IsoDate | null;
  overdue: boolean;
  /** Ile dni do terminu (ujemne = po terminie); null, gdy dokument nie ma terminu. */
  daysLeft: number | null;
}

function whereToSubmit(doc: CaseDocument): string {
  switch (doc.submit_to) {
    case 'EMPLOYER':
      return /zleceniodawc/i.test(doc.name_pl) ? 'u zleceniodawcy' : 'u pracodawcy';
    case 'ZUS':
      return 'w ZUS (PUE/eZUS)';
    case 'USC':
      return 'w Urzędzie Stanu Cywilnego';
    default:
      return 'u właściwego płatnika';
  }
}

/**
 * Lista rzeczy, które rodzic ma dostarczyć – od najpilniejszej. Najpierw dokumenty z terminem
 * (rosnąco), potem te bez terminu.
 */
export function deliveryItems(documents: CaseDocument[], today: IsoDate): DeliveryItem[] {
  return documents
    .filter((doc) => !PASSIVE_DOCUMENT_IDS.has(doc.id))
    .map((doc, index): DeliveryItem => {
      const daysLeft = doc.deadline ? diffDaysIso(today, doc.deadline) : null;
      return {
        key: `${doc.id}-${doc.parent_role}-${index}`,
        title: doc.name_pl,
        who: doc.parent_role === 'FATHER' ? 'Ojciec' : 'Matka',
        where: whereToSubmit(doc),
        deadline: doc.deadline,
        overdue: doc.is_overdue || (daysLeft !== null && daysLeft < 0),
        daysLeft,
      };
    })
    .sort((a, b) => {
      if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
      if (a.deadline) return -1;
      if (b.deadline) return 1;
      return 0;
    });
}

/** „za 3 dni”, „jutro”, „dziś”, „termin minął” – albo pusty tekst, gdy termin jest odległy. */
export function relativeDeadline(item: Pick<DeliveryItem, 'daysLeft' | 'overdue'>): string {
  if (item.daysLeft === null) return '';
  if (item.overdue) return 'termin minął';
  if (item.daysLeft === 0) return 'dziś';
  if (item.daysLeft === 1) return 'jutro';
  if (item.daysLeft <= 45) return `za ${item.daysLeft} dni`;
  return '';
}
