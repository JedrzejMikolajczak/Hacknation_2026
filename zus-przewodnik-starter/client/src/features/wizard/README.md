# Formularz bez mObywatela

## Cel

Kreator zbiera dane rodziny do późniejszego sprawdzania uprawnień, wyliczeń i planu urlopów. Jest dostępny po wybraniu sytuacji na stronie startowej i kliknięciu „Kontynuuj bez logowania”. Korzysta wyłącznie z istniejących zależności projektu.

## Ścieżki

- Na początku użytkownik wybiera wspólny plan mamy i taty albo plan samodzielnej mamy lub taty. Formularz pyta o dane każdego wskazanego rodzica osobno.
- Planowanie i ciąża: orientacyjny lub przewidywany termin, liczba dzieci do symulacji, ubezpieczenie i plany rodziców. Dane faktycznego porodu nie są zbierane.
- Po porodzie: faktyczna data i liczba dzieci. Pytania o tydzień ciąży, masę urodzeniową i długość hospitalizacji pojawiają się po wskazaniu pobytu dziecka w szpitalu.
- Adopcja lub rodzina zastępcza: rodzaj opieki, planowane lub zakończone przyjęcie, odpowiednia data, wiek i liczba dzieci.
- Ubezpieczenie: pytania zależą od formy zatrudnienia każdego rodzica. Podstawa wymiaru jest opcjonalna; formularz nie utożsamia jej z wynagrodzeniem.
- Po porodzie: pytanie o szczególne okoliczności (martwe urodzenie, zgon dziecka z datą). Po stracie dziecka formularz pomija pytania o szpital, „Za życiem” i wariant stawki.
- „Za życiem” jest zadawane w ciąży i po porodzie. Gdy w planie jest tata, formularz pyta o sytuację mamy (szpital, niezdolność do samodzielnej egzystencji, a po porodzie także zgon).
- Pobyt mamy w szpitalu i orzeczenie można wskazać jednocześnie. Po wskazaniu zgonu kreator pyta o jego datę i przechodzi do danych taty. Wcześniejsze odpowiedzi o ubezpieczeniu, urlopie i kwotach mamy są usuwane ze szkicu.
- Umowa o pracę i zlecenie: liczba osób zgłaszanych przez płatnika (kto wypłaca zasiłek). Mama na umowie o pracę: wiek (wynagrodzenie chorobowe) oraz, w ciąży i po porodzie, upadłość lub likwidacja pracodawcy.
- Mama z ubezpieczeniem chorobowym, w ciąży lub po porodzie: zwolnienie lekarskie w ciąży – od kiedy i czy trwało (potrwa) do porodu, a jeśli nie – do kiedy.
- Plany i kwoty: gdy podstawa wymiaru jest nieznana – przeciętne wynagrodzenie brutto i wynagrodzenie z umowy (umowa o pracę, zlecenie) albo zadeklarowana podstawa składek (JDG). Dla nowego wniosku 81,5% można wybrać do końca 21. dnia od porodu lub przyjęcia dziecka. Później kreator wybiera stawki rozdzielone i pokazuje datę upływu terminu.

Jedno główne pytanie jest wyświetlane na ekranie. Pasek postępu odnosi się do pięciu stałych etapów: rodzina, dziecko, ubezpieczenie, plany i kwoty, podsumowanie. Rozwinięcie pytań dodatkowych nie zmienia liczby etapów. Podsumowanie pozwala edytować dowolną odpowiedź; nowo wymagane pytania trzeba uzupełnić przed zapisaniem.

## Uruchomienie

W katalogu `zus-przewodnik-starter` uruchom `npm install`, a następnie `npm run dev`. Otwórz `http://localhost:5173`, wybierz sytuację i przejdź do formularza. Sprawdź ścieżki dla dwojga rodziców i dla jednej osoby, odśwież stronę w połowie formularza, a następnie zmień skład rodziny w podsumowaniu. Odpowiedzi dotyczące usuniętego rodzica powinny zniknąć. `npm run test -w client` uruchamia testy ścieżek, walidacji i zapisu.

## Dane dla kolejnych modułów

W pustym pytaniu listy dnia, miesiąca i roku pokazują dzisiejszą datę według zegara przeglądarki. Rozwiń listę roku i przewiń od bieżącego roku w górę lub w dół. Przycisk „Dalej” zatwierdza wyświetloną datę po walidacji. Powrót do pytania pokazuje zapisaną odpowiedź. Daty zapisują się jako ISO `YYYY-MM-DD`, a w podsumowaniu wyświetlają się jako `DD/MM/YYYY`.

`useScenario()` udostępnia:

- `scenario`: typowany szkic danych oparty na typach z `shared/types.ts`, zapisany pod kluczem `zus-manual-scenario-v1`.
- `manualForm`: wersjonowany stan kreatora (`version: 2`, sytuacja, odpowiedzi, identyfikator bieżącego pytania, potwierdzenie zakończenia), zapisany pod kluczem `zus-manual-form-v2`. `manualForm.answers.family` przyjmuje `both`, `motherOnly` lub `fatherOnly`. Odpowiedź `unknown` oznacza świadome odłożenie informacji.
- `storageAvailable`: informacja o powodzeniu zapisu. Gdy przeglądarka blokuje zapis, formularz pokazuje, że dane są dostępne tylko do zamknięcia strony.

Każda odpowiedź i przejście między pytaniami zapisują oba obiekty. Po zmianie sytuacji na stronie startowej powstaje nowy formularz. Zmiana gałęzi usuwa nieaktualne odpowiedzi: np. wybór samodzielnego rodzica usuwa dane drugiego rodzica, zmiana zatrudnienia usuwa wcześniejsze dane tego ubezpieczenia, a rezygnacja z pytania o hospitalizację usuwa jej szczegóły. Stary numer kroku z pierwszej wersji kreatora jest wycofany; bez nowego stanu formularz rozpoczyna się od wyboru rodziny.

**Zakończenie formularza nie oznacza gotowości do obliczeń.** Można świadomie pozostawić dane do uzupełnienia. Kwoty i daty nieznane są `null`; nieznane wartości logiczne i tytuł ubezpieczenia pozostają nieustawione. Nie są zamieniane na `false`, zero ani brak ubezpieczenia. Brak rodzica w planie to `mother: null` lub `father: null`.

Nowe pola szkicu:

- `rateVariant`: `'combined'` albo `'standard'`; brak pola = użytkownik chce porównania obu wariantów.
- `mother.age`, `<rodzic>.employerInsuredCount`: liczby albo `null`.
- `special`: `stillbirth`, `childDeathDate`, `zaZyciemCertificate`, `motherHospitalized`, `motherIncapableOfIndependentLiving`, `motherDeceased`, `employerBankruptcyOrLiquidation` – tylko gdy pytanie padło; nieznane wartości logiczne pozostają nieustawione.
- `benefitBaseInputs.<rodzic>`: gotowy `BenefitBaseInput` dla `POST /api/v1/calculate/benefit-base`, tworzony tylko przy nieznanej podstawie. `rightArisesOn` = data porodu, przewidywany termin, data przyjęcia albo dzień wypełnienia. `incomes` to pełne miesiące kalendarzowe przed miesiącem powstania prawa (`params.benefitBase.lookbackMonths`, nie wcześniej niż od początku ubezpieczenia) z podanym przeciętnym wynagrodzeniem. Dla JDG `incomes` jest puste, a kwota trafia do `declaredContributionBase`. Formularz niczego nie liczy – podstawę liczy silnik.

- `pregnancySickLeave`: `{ startDate, endDate, untilBirth }` albo `null` (mama nie była na zwolnieniu). Przy zwolnieniu do porodu `endDate` = dzień przed porodem (albo przed przewidywanym terminem).
- `benefitBaseInputs.mother.previousBenefitEndDate` = koniec zwolnienia w ciąży – silnik decyduje, czy przerwa jest krótsza niż `params.benefitBase.newBaseAfterGapMonths` i czy przejąć podstawę zasiłku chorobowego. `contractMonthlySalary` = wynagrodzenie z umowy (brak pełnego miesiąca ubezpieczenia, miesiące nieprzepracowane w całości).
- `sicknessBenefitBaseInput`: dane do podstawy zasiłku chorobowego w ciąży (`rightArisesOn` = początek zwolnienia). Kolejność dla planu: najpierw policzyć tę podstawę, potem przekazać ją jako `previousBenefitBase` do podstawy zasiłku macierzyńskiego.

Liczby w treści pytań (próg płatnika, okres 12 miesięcy, stawki, termin 21 dni) pochodzą z `shared/params.json` przez `client/src/app/benefitParams.ts`.

Przed wysłaniem do silnika trzeba sprawdzić wymagane dane i przygotować pełny `ScenarioInput`. Obecny wspólny kontrakt wymaga `mother: ParentData`, dlatego ścieżka samodzielnego taty wymaga przyszłego dostosowania kontraktu obliczeń. Formularz przechowuje ją poprawnie jako szkic, bez tworzenia fikcyjnego profilu mamy. `shared/types.ts` i REST API nie zostały zmienione.

„Usuń zapisane odpowiedzi” po potwierdzeniu czyści oba zapisy. Dane pozostają na tym samym urządzeniu i w tej samej przeglądarce. Strona `/plan` jest obecnie ekranem zastępczym; podłączenie kalkulatora i planu jest kolejnym etapem projektu. Szczegóły hospitalizacji są przechowywane dla jednego dziecka; przy porodzie mnogim obecny kontrakt nie opisuje osobnej hospitalizacji każdego dziecka.
