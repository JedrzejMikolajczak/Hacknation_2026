# Kalkulator świadczeń

Moduł TypeScript dla REST API. Importuj funkcje z `modules/03-kalkulator/index.ts` i parametry z `zus-przewodnik-starter/shared/params.json`. Funkcje są synchroniczne, bez I/O i bez zapisywania danych. Wspólne typy pozostają w starterze.

## Uruchomienie

Node.js 24 lub nowszy. W tym katalogu wykonaj `npm ci`, `npm test` i `npm run typecheck`. Testy używają wbudowanego runnera Node i wykonują TypeScript bez kompilacji. Nie wymagają usług zewnętrznych.

## Funkcje

- `calculateBenefitBase(input, params)` oblicza podstawę pracownika, zleceniobiorcy oraz JDG z pełnymi miesiącami. Obsługuje minimum proporcjonalne do etatu, uzupełnianie usprawiedliwionych nieobecności, ponowne wykorzystanie podstawy i proporcjonalną nadwyżkę JDG z art. 48a.
- `checkEligibility(input, params)` sprawdza ubezpieczenie na dzień porodu, zadłużenie i płatnika dla macierzyńskiego. Wynik ojca oznacza możliwość korzystania z właściwych mu okresów, a nie prawo do całego urlopu matki.
- `calculateMaternity(input, params)` przygotowuje standardowy plan od porodu, uwzględnia liczbę dzieci, zaświadczenie Za życiem, podstawy obojga rodziców i termin wniosku o 81,5%. Ojciec korzysta z rodzicielskiego równolegle z matką. Przy braku uprawnienia matki ojciec otrzymuje swoją dostępną pulę rodzicielskiego. Indywidualny harmonogram należy do modułu kalendarza.
- `calculateSicknessInPregnancy(input, params)` ocenia pierwszy dzień niezdolności w czasie aktywnego ubezpieczenia, okres wyczekiwania, zadłużenie, pozostały limit i wynagrodzenie chorobowe.
- `calculateBenefitAmount(base, rate, days)` oblicza kwotę dzienną i sumę za dni kalendarzowe. Dzienną wypłatę zaokrągla do groszy przed mnożeniem. `monthlyAmount` w planie jest kwotą za umowne 30 dni, a nie wypłatą za dowolny miesiąc kalendarzowy.

## Uzupełnienia wejścia

Eksportowane typy `BaseInput`, `MaternityInput` i `SicknessInput` rozszerzają typy startera. Pola są opcjonalne na poziomie TypeScript dla zgodności importów, ale funkcje wymagają ich w odpowiednich ścieżkach.

- Podstawa pracownika wymaga `employmentFraction` oraz `insuredSince`. `incomes` zawiera komplet pełnych miesięcy aktualnego ubezpieczenia. `grossAmount` to miesięczne wynagrodzenie podlegające uwzględnieniu, przed standardowym odliczeniem składek. Przy stałym wynagrodzeniu podaj `contractMonthlySalary`; przy zmiennym pozostaw null. Usprawiedliwione nieobecności potwierdza `absencesJustified`. Zmianę etatu sygnalizuj przez `employmentFractionChanged`.
- Krótkie ubezpieczenie JDG wymaga `minimumContributionBases` dla każdego miesiąca i `creditedPreviousMonths`, także gdy jest to zero. Kwoty dochodu JDG oznaczają rzeczywiste podstawy składek za te miesiące. Historyczne ograniczenia składek muszą być już uwzględnione w danych.
- Wariant 81,5% wymaga `combinedApplicationDate`.
- Chorobowy wymaga `sicknessStartDate`, `creditedInsuranceDays`, `waitingPeriodExempt`, `sicknessDaysUsed`; pracownik również `employerSickPayDaysUsed` i `yearTurned50`. Zaliczane okresy i wyjątki muszą zostać potwierdzone na podstawie historii. Liczba ubezpieczonych dla płatnika musi być ustalona zgodnie z art. 61, w szczególności właściwą datą referencyjną.

`CalculationError` zawiera `code = VALIDATION_ERROR`, `field` i polski komunikat. API powinno zwrócić HTTP 422 i poprosić o wskazane dane. Brak informacji nie jest decyzją odmowną.

## Zakres wymagający dalszego rozszerzenia

Adopcja, hospitalizacja, zgon dziecka i przejmowanie urlopu w szczególnych okolicznościach wymagają dodatkowej osi czasu. Silnik blokuje te scenariusze. Podobnie blokuje ustanie wcześniejszego ubezpieczenia zamiast automatycznie odmawiać świadczenia. Brakuje pełnej obsługi art. 30, pierwszego miesiąca niepracownika z art. 49, nieobecności niepracowników z art. 50, składników kwartalnych i rocznych, zmiany etatu oraz podwyższenia macierzyńskiego do kwoty świadczenia rodzicielskiego. Kwoty zwracane przez silnik są brutto przed tym podwyższeniem i rozliczeniami podatkowymi. Kwoty netto i wyrównanie po niewykorzystaniu rodzicielskiego wymagają osobnego modułu.

`variants` pozostaje null. Każdy wariant można policzyć oddzielnie z właściwą datą wniosku. Weryfikacja wersji parametrów obejmuje datę początkową; wywołujący odpowiada za wybór właściwej wersji dla daty zdarzenia. Standardowe odliczenie 13,71% dla pracownika wymaga potwierdzenia, że odpowiada faktycznie potrąconym składkom.

## Źródła i weryfikacja

Podstawą implementacji są przekazane załącznik DOCX, wyciąg ustawy zasiłkowej (art. 2a, 4, 29–31, 36–38, 43, 45, 48–48a, 61) i Kodeks pracy. Testy są syntetyczne. W `docs/test-cases.md` nie ma jeszcze spraw ZUS z decyzjami, więc zgodność z zestawami jury pozostaje niezweryfikowana.

Oficjalne źródła uzupełniające sprawdzone podczas implementacji:

- https://www.zus.pl/pl/swiadczenia/zasilki/zasilek-macierzynski/wysokosc
- https://www.zus.pl/swiadczenia/zasilki/zasilek-macierzynski/podstawa-wymiaru/dla-pracownikow
- https://www.zus.pl/swiadczenia/zasilki/zasilek-macierzynski/podstawa-wymiaru/dla-ubezpieczonych-niebedacych-pracownikami

Przed prezentacją integracyjną należy dołączyć przypadki jury i rozszerzyć wymienione ścieżki. Ten moduł nie stanowi potwierdzenia zatwierdzenia rozwiązania przez ZUS.
