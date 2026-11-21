import type { SituationType } from '@shared/types';

interface Article {
  slug: string;
  title: string;
  summary: string;
  situation: SituationType;
  sections: { title: string; content: string }[];
  prepare: string[];
  sources: { title: string; url: string }[];
  support?: boolean;
}

const maternityRate = {
  title: 'ZUS · Wysokość zasiłku macierzyńskiego',
  url: 'https://www.zus.pl/pl/swiadczenia/zasilki/zasilek-macierzynski/wysokosc',
};
const parentalLeave = {
  title: 'Gov.pl · Urlop rodzicielski',
  url: 'https://www.gov.pl/web/rodzina/urlop-rodzicielski',
};
const sickness = {
  title: 'ZUS · Prawo do zasiłku chorobowego',
  url: 'https://www.zus.pl/pl/swiadczenia/zasilki/zasilek-chorobowy/z-ubezpieczenia-chorobowego/prawo-do-zasilku-i-okres-przyslugiwania',
};

export const articles: Article[] = [
  {
    slug: 'planowanie',
    title: 'Planuję dziecko',
    situation: 'planning',
    summary: 'Sprawdź ubezpieczenie chorobowe i przygotuj dane do porównania świadczeń.',
    sections: [
      {
        title: 'Od czego zacząć',
        content:
          'Sprawdź, z jakiego tytułu podlegasz ubezpieczeniu chorobowemu i od kiedy. Przy zmianie zatrudnienia zanotuj daty początku i końca ubezpieczenia u każdego płatnika.',
      },
      {
        title: 'Zaplanujcie opiekę razem',
        content:
          'Ustalcie, kiedy każde z Was chce opiekować się dzieckiem i jaka jest podstawa świadczenia każdego rodzica. W kalkulatorze porównacie okresy i kwoty dla Waszej sytuacji.',
      },
    ],
    prepare: [
      'Tytuł i okresy ubezpieczenia obojga rodziców.',
      'Przewidywana data porodu, jeśli ją znasz.',
      'Dane o wynagrodzeniu lub znana podstawa wymiaru.',
    ],
    sources: [sickness, maternityRate],
  },
  {
    slug: 'ciaza',
    title: 'Chorobowe w ciąży',
    situation: 'pregnant',
    summary: 'Sprawdź okres wyczekiwania, podstawę zasiłku i dane ze zwolnienia.',
    sections: [
      {
        title: 'Kiedy przysługuje chorobowe',
        content:
          'Prawo do zasiłku zależy od ubezpieczenia. Okres wyczekiwania wynosi co do zasady 30 dni przy ubezpieczeniu obowiązkowym i 90 dni przy dobrowolnym. W niektórych sytuacjach wcześniejsze okresy ubezpieczenia się wliczają lub świadczenie przysługuje od pierwszego dnia.',
      },
      {
        title: 'Ile wynosi zasiłek',
        content:
          'Za niezdolność do pracy przypadającą w ciąży zasiłek wynosi 100% podstawy wymiaru. Okres zasiłkowy może wynieść do 270 dni. Aby ustalić, ile dni zostało, uwzględnij zasady zaliczania wcześniejszych zwolnień.',
      },
    ],
    prepare: [
      'Data początku zwolnienia i informacje z e-ZLA.',
      'Historia okresów ubezpieczenia i wykorzystanych dni chorobowego.',
    ],
    sources: [
      sickness,
      {
        title: 'ZUS · Wysokość zasiłku chorobowego',
        url: 'https://psz.zus.pl/web/guest/swiadczenia/zasilki/zasilek-chorobowy/z-ubezpieczenia-chorobowego/wysokosc',
      },
    ],
  },
  {
    slug: 'macierzynski',
    title: 'Macierzyński i stawka 81,5%',
    situation: 'afterBirth',
    summary: 'Porównaj stawki i sprawdź termin złożenia wniosku.',
    sections: [
      {
        title: 'Wymiar urlopu po porodzie',
        content:
          'Przy jednym dziecku podstawowy urlop macierzyński wynosi 20 tygodni. Przy dwojgu, trojgu i czworgu wynosi odpowiednio 31, 33 i 35 tygodni, a przy pięciorgu lub większej liczbie dzieci 37 tygodni.',
      },
      {
        title: 'Dwa warianty wypłaty',
        content:
          'Standardowe stawki to 100% podstawy za macierzyński i 70% za rodzicielski. Wniosek o wypłatę za oba okresy złożony w ciągu 21 dni po porodzie może dać stawkę 81,5%. Wyłączna część rodzicielskiego drugiego rodzica wynosząca 9 tygodni pozostaje na stawce 70%.',
      },
    ],
    prepare: [
      'Data porodu, liczba dzieci i podstawa wymiaru.',
      'Data złożenia wniosku o stawkę 81,5%, jeśli wybierasz ten wariant.',
    ],
    sources: [
      {
        title: 'Gov.pl · Urlop macierzyński',
        url: 'https://www.gov.pl/web/rodzina/urlop-macierzynski',
      },
      maternityRate,
    ],
  },
  {
    slug: 'rodzicielski',
    title: 'Podział urlopu rodzicielskiego',
    situation: 'afterBirth',
    summary: 'Rozplanuj wspólną pulę, 9 tygodni dla każdego rodzica i ewentualną pracę.',
    sections: [
      {
        title: 'Wspólna pula',
        content:
          'Po urodzeniu jednego dziecka rodzice mają co do zasady 41 tygodni urlopu rodzicielskiego. Przy porodzie mnogim pula wynosi 43 tygodnie. W tej puli każdy rodzic ma 9 tygodni na wyłączność. Gdy oboje korzystacie z urlopu w tym samym czasie, okres każdego rodzica pomniejsza wspólną pulę.',
      },
      {
        title: 'Łączenie urlopu z pracą',
        content:
          'Pracownik może złożyć wniosek o pracę na maksymalnie pół etatu u pracodawcy udzielającego urlopu. Urlop wydłuża się proporcjonalnie w granicach ustawowych. Zasiłek za okres łączenia z pracą jest odpowiednio obniżony.',
      },
    ],
    prepare: [
      'Proponowane daty i liczba tygodni dla każdego rodzica.',
      'Wymiar pracy w okresie łączenia z urlopem, jeśli to planujesz.',
    ],
    sources: [parentalLeave, maternityRate],
  },
  {
    slug: 'ojcowski',
    title: 'Urlop ojcowski',
    situation: 'afterBirth',
    summary: 'Sprawdź wymiar, podział i termin wykorzystania urlopu ojcowskiego.',
    sections: [
      {
        title: 'Ile i do kiedy',
        content:
          'Pracownik wychowujący dziecko może wykorzystać do dwóch tygodni urlopu ojcowskiego. Może wziąć je jednorazowo albo w dwóch częściach po tygodniu. Po urodzeniu urlop trzeba wykorzystać przed ukończeniem przez dziecko 12. miesiąca życia.',
      },
      {
        title: 'Po przysposobieniu',
        content:
          'Na wykorzystanie urlopu przysługuje maksymalnie 12 miesięcy od uprawomocnienia się orzeczenia o przysposobieniu, najpóźniej do ukończenia przez dziecko 14 lat.',
      },
    ],
    prepare: [
      'Data urodzenia dziecka lub data uprawomocnienia się orzeczenia.',
      'Daty wybranej części urlopu.',
    ],
    sources: [
      { title: 'Gov.pl · Urlop ojcowski', url: 'https://www.gov.pl/web/rodzina/urlop-ojcowski' },
    ],
  },
  {
    slug: 'adopcja',
    title: 'Adopcja i niezawodowa piecza zastępcza',
    situation: 'adoption',
    summary: 'Sprawdź, które daty mają znaczenie po przyjęciu dziecka na wychowanie.',
    sections: [
      {
        title: 'Co wpływa na uprawnienia',
        content:
          'Warunki zależą od formy przyjęcia dziecka, jego wieku i liczby dzieci przyjętych jednocześnie. Przy przysposobieniu znaczenie ma też wystąpienie do sądu z wnioskiem o wszczęcie postępowania. W niezawodowej pieczy zastępczej uwzględnia się odroczenie obowiązku szkolnego.',
      },
      {
        title: 'Złożenie wniosku',
        content:
          'Wniosek o urlop na warunkach macierzyńskiego składa się do pracodawcy. Sprawdź termin od zdarzenia właściwego dla Twojej ścieżki i dokumenty, które je potwierdzają.',
      },
    ],
    prepare: [
      'Data przyjęcia i data urodzenia dziecka.',
      'Informacja z sądu lub dokument potwierdzający przyjęcie do rodziny zastępczej.',
    ],
    sources: [
      { title: 'Gov.pl · Urlop adopcyjny', url: 'https://www.gov.pl/web/rodzina/urlop-adopcyjny' },
    ],
  },
  {
    slug: 'trudne-sytuacje',
    title: 'Hospitalizacja dziecka i trudne sytuacje',
    situation: 'afterBirth',
    support: true,
    summary: 'Dowiedz się, które informacje przygotować i gdzie szukać pomocy.',
    sections: [
      {
        title: 'Wcześniactwo i pobyt w szpitalu',
        content:
          'Uzupełniający urlop macierzyński zależy od ukończonego tygodnia ciąży, masy urodzeniowej i dat pobytu dziecka w szpitalu. W zależności od warunków może wynieść do 8 albo 15 tygodni. Zaświadczenie ze szpitala pozwala ustalić okres, który wlicza się do limitu.',
      },
      {
        title: 'Po stracie dziecka',
        content:
          'Obowiązują szczególne zasady ustalania okresu świadczenia. Jeśli potrzebujesz pomocy w dokumentach lub wsparcia, przejdź do zakładki Wsparcie.',
      },
    ],
    prepare: [
      'Zaświadczenie ze szpitala, jeśli dziecko było hospitalizowane.',
      'Daty zdarzeń i dokumenty, które już masz.',
    ],
    sources: [
      {
        title: 'ZUS · Uzupełniający urlop macierzyński',
        url: 'https://psz.zus.pl/web/guest/swiadczenia/zasilki/zasilek-macierzynski/prawo-do-zasilku-i-okres-przyslugiwania/za-okres-uzupelniajacego-urlopu-macierzynskiego',
      },
      {
        title: 'PIP · Rodzicielstwo i sytuacje szczególne',
        url: 'https://www.pip.gov.pl/dla-pracodawcow/porady-prawne/rodzicielstwo',
      },
    ],
  },
  {
    slug: 'faq',
    title: 'Najczęstsze pytania',
    situation: 'afterBirth',
    summary: 'Rozróżnij urlop, podstawę wymiaru i wypłacane świadczenie.',
    sections: [
      {
        title: 'Czym jest podstawa wymiaru?',
        content:
          'To kwota, od której wylicza się świadczenie. Stawka procentowa odnosi się do podstawy, a wypłata za konkretny okres zależy również od liczby dni.',
      },
      {
        title: 'Czy 9 tygodni można przekazać?',
        content:
          'Wyłączna część rodzicielskiego pozostaje do wykorzystania przez danego rodzica. Niewykorzystanych tygodni wyłącznych nie można przekazać drugiemu rodzicowi.',
      },
      {
        title: 'Gdzie sprawdzę wymagane dokumenty?',
        content:
          'Uzupełnij sytuację w kreatorze i otwórz w planie zakładkę Dokumenty i terminy. Lista zależy od świadczenia i płatnika.',
      },
    ],
    prepare: [
      'Informacje o zatrudnieniu i ubezpieczeniu.',
      'Daty zdarzeń i podstawa wymiaru, jeśli ją znasz.',
    ],
    sources: [maternityRate, parentalLeave],
  },
];
