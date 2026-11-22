# Raport weryfikacji E2E (Playwright)

Data audytu E2E: **2026-11-22**. Środowisko: Chromium (desktop `1280 px` i mobile `360 px`) oraz weryfikacja REST API.  
Wszystkie **17 zgłoszeń** zidentyfikowanych podczas przeglądu E2E zostało naprawionych i scalonych do gałęzi `main` (PR #30, #31, #32 oraz poprawki silnika i UI).

## 1. Zrealizowane poprawki z przeglądu E2E

| # | Obszar | Problem wykryty w E2E | Status w `main` |
|---|---|---|---|
| 1 | Silnik | W wariancie 81,5% stawka 70% drugiego rodzica obejmowała wszystkie jego tygodnie zamiast wyłącznie 9 tygodni nieprzenoszalnych. | ✅ Naprawione (`shared/engine/casePlan.ts`, testy Vitest) |
| 2 | Silnik / Dokumenty | Oznaczenie „Termin minął” mimo wniosku złożonego w terminie lub oznaczonego jako „Wysłano”. | ✅ Naprawione (`casePlan.ts`, `CasePaperwork.tsx`) |
| 3 | Kalkulator | Rozbieżność 1 gr między sumą w nagłówku kalkulatora a porównaniem wariantów. | ✅ Naprawione (wspólne sumowanie i porównanie wariantów) |
| 4 | API | Zbyt duże ciało żądania zwracało 500 `INTERNAL_ERROR` zamiast 413. | ✅ Naprawione (`express.json({ limit: '1mb' })`, obsługa `413` w `errorHandler.ts`) |
| 5 | Plan urlopów | Panel „Ułóż ręcznie / połącz z pracą” zwijał się po każdej edycji. | ✅ Naprawione (kontrolowany stan `useState` w `LeaveSplitPlanner.tsx`) |
| 6 | Panel admina | Komunikaty odsyłały do nieistniejącego przycisku hasła demonstracyjnego. | ✅ Naprawione (`AdminPage.tsx`) |
| 7 | Panel admina | Błędy HTTP 404/500 mogły być traktowane jak zapis lokalny; brak walidacji zakresu pól. | ✅ Naprawione (`adminApi.ts`, testy `AdminPage.test.tsx`) |
| 8 | Wnioski | Niejasny komunikat dla błędnego numeru PESEL i brak `maxLength={11}`. | ✅ Naprawione (`CasePaperwork.tsx`) |
| 9 | Kalkulator | Odmiana „1 dni” przy jednodniowym okresie. | ✅ Naprawione (`CaseResults.tsx`) |
| 10 | Asystent AI | Format „81.5%” z kropką zamiast polskiej konwencji „81,5%”. | ✅ Naprawione (`formatPercentPl` w `assistantAnswers.ts`) |
| 11 | Kreator | Podsumowanie wyświetlało pominięte pytanie o drugi tytuł ubezpieczenia. | ✅ Naprawione (`wizardModel.ts`) |
| 12 | Import PDF | Zbyt skromny wynik po przeliczeniu danych z PDF oraz brak informacji o ograniczeniach oficjalnych formularzy XFA. | ✅ Naprawione (`CasePdfUpload.tsx`) |
| 13 | Dostępność / Mobile | Segmenty osi czasu przy `360 px` bez `aria-label` i czytelnej listy okresów. | ✅ Naprawione (`LeaveTimeline.tsx`) |
| 14 | Dostępność | Brak linku „Przejdź do treści” (`skip-link`) i punktu fokusu `<main>`. | ✅ Naprawione (`App.tsx`) |
| 15 | Routing | Nieznane adresy (`*`) pokazywały `PlaceholderPage` zamiast strony 404. | ✅ Naprawione (`NotFoundPage.tsx`, `App.tsx`) |
| 16 | Bezpieczeństwo | Nagłówek `X-Powered-By: Express`. | ✅ Naprawione (`app.disable('x-powered-by')` w `app.ts`) |
| 17 | Wnioski (UX) | Status „Wysłano” znikał po przełączeniu zakładki. | ✅ Naprawione (zapis samych flag statusu w `sessionStorage`, bez PESEL i danych osobowych) |

## 2. Zakres zweryfikowany w testach E2E

- **Strona startowa:** liczniki, nawigacja klawiaturą w grupie sytuacji, walidacja wyboru.
- **Kreator (4 ścieżki):** cofanie, zachowanie odpowiedzi, dwuetapowe czyszczenie danych.
- **Symulacja mObywatela i ZUS:** profile demonstracyjne (obecnie w `main` uproszczone do **Anna Testowa** i **Jan Testowy**), w tym panel e-ZLA i zaświadczenia o zadłużeniu.
- **Sprawy katalogowe:** katalog 6 spraw oraz regresje prawne `AUD-01–AUD-24`.
- **Kalkulator, uprawnienia, dokumenty i wsparcie:** brak błędów konsoli, brak wartości `NaN`/`undefined`.
- **Generator PDF:** poprawnie wypełnione formularze `ZAS-53`, `ZAM` i wzór wniosku USC (ostrzeżenie konsoli o usunięciu XFA przy oficjalnych szablonach ZUS jest oczekiwanym zachowaniem `pdf-lib`).
- **Walidacja i bezpieczeństwo API:** odrzucanie niepoprawnych plików w imporcie PDF, koperty błędów `401`/`404`/`413`/`422`, odporność na uszkodzony parametr `?inputs=`.
