# Raport integracji `fix-all`

Stan gałęzi bazowych zweryfikowano 21 listopada 2026 r. Punktem wyjścia był `origin/main` (`8b4805c`). Przed integracją wysłano 17 tagów kopii zapasowej. Nie użyto zmian historii. Wzorzec ochrony `check*` obejmuje również `checkout1`.

## 1. Inwentaryzacja gałęzi

Kolejność kontroli w kolumnie „Kontrole” to `ci / lint / typecheck / test / build`. Kontrole wykonano w odłączonych katalogach `git worktree`. Odległość to commitów **za / przed** `origin/main`. „Pliki” oznaczają unikalny diff względem wspólnego przodka.

| Gałąź i ostatni commit | Za / przed | Kontrole | Kategoria | Pliki, wymagania i decyzja | Nazwa po odstawieniu |
|---|---:|---|---|---|---|
| `main` · `8b4805c` | 0 / 0 | chroniona | CHRONIONA | Baza integracji | `main` |
| `checkout1` · `fba3ec7` | 37 / 0 | chroniona | CHRONIONA | Kreator zawarty w main, pasuje do check* | `checkout1` |
| `JedrzejMikolajczak-patch-1` · `77da23e` | 52 / 0 | brak package.json | UNUSED | Szablon agentów i README zawarte w main | `niepotrzebne/JedrzejMikolajczak-patch-1` |
| `bchochoool-patch-1` · `d3feff9` | 47 / 0 | brak package.json | UNUSED | README zawarte w main | `niepotrzebne/bchochoool-patch-1` |
| `codex/kalkulator` · `d5c9aa7` | 37 / 0 | ✅ ✅ ✅ ✅ ✅ | UNUSED | Silnik i trasy zawarte w main, stary kontrakt | `niepotrzebne/codex/kalkulator` |
| `feature/admin-panel` · `bfe851e` | 40 / 1 | ✅ ✅ ✅ ✅ ✅ | MERGE | `App.tsx`, klient HTTP, edytor i testy admina. Po integracji API z tokenem środowiskowym | `niepotrzebne/feature/admin-panel` |
| `feature/ui-cases` · `d4d98f1` | 21 / 1 | ✅ ✅ ✅ ✅ ✅ | UNUSED | `App.tsx`, katalog, trasa API, test i dwie syntetyczne sprawy. Ten sam katalog wniesiono przez nowszą gałąź przewodnika | `niepotrzebne/feature/ui-cases` |
| `feature/ui-clarity` · `5a095cb` | 8 / 0 | ✅ ✅ ✅ ❌ ✅ | UNUSED | Uproszczenia panelu w main, w tym nawigacja i komunikaty | `niepotrzebne/feature/ui-clarity` |
| `feature/ui-documents` · `9e51eb8` | 37 / 1 | ✅ ✅ ✅ ❌ ✅ | UNUSED | `App.tsx`, samodzielny `DocumentsPage` i test. Zastąpione zakładką wspólnego planu | `niepotrzebne/feature/ui-documents` |
| `feature/ui-guide` · `d8895bf` | 0 / 4 | ✅ ✅ ✅ ❌ ✅ | MERGE | Katalog spraw, przewodnik z artykułami, podgląd wydruku, integracja tras i testy. Zmieniono kontrakt i katalog spraw | `niepotrzebne/feature/ui-guide` |
| `feature/ui-leave-calendar` · `1770c62` | 40 / 1 | ✅ ✅ ✅ ✅ ✅ | UNUSED | `App.tsx`, oś, kalendarz, planer i mock. Zastąpione osią i walidacją na wspólnym API | `niepotrzebne/feature/ui-leave-calendar` |
| `feature/ui-plan` · `ee14070` | 7 / 2 | ✅ ✅ ✅ ❌ ✅ | MERGE | Katalog i podgląd wniosków weszły przez `feature/ui-guide` | `niepotrzebne/feature/ui-plan` |
| `feature/ui-support` · `7a4ae30` | 40 / 1 | ✅ ✅ ✅ ✅ ✅ | MERGE | Samodzielne wsparcie, asystent, mock i CSS. Zachowano asystenta i jego odpowiedzi w zakładce panelu | `niepotrzebne/feature/ui-support` |
| `feature/ui-support-documents` · `0af6b4f` | 1 / 0 | ✅ ✅ ✅ ❌ ✅ | UNUSED | Integracja dokumentów i wsparcia już w main | `niepotrzebne/feature/ui-support-documents` |
| `fix/ui-date-slashes` · `c580c31` | 0 / 1 | ✅ ✅ ✅ ❌ ✅ | MERGE | `WizardPage.tsx` i test formatowania dat w kreatorze | `niepotrzebne/fix/ui-date-slashes` |
| `fix/ui-plan` · `867684f` | 0 / 3 | ✅ ✅ ✅ ❌ ✅ | MERGE | Trasy spraw, podgląd i dokumenty weszły przez `feature/ui-guide` | `niepotrzebne/fix/ui-plan` |
| `gluglam-patch-1` · `674f45d` | 49 / 0 | brak package.json | UNUSED | Zmiany README zawarte w main | `niepotrzebne/gluglam-patch-1` |

Kategoria KEEP nie ma kandydatów. Każda samodzielna gałąź używała starego kontraktu lub nie miała projektu npm. W konfliktach `App.tsx` zachowano aktualne trasy planu i dodano panel administracyjny. Przy scalaniu wsparcia zachowano aktywną trasę planu i przeniesiono istniejący asystent do zakładki. Samodzielny ekran wsparcia i drugi zestaw reguł zostały zastąpione aktywną integracją.

## 2. Sześć zakładek

| Zakładka | Status | Wynik |
|---|---|---|
| Uprawnienia | ✅ | Osobne uprawnienia i płatnicy, powody, podstawy prawne i neutralne sygnały możliwej weryfikacji |
| Kalkulator | ✅ | Okresy i odmowy, kwoty z podstawy, stawki, wcześniactwo, „Za życiem”, praca i adopcja |
| Plan urlopów | ✅ | Oś czasu i edytowalne części, walidacja puli, etatu i okresów, stan kontekstu zapisany w URL |
| Dokumenty i terminy | ✅ | Dokumenty i odbiorcy według części użytkownika, oznaczenie upływu terminu, formularz ZAM |
| Wnioski | ✅ | Edytowalne, jawnie przykładowe dane, podgląd wydruku, wniosek USC i symulacja wysyłki |
| Wsparcie | ✅ | Organizacje i linki z API, ostrzeżenia planu, symulacja PUE/eZUS i oryginalne odpowiedzi asystenta |

## 3. Przykładowe sprawy

Szczegółowe porównania z decyzjami ZUS zostały usunięte z repozytorium: materiały ZUS przekazane uczestnikom konkursu nie mogą być używane ani publikowane. Katalog spraw (`data/cases/`) zawiera wyłącznie wymyślone, ilustracyjne przykłady, a ich wynik wzorcowy wylicza silnik aplikacji.

## 4. Kontrakt

- `CaseInputs` obejmuje pola źródłowe, daty porodu, wniosku u płatnika, e-ZLA i hospitalizacji, wagi, aktualną liczbę żyjących dzieci, historię podstaw, drugi tytuł ubezpieczenia, części urlopu, adopcję i sygnały ryzyka.
- `CaseOutcome` obejmuje wynik decyzji, procentowe stawki, podstawę, okresy i segmenty kwot, alternatywne warianty, ostrzeżenia i terminy puli.
- `CasePlan` udostępnia wynik, uprawnienia, dokumenty, błędy walidacji i zasoby wsparcia w jednej odpowiedzi.
- `GET /cases`, `GET /cases/:caseId`, `POST /cases/:caseId/evaluate` obsługują sześć spraw. `POST /plan` liczy zakładki. Ścieżki obliczeń i dokumentów korzystają z tego samego planu.
- Koperta `{ data, error }` pozostała wspólna. Przeglądarka przechodzi ze szkicu kreatora do kontraktu sprawy przed wysłaniem żądania.
- Konfiguracja techniczna `BenefitParams` zachowuje współczynniki używane w obliczeniach. Wyniki REST mają stawki procentowe. Historyczne testy wcześniejszych reguł zachowano obok testów kanonicznego silnika.

## 5. Ograniczenia i tematy do potwierdzenia

- **Terminy poza UoP**. Kodeksowy termin 21 dni przed rodzicielskim i 7 dni przed ojcowskim dotyczy pracowników. Na potrzeby wniosków o zasiłek B2B dokumenty wskazują początek wnioskowanego okresu. W sprawie 06 wniosek B2B złożono 3 dni przed początkiem. [PIP – rodzicielstwo](https://www.pip.gov.pl/dla-pracodawcow/porady-prawne/rodzicielstwo)
- **Formularze**. Użyj aktualnego ZAM zamiast wycofanych ZUR, ZAO i Z-3b. [ZUS – uproszczenia w zasiłkach](https://www.zus.pl/-/kolejne-uproszczenia-w-zasi%C5%82kach)
- **Sygnały „dla pozoru”**. W sprawach 1–6 żadne z dostępnych danych nie spełniają warunków. Sprawy 03 i 05 mają datę tytułu sprzed ciąży i ponad 6 miesięcy przed zdarzeniem. Tytuł sprawy 06 powstał po porodzie, ponad 6 miesięcy przed wnioskiem. Pozostałe nie podają daty tytułu. Znane zmiany podstaw nie sięgają 30%, a żadna sprawa nie podaje zatrudnienia w rodzinie ani nowego stanowiska. Test dodatni sprawdza wszystkie trzy sygnały oraz brak zmiany kwalifikacji. Podstawa prawna heurystyk ma wartość `null`.
- **Asystent**. Zachowano etykietę „Wspierane przez AI” przy odpowiedziach z demonstracyjnej bazy. Odpowiedzi są regułowe, a źródła pochodzą z dotychczasowej implementacji.
- **Dane**. Dane osobowe w edytorze wniosków i treść symulacji PUE istnieją w pamięci interfejsu. Adres edytowanego planu zawiera dane scenariusza, w tym daty i podstawy. Dane testowe zawierają tylko zanonimizowane parametry i tytuły. Surowe dane oraz materiały źródłowe są ignorowane.
- **Znana granica symulacji**. Pełne uprawnienia przy nietypowych przerwach w ubezpieczeniu, wyliczenie dokładnej podstawy przy zmiennej strukturze wynagrodzenia i dowody kwalifikacji w indywidualnych sprawach wymagają weryfikacji danych. Panel demonstracyjny pokazuje brak kwoty, jeśli podstawa jest niedostępna.

## 6. Uruchomienie i weryfikacja

Z katalogu `zus-przewodnik-starter`: `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, a potem `npm run dev`.

- `GET /api/v1/health` zwrócił status `ok`. Domyślne porty były zajęte, więc uruchomiono `npm run dev` z `PORT=3301` i `VITE_PORT=5276`.
- Chrome, 375 i 1280 px. Zweryfikowano 72 widoki, 6 spraw × 6 zakładek × 2 szerokości, po przejściu z katalogu `/cases`. Brak błędów konsoli, błędów HTTP i przewijania poziomego.
- Test zmiany części ojca w sprawie 04 potwierdził termin 19.10.2027 oraz zgodny okres w podglądzie wniosku. Testy regresji pokrywają przepływ danych i lokalną edycję pól formularza.

Wartością demonstracji jest przekład zasad świadczeń na terminy i gotowe wzory dla każdego rodzica. Zmiana harmonogramu aktualizuje wszystkie zależne widoki, co ogranicza ryzyko skorzystania ze starej daty.

## 7. Kopie zapasowe

Użyj `git fetch origin --tags`, a następnie `git branch <nazwa> <tag>` do odtworzenia wybranej gałęzi lokalnie.

- `backup/20261121-1851/JedrzejMikolajczak-patch-1`
- `backup/20261121-1851/bchochoool-patch-1`
- `backup/20261121-1851/checkout1`
- `backup/20261121-1851/codex/kalkulator`
- `backup/20261121-1851/feature/admin-panel`
- `backup/20261121-1851/feature/ui-cases`
- `backup/20261121-1851/feature/ui-clarity`
- `backup/20261121-1851/feature/ui-documents`
- `backup/20261121-1851/feature/ui-guide`
- `backup/20261121-1851/feature/ui-leave-calendar`
- `backup/20261121-1851/feature/ui-plan`
- `backup/20261121-1851/feature/ui-support`
- `backup/20261121-1851/feature/ui-support-documents`
- `backup/20261121-1851/fix/ui-date-slashes`
- `backup/20261121-1851/fix/ui-plan`
- `backup/20261121-1851/gluglam-patch-1`
- `backup/20261121-1851/main`
