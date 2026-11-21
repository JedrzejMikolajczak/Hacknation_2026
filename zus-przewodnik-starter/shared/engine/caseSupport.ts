import type { CaseInputs, CharitableOrganization, OfficialLink, SupportResources } from '../types';

export const CHARITABLE_ORGANIZATIONS: CharitableOrganization[] = [
  {
    id: 'nagle-sami',
    name: 'Fundacja Nagle Sami',
    legal_form: 'Fundacja (OPP)',
    helps_with: 'Śmierć dziecka, poronienie, żałoba',
    description:
      'Bezpłatny telefon wsparcia dla osób w żałobie oraz informacje o konsultacjach i grupach wsparcia.',
    url: 'https://naglesami.org.pl',
    related_situations: ['LOSS', 'MOTHER_DECEASED'],
  },
  {
    id: 'ernest',
    name: 'Fundacja Ernesta',
    legal_form: 'Fundacja',
    helps_with: 'Poronienie, martwe urodzenie, trudna ciąża',
    description:
      'Bezpłatna pomoc psychologiczna i prawna dla kobiet i rodzin po poronieniu, martwym urodzeniu lub po diagnozie choroby dziecka w ciąży.',
    url: 'https://fundacjaernesta.pl/',
    related_situations: ['LOSS', 'ZA_ZYCIEM'],
  },
  {
    id: 'wczesniak',
    name: 'Fundacja Wcześniak Rodzice-Rodzicom',
    legal_form: 'Fundacja (OPP)',
    helps_with: 'Przedwczesny poród i narodziny wcześniaka',
    description:
      'Bezpłatne wsparcie informacyjne i opiekuńcze dla rodziców dzieci urodzonych przedwcześnie oraz hospitalizowanych po porodzie.',
    url: 'https://wczesniak.pl',
    related_situations: ['PREMATURE'],
  },
  {
    id: 'gajusz',
    name: 'Fundacja Gajusz',
    legal_form: 'Fundacja (OPP)',
    helps_with: 'Urodzenie dziecka ciężko chorego',
    description:
      'Bezpłatna opieka hospicjum perinatalnego i domowego oraz wsparcie psychologiczne i socjalne dla rodzin dzieci ciężko i nieuleczalnie chorych.',
    url: 'https://gajusz.org.pl',
    related_situations: ['ZA_ZYCIEM', 'PREMATURE'],
  },
  {
    id: 'rodzic-po-ludzku',
    name: 'Fundacja Rodzić po Ludzku',
    legal_form: 'Fundacja (OPP)',
    helps_with: 'Wsparcie okołoporodowe i bezpłatna pomoc prawna',
    description:
      'Bezpłatne konsultacje prawne i informacyjne dotyczące praw kobiety w ciąży, w trakcie porodu, hospitalizacji oraz po narodzinach dziecka.',
    url: 'https://rodzicpoludzku.pl',
    related_situations: ['MOTHER_ILLNESS', 'PREMATURE', 'LOSS'],
  },
];

export const OFFICIAL_LINKS: OfficialLink[] = [
  {
    id: 'zus-main',
    label: 'ZUS – świadczenia i wzory formularzy (www.zus.pl)',
    description: 'Aktualne informacje o zasiłkach oraz formularze ZAM, Z-3, Z-3a i ZAS-53.',
    href: 'https://www.zus.pl',
  },
  {
    id: 'zus-ezus',
    label: 'PUE / eZUS – elektroniczne konto ubezpieczonego',
    description: 'Sprawdzanie składek, zwolnień e-ZLA, salda JDG i wysyłka wniosków online.',
    href: 'https://www.zus.pl/ezus',
  },
  {
    id: 'zus-ewizyta',
    label: 'e-wizyta w ZUS – bezpłatna wideorozmowa z doradcą',
    description: 'Indywidualna konsultacja online przed złożeniem dokumentów o zasiłek.',
    href: 'https://www.zus.pl/e-wizyta',
  },
  {
    id: 'mrpips-parental',
    label: 'Ministerstwo Rodziny, Pracy i Polityki Społecznej – urlop rodzicielski',
    description: 'Oficjalne zestawienie zasad urlopów rodzicielskich i opiekuńczych.',
    href: 'https://www.gov.pl/web/rodzina/urlop-rodzicielski',
  },
  {
    id: 'pip-parenting',
    label: 'Państwowa Inspekcja Pracy – porady prawne (rodzicielstwo)',
    description: 'Ochrona stosunku pracy w ciąży, przedłużenie umowy i zasady udzielania urlopów.',
    href: 'https://www.pip.gov.pl/dla-pracodawcow/porady-prawne/rodzicielstwo',
  },
  {
    id: 'usc-birth-cert',
    label: 'Rejestr Stanu Cywilnego – odpis aktu urodzenia online (gov.pl)',
    description:
      'Oficjalna usługa złożenia wniosku o odpis skrócony lub zupełny aktu stanu cywilnego.',
    href: 'https://www.gov.pl/web/cyfryzacja/rejestr-stanu-cywilnego',
  },
];

export function supportResources(input: CaseInputs): SupportResources {
  const special = input.special_circumstances;
  const situations = new Set<string>();
  if (special.stillbirth_or_child_death !== 'NONE') situations.add('LOSS');
  if (special.premature_or_hospitalized_newborn) situations.add('PREMATURE');
  if (special.za_zyciem_certificate) situations.add('ZA_ZYCIEM');
  if (special.mother_hospitalized_or_incapable) situations.add('MOTHER_ILLNESS');
  const matches = (item: CharitableOrganization) =>
    item.related_situations.some((value) => situations.has(value));
  return {
    organizations: [
      ...CHARITABLE_ORGANIZATIONS.filter(matches),
      ...CHARITABLE_ORGANIZATIONS.filter((item) => !matches(item)),
    ],
    official_links: OFFICIAL_LINKS,
  };
}
