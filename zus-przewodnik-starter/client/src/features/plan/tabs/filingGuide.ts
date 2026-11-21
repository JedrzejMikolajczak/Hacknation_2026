import type { CaseDocument } from '@shared/types';

/** Logowanie do Platformy Usług Elektronicznych ZUS (PUE/eZUS). */
export const PUE_URL = 'https://www.zus.pl/portal/';
/** E-usługa gov.pl „Uzyskaj odpis aktu stanu cywilnego” (profil zaufany lub e-dowód). */
export const USC_URL =
  'https://www.gov.pl/web/gov/uzyskaj-odpis-aktu-stanu-cywilnego-urodzenia-malzenstwa-zgonu';
/** Rejestr stanu cywilnego – informacje o odpisach aktów (gov.pl, cyfryzacja). */
export const USC_REGISTRY_URL = 'https://www.gov.pl/web/cyfryzacja/rejestr-stanu-cywilnego';
/** Opis ZUS: jak uzyskać zasiłek macierzyński (m.in. złożenie ZAM przez PUE). */
export const ZAM_GUIDE_URL =
  'https://www.zus.pl/en/-/jak-uzyskac-zasilek-macierzynski-z-tytulu-urodzenia-dziecka';
/** Formularz ZAM „wypełnij i wydrukuj” (PDF na zus.pl). */
export const ZAM_PDF_URL =
  'https://www.zus.pl/documents/10182/4223950/ZAM_wypelnij_i_wydrukuj.pdf/4e4534c6-e7cd-b934-9c5e-aab4d64f3f20';
/** Formularz ZAS-53 do wydruku (PDF na zus.pl). */
export const ZAS53_PDF_URL =
  'https://www.zus.pl/documents/10182/10157865/ZAS-53_do+wydruku.pdf/fb9f344f-b24d-031a-d1ca-18e26c19027d';

export interface GuideLink {
  href: string;
  label: string;
}

/** Dokumenty, które dzieją się „same” albo przekazuje je płatnik – użytkownik nic nie wysyła. */
const AUTOMATIC_IDS = new Set(['e-ZLA', 'Z-3', 'Z-3a', 'ZAS-12']);

/** Załączniki: użytkownik musi je zdobyć i dołączyć do wniosku. */
const ATTACHMENT_IDS = new Set([
  'BIRTH_CERTIFICATE',
  'USC_COPY',
  'ADOPTION_ORDER',
  'HOSPITAL_CERTIFICATE',
  'ZA_ZYCIEM_CERTIFICATE',
  'STILLBIRTH_CERTIFICATE',
  'DEATH_CERTIFICATE',
  'EXPECTED_BIRTH_CERTIFICATE',
]);

export type FilingKind = 'auto' | 'attachment' | 'application';
export type DeliveryChannel = 'employer' | 'zus' | 'usc' | 'auto' | 'unknown';

export interface DeliveryGuide {
  channel: DeliveryChannel;
  /** Krótko: dokąd to trafia, np. „Do pracodawcy (kadry)”. */
  where: string;
  /** Jak to zrobić – 1–2 zdania. */
  how: string;
  /** Strony do otwarcia – pierwsza jest główna (tam wysyłasz wniosek). */
  links: GuideLink[];
  /** Czy pokazać przycisk „Napisz e-mail” (mailto). */
  mail: boolean;
  /** Alternatywa offline. */
  alternative: string | null;
}

export function filingKind(doc: CaseDocument, isApplication: boolean): FilingKind {
  if (AUTOMATIC_IDS.has(doc.id)) return 'auto';
  if (isApplication) return 'application';
  if (ATTACHMENT_IDS.has(doc.id)) return 'attachment';
  return 'application';
}

export function deliveryGuide(doc: CaseDocument, mandateEntitled: boolean): DeliveryGuide {
  if (doc.id === 'e-ZLA') {
    return {
      channel: 'auto',
      where: 'Automatycznie do ZUS i płatnika',
      how: 'Lekarz wystawia zwolnienie elektronicznie – nic nie wysyłasz. Poinformuj pracodawcę lub zleceniodawcę o nieobecności.',
      links: [],
      mail: false,
      alternative: null,
    };
  }
  if (doc.id === 'Z-3' || doc.id === 'ZAS-12' || doc.id === 'Z-3a') {
    return {
      channel: 'auto',
      where: doc.id === 'Z-3a' ? 'Zleceniodawca → ZUS' : 'Pracodawca → ZUS',
      how: 'To zaświadczenie przesyła do ZUS Twój płatnik składek przez PUE/eZUS. Ty tylko złóż swój wniosek.',
      links: [],
      mail: false,
      alternative: null,
    };
  }
  if (doc.submit_to === 'EMPLOYER') {
    const who = mandateEntitled ? 'zleceniodawcy' : 'pracodawcy';
    return {
      channel: 'employer',
      where: mandateEntitled ? 'Do zleceniodawcy' : 'Do pracodawcy (kadry)',
      how: `Wyślij pobrany wniosek e-mailem do kadr lub płatnika albo złóż go papierowo u ${who}. Pamiętaj o załącznikach.`,
      links: [],
      mail: true,
      alternative: `Możesz też złożyć wydruk osobiście u ${who} i poprosić o potwierdzenie wpływu.`,
    };
  }
  if (doc.submit_to === 'ZUS') {
    if (doc.id === 'ZAM') {
      return {
        channel: 'zus',
        where: 'Do ZUS (PUE/eZUS)',
        how: 'Zaloguj się na PUE/eZUS, wybierz „Złożenie dokumentu ZAM”, uzupełnij dane i podpisz wniosek profilem zaufanym lub e-dowodem. Termin: do 21 dni po porodzie.',
        links: [
          { href: PUE_URL, label: 'Zaloguj się do PUE/eZUS' },
          { href: ZAM_GUIDE_URL, label: 'Jak złożyć ZAM – instrukcja ZUS' },
          { href: ZAM_PDF_URL, label: 'Pobierz ZAM do wydruku (PDF)' },
        ],
        mail: false,
        alternative:
          'Papierowo złożysz wydrukowany wniosek w placówce ZUS lub wyślesz listem poleconym.',
      };
    }
    if (doc.id === 'ZAS-53') {
      return {
        channel: 'zus',
        where: 'Do ZUS (PUE/eZUS)',
        how: 'Zaloguj się na PUE/eZUS, w zakładce „Usługi” wybierz formularz ZAS-53, uzupełnij go i wyślij do ZUS.',
        links: [
          { href: PUE_URL, label: 'Zaloguj się do PUE/eZUS' },
          { href: ZAS53_PDF_URL, label: 'Pobierz ZAS-53 do wydruku (PDF)' },
        ],
        mail: false,
        alternative:
          'Papierowo złożysz wydrukowany wniosek w placówce ZUS lub wyślesz listem poleconym.',
      };
    }
    return {
      channel: 'zus',
      where: 'Do ZUS (PUE/eZUS)',
      how: 'Zaloguj się na PUE/eZUS (profil zaufany, e-dowód lub login i hasło), wybierz „Dokumenty i wiadomości” i dołącz pobrany wniosek.',
      links: [{ href: PUE_URL, label: 'Zaloguj się do PUE/eZUS' }],
      mail: false,
      alternative: 'Papierowo złożysz go w placówce ZUS lub wyślesz listem poleconym.',
    };
  }
  if (doc.submit_to === 'USC') {
    return {
      channel: 'usc',
      where: 'Urząd Stanu Cywilnego (gov.pl)',
      how: 'Złóż wniosek o odpis skrócony aktu urodzenia online (profil zaufany lub e-dowód). Wybierz cel „do celów zasiłkowych” – wtedy opłata skarbowa nie obowiązuje.',
      links: [
        { href: USC_URL, label: 'Złóż wniosek na gov.pl' },
        { href: USC_REGISTRY_URL, label: 'Rejestr stanu cywilnego – informacje' },
      ],
      mail: false,
      alternative: 'Możesz też pójść do dowolnego urzędu stanu cywilnego.',
    };
  }
  return {
    channel: 'unknown',
    where: 'Do ustalenia',
    how: 'Uzupełnij dane o zatrudnieniu i wielkości płatnika, aby ustalić, gdzie złożyć dokument.',
    links: [],
    mail: false,
    alternative: null,
  };
}

/** Gdzie zdobyć załącznik – krótka wskazówka. */
export function attachmentSource(doc: CaseDocument): {
  how: string;
  link: GuideLink | null;
} {
  switch (doc.id) {
    case 'BIRTH_CERTIFICATE':
    case 'USC_COPY':
    case 'STILLBIRTH_CERTIFICATE':
    case 'DEATH_CERTIFICATE':
      return {
        how: 'Odpis skrócony wyda Urząd Stanu Cywilnego – online przez gov.pl lub na miejscu, bez opłaty do celów zasiłkowych.',
        link: { href: USC_URL, label: 'Zamów odpis na gov.pl' },
      };
    case 'HOSPITAL_CERTIFICATE':
      return {
        how: 'Poproś o zaświadczenie szpital, w którym dziecko przebywało po porodzie (okres pobytu, tydzień ciąży, masa urodzeniowa).',
        link: null,
      };
    case 'ZA_ZYCIEM_CERTIFICATE':
      return {
        how: 'Zaświadczenie wystawia lekarz specjalista (np. neonatolog, ginekolog-położnik). Zapytaj o nie podczas wizyty.',
        link: null,
      };
    case 'EXPECTED_BIRTH_CERTIFICATE':
      return {
        how: 'Zaświadczenie o przewidywanej dacie porodu wystawia lekarz prowadzący ciążę.',
        link: null,
      };
    case 'ADOPTION_ORDER':
      return {
        how: 'Dokument wydaje sąd (zaświadczenie o wystąpieniu o przysposobienie albo orzeczenie o rodzinie zastępczej).',
        link: null,
      };
    default:
      return { how: 'Zdobądź dokument i dołącz go do wniosku.', link: null };
  }
}

/** Gotowy link `mailto:` – adres wpisze użytkownik (nie znamy skrzynki kadr). */
export function buildMailto(opts: {
  title: string;
  who: string | null;
  deadline: string | null;
  attachments?: string[];
}): string {
  const lines = [
    'Dzień dobry,',
    '',
    `w załączeniu przesyłam wniosek: ${opts.title}.`,
    opts.deadline ? `Termin złożenia: ${opts.deadline}.` : '',
    opts.attachments?.length ? `Załączniki: ${opts.attachments.join('; ')}` : '',
    '',
    'Proszę o potwierdzenie otrzymania wiadomości.',
    '',
    'Z poważaniem',
  ].filter((line, index, all) => !(line === '' && all[index - 1] === ''));
  const subject = `Wniosek: ${opts.title}${opts.who ? ` (${opts.who})` : ''}`;
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
}
