/** Rodzaj zasiłku/urlopu zaznaczany w sekcji „Zakres wniosku” formularza ZAM. */
export type ZamLeave = 'maternity' | 'parental' | 'supplementary' | 'paternity';

export interface ZamPeriod {
  leave: ZamLeave;
  /** ISO `YYYY-MM-DD` */
  start: string;
  end: string;
  /** Numer części (urlop rodzicielski / ojcowski), jeśli jest znany. */
  part?: number | null;
}

export interface ApplicantData {
  name: string;
  pesel: string;
  /** ISO `YYYY-MM-DD` albo pusty. */
  birthDate: string;
  bank: string;
}

export interface LetterSection {
  label: string;
  value: string;
}

/**
 * Wszystko, czego potrzeba do wygenerowania pliku PDF wniosku.
 * - `zam` i `zas53` wypełniają oficjalne formularze ZUS,
 * - `letter` buduje pismo (wniosek do pracodawcy / USC) w układzie urzędowego pisma.
 */
export interface ApplicationPdfData {
  kind: 'zam' | 'zas53' | 'letter';
  title: string;
  recipient: string;
  /** Miejsce złożenia, np. „Pracodawca” – pokazywane nad treścią pisma. */
  applicant: ApplicantData;
  /** Dzisiejsza data ISO – wstawiana jako data wniosku. */
  todayIso: string;
  /** Pola opisujące wniosek (tabela w piśmie). */
  sections: LetterSection[];
  attachments: string[];
  legalNote: string;
  /** Dane do formularza ZAM. */
  zamPeriods?: ZamPeriod[];
  /** Powód wniosku w ZAM: urodzenie dziecka vs. przyjęcie na wychowanie. */
  zamReason?: 'birth' | 'adoption' | 'foster';
  /** Ubezpieczenie chorobowe dobrowolne (osoby prowadzące działalność itd.). */
  voluntarySickness?: boolean | null;
  /** Łączny wniosek o 81,5% – „pełny wymiar urlopów”. */
  fullLeaveDeclaration?: boolean;
  /** Data urodzenia / przyjęcia dziecka (ISO) – wpisywana w dane dziecka. */
  childDate?: string | null;
  /** Ręczne dopiski, których nie znamy (np. adres) – wypisywane w podsumowaniu. */
  manualFields: string[];
}
