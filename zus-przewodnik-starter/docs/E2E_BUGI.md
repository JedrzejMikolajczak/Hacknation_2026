# Raport błędów E2E (Playwright), podział na 3 części

Data testu: 2026-11-22. Branch: `jedrzej-ui`. Test: Chromium, 1280 px i 360 px, API przez curl.
Raport podzielono na **Część 1, 2 i 3**. Każda część dotyczy innych plików, więc trzech agentów może pracować równolegle bez konfliktów.

## Jak użyć (prompt dla agenta)

> Repo `zus-przewodnik-starter`, branch `jedrzej-ui`. Przeczytaj `agents/CLAUDE.md` i `agents/CONVENTIONS.md`. Otwórz `docs/E2E_BUGI.md` i zrealizuj **tylko Część N** (N podaje człowiek). Naprawiaj błędy po kolei i trzymaj się wyłącznie plików wymienionych w swojej części. Dla zmian w logice silnika dodaj test Vitest. Nie zmieniaj kontraktu (`shared/types.ts`, `shared/params.json`, ścieżki API) bez pytania człowieka. Uruchom `npm run lint && npm run typecheck && npm test`. Nie commituj i nie pushuj, dopóki człowiek nie poprosi. Na końcu podaj listę zmienionych plików i jak to przetestować.

### Podział

| Część | Zakres | Błędy | Główne pliki |
|---|---|---|---|
| **1** | Silnik obliczeń i serwer | #1, #2, #3, #4, #10, #16 | `shared/engine/*`, `server/src/*`, regiony overdue w `CasePaperwork.tsx` |
| **2** | Plan: kalkulator, plan urlopów, wnioski | #5, #8, #9, #13, #17 | `leavePlan/*`, `plan/tabs/CaseResults.tsx`, `plan/tabs/CasePaperwork.tsx` (PESEL, status wysłania) |
| **3** | Admin, kreator, import PDF, a11y i routing | #6, #7, #11, #12, #14, #15 | `features/admin/*`, `features/wizard/wizardModel.ts`, `features/cases/*`, `app/App.tsx` |

Uwaga o `CasePaperwork.tsx`: Część 1 zmienia tylko logikę terminów (~317-405, 486-512, 630). Część 2 zmienia tylko walidację PESEL (~1734) i zapis statusu „Wysłano”. Regiony się nie nakładają.

---

## Część 1: Silnik obliczeń i serwer

| # | Waga | Co nie działa | Odtworzenie / dowód | Pliki | Jak naprawić |
|---|---|---|---|---|---|
| 1 | Wysoka (potwierdź regułę z człowiekiem) | W wariancie 81,5% **wszystkie** tygodnie rodzicielskiego drugiego rodzica liczą się po 70%. README §3.3 mówi, że po 70% jest tylko 9 tyg. | `/plan/leave-plan`, `?inputs=…`, data wniosku do 21 dni od porodu. „Tylko tata” daje 32 tyg. po 70%. „Po połowie” daje tacie 20 tyg. po 70% zamiast 9 tyg. po 70% i 11 tyg. po 81,5%. | `shared/engine/casePlan.ts` `rateFor` (~227-232). Ten sam wzorzec w `shared/engine/parental.ts` (~112-116, ~219-223) i `shared/engine/maternity.ts` (~477, 716, 746). | Stawkę `secondParentNonTransferableInCombined` stosuj tylko do pierwszych `parentalLeave.nonTransferableWeeksPerParent` (9) tygodni rodzicielskiego drugiego rodzica. Pozostałe tygodnie liczone po `rates.combined`. Dodaj test dla podziałów 9/32, 20/21 i „tylko tata”. |
| 2 | Średnia | „Termin minął” mimo wniosku złożonego w terminie. Dotyczy też wniosku ze statusem „Wysłano”. | Matka, poród 15.10.2026, data wniosku 20.10.2026 (5 dni), dziś 22.11. Zakładka Dokumenty: „CO ZROBIĆ TERAZ – Termin minął… do 05.11.2026”. Na karcie wysłanego wniosku też „Termin minął”. | `shared/engine/casePlan.ts` (~171-205, `combinedDeadline`, `is_overdue`). `client/src/features/plan/tabs/CasePaperwork.tsx` (~317-405, 486-512, 630). | Jeśli `application_to_payer_date ?? application_date` ≤ termin, dokument „Wniosek 81,5%” oznacz jako zrobiony i bez flagi overdue. Termin przeterminowany tylko wtedy, gdy nie ma daty złożenia i `reference_date` > termin. Na karcie „Wysłano” nie pokazuj „Termin minął”. |
| 3 | Średnia | Różnica 1 gr między sumą w nagłówku kalkulatora a porównaniem wariantów. | `/plan/calculator`, podstawa 5000 zł. Nagłówek „Łącznie 59 149,99 zł”, a w porównaniu wariant 100%+70% to „59 150,00 zł (+23,34 zł)”. Mama 49 466,66 + tata 9 683,33 = 59 149,99. | `shared/engine/casePlan.ts` `totalFor` (~725-745) i `variants` (~796-799). | Wszędzie sumuj zaokrąglone kwoty okresów albo wszędzie zaokrąglaj dopiero sumę. Wystarczy jedna wspólna funkcja dla nagłówka i porównania. Test: `variants.SPLIT_100_70 === suma okresów`. |
| 4 | Średnia | Serwer zwraca 500 `INTERNAL_ERROR` dla zbyt dużego body (powinno być 413). | `curl -X POST /api/v1/plan --data-binary @10MB.json` → `500 {"error":{"code":"INTERNAL_ERROR"}}`. | `server/src/app.ts:23` (`express.json()`), `server/src/middleware/errorHandler.ts`. | Ustaw `express.json({ limit: '1mb' })`. W `errorHandler` obsłuż `err.type === 'entity.too.large'` → 413 w kopercie `{data:null,error:{code:'PAYLOAD_TOO_LARGE',…}}`. To nowy kod błędu, więc zapytaj człowieka i dopisz do changelogu kontraktu. |
| 10 | Niska | Asystent podaje „81.5%” z kropką, reszta aplikacji „81,5%”. | `POST /api/v1/assistant/ask` o stawkę 81,5%. | `shared/engine/assistantAnswers.ts:11` (`Math.round(rate*1000)/10`). | Użyj `formatPercentPl(params.rates.combined)`, tak jak w `casePlan.ts`. |
| 16 | Niska (bezpieczeństwo) | Nagłówek `X-Powered-By: Express`. | `curl -I localhost:3001/api/v1/health`. | `server/src/app.ts` | `app.disable('x-powered-by')`. `helmet` to nowa zależność, więc zapytaj człowieka. |

---

## Część 2: Plan (kalkulator, plan urlopów, wnioski)

| # | Waga | Co nie działa | Odtworzenie / dowód | Pliki | Jak naprawić |
|---|---|---|---|---|---|
| 5 | Średnia | Panel „Ułóż ręcznie / połącz z pracą” zwija się po każdej edycji (data, przyciski etatu). Użytkownik traci miejsce przy układaniu planu. | `/plan/leave-plan?case=case-06`, otwórz panel, zmień „Koniec” części 1 albo kliknij „1/4 etatu”. `details.open` zmienia się z `true` na `false`. Wartość się zapisuje. | `client/src/features/leavePlan/LeaveSplitPlanner.tsx:233` (niekontrolowany `<details className="lp-details">`). Rodzic: `client/src/features/plan/tabs/CasePlanner.tsx:388`. | Trzymaj stan otwarcia w `useState` w `LeaveSplitPlanner`, przekazuj `open` i `onToggle`. Ustal, co remontuje poddrzewo (podejrzewam stan „loading” przy `POST /plan`) i zachowaj poprzedni plan w trakcie odświeżania. |
| 8 | Niska | Zły komunikat dla błędnego PESEL: „Uzupełnij dane osobowe (Matka): PESEL.”, choć PESEL jest wpisany. Pole nie ma `maxLength`. | Zakładka Wnioski, PESEL `12345`, „Wyślij Wniosek…”. | `client/src/features/plan/tabs/CasePaperwork.tsx:1734` (`PERSONAL_FIELD_LABELS`). | Rozróżnij „brak” i „błędny”: „PESEL jest nieprawidłowy (11 cyfr, poprawna suma kontrolna)”. Dodaj `maxLength={11}` i `inputMode="numeric"`. |
| 9 | Niska | Zła odmiana: „1 dni”. | Kalkulator → zasiłek chorobowy 15.10–15.10 → „1 dni (0,14 tyg.)”. | `client/src/features/plan/tabs/CaseResults.tsx` `formatDurationPl` (~414-423). Przejrzyj też inne `${days} dni`. | Dodaj helper `pluralizePl(n, 'dzień', 'dni', 'dni')` (1 dzień, 2-4 dni, 5+ dni, 22-24 dni). Użyj go wszędzie. |
| 13 | Niska (a11y/mobile) | Oś czasu przy 360 px: segmenty ~20 px szerokości. Treść tylko w atrybucie `title`, brak `aria-label`. | `/plan/leave-plan?case=case-04`, viewport 360. „Uzupełniający 8 tyg. · 100%” ma w=20. | `client/src/features/leavePlan/LeaveTimeline.tsx`. | Dodaj `aria-label` każdemu segmentowi. Na wąskim ekranie pokaż listę okresów pod osią albo ustaw `min-width` i przewijanie poziome z legendą. |
| 17 | Niska (UX, zgodne z kontraktem) | Status „Wysłano” i wpisane dane (PESEL, konto) znikają po zmianie zakładki. Użytkownik może wysłać drugi raz i traci UPO. PESEL poza storage to zgodne z §7. | Wnioski → „Wyślij” → zakładka Plan urlopów → powrót. | `client/src/features/plan/tabs/CasePaperwork.tsx` (stan w pamięci komponentu). | Zapisuj w `sessionStorage` same flagi statusu bez danych osobowych (jest już klucz `zus.filing.done.scenariusz`). Dane osobowe nadal tylko w pamięci. |

---

## Część 3: Admin, kreator, import PDF, a11y i routing

| # | Waga | Co nie działa | Odtworzenie / dowód | Pliki | Jak naprawić |
|---|---|---|---|---|---|
| 6 | Średnia | Panel admina: komunikaty odsyłają do nieistniejącego przycisku „Wypełnij hasłem demonstracyjnym”. Tekst wstępny obiecuje, że przycisk wstawi klucz, a faktycznie jest „Przywróć oficjalne przepisy 2026”. | `/admin`, „Zapisz parametry w systemie” bez tokena → „…lub kliknij przycisk „Wypełnij hasłem demonstracyjnym”.” | `client/src/features/admin/AdminPage.tsx:86` (komunikat), `:152-153` (tekst wstępny), `:156-162` (przycisk, `handleRestoreDefaults`). | Popraw teksty: „Podaj klucz dostępu administratora (ADMIN_TOKEN).” Opis przycisku ma mówić, że przywraca wartości domyślne, a nie wstawia klucz. Nie dodawaj hasła demo do klienta. |
| 7 | Średnia | Zapis parametrów admina pokazuje „zapisano w sesji demo” także wtedy, gdy serwer zwrócił 404 albo 500. Użytkownik myśli, że zapis się udał. | Kod: `isFallbackableError` zwraca `true` dla `NOT_FOUND`, `INTERNAL_ERROR` i błędów spoza `ApiError`. Zachowania na żywo nie wywołałem, bo nie miałem tokena. | `client/src/features/admin/adminApi.ts` (`isFallbackableError`). | Fallback tylko przy błędzie sieci (serwer niedostępny) i z wyraźnym komunikatem „zapisano tylko lokalnie, serwer nie zapisał”. 404 i 500 pokazuj jako błąd. Dodatkowo: pola z wartością spoza zakresu (−5, 250, puste) nie dostają `aria-invalid` ani komunikatu przy polu. Dodaj walidację `onChange` (stawki 0-100). Z prawdziwym tokenem nie sprawdzałem odpowiedzi serwera. |
| 11 | Niska | Podsumowanie kreatora pokazuje „Drugi tytuł do ubezpieczeń: Do uzupełnienia później”, choć pytania nie było w przepływie. Do zweryfikowania. | `/wizard?situation=afterBirth`, dwoje rodziców na UoP, kroki do końca. | `client/src/features/wizard/wizardModel.ts` (~700-725, pytanie `additionalInsurance.insuranceTitle`, `optional: true`) oraz budowanie wiersza w podsumowaniu. | Pomijaj w podsumowaniu opcjonalne pytania, które nie trafiły do przepływu. Albo pokaż je tylko, gdy warunek pytania jest spełniony. |
| 12 | Niska | Import PDF: po „Przelicz potwierdzone dane” wynik to tylko „364 dni”, bez kwot i okresów, bez linku do planu i bez przeniesienia fokusu. PDF-y wygenerowane przez aplikację (ZAM, ZAS-53) dają „Brak rozpoznanych pól”. Własny PDF z etykietami „Data urodzenia dziecka: …” działa. | `/cases` → „Wczytaj własny wniosek PDF”. | `client/src/features/cases/CasePdfUpload.tsx`, `pdfCaseFields.ts` (`extractCaseFields`). | Pokaż po przeliczeniu kwoty i okresy albo przycisk „Otwórz plan” z `?inputs=`. Przenieś fokus na „Wynik kalkulatora”. Dopisz w UI, że oficjalne formularze ZUS nie są odczytywane. |
| 14 | Niska (a11y) | Brak linku „Przejdź do treści”. Pierwszy Tab ląduje na pierwszej opcji sytuacji. | Landing, Tab. Grep po `client/src` nic nie znajduje. Fokus jest widoczny (outline 3 px). | `client/src/app/App.tsx` (layout) i `<main>` na stronach. | Dodaj `<a class="skip-link" href="#main">Przejdź do treści</a>` jako pierwszy element. Każdemu `<main>` daj `id="main"` i `tabIndex={-1}`. Styl widoczny po fokusie, tokeny z `tokens.css`. |
| 15 | Niska | Nieznane adresy (`*`) pokazują `PlaceholderPage` zamiast strony 404. | Wejście na dowolny nieistniejący adres (np. `/xyz`). | `client/src/app/App.tsx` (`<Route path="*" element={<PlaceholderPage />}/>`). | Dodaj `NotFoundPage` („Nie znaleziono strony” plus link do `/`). `PlaceholderPage` zostaw tylko dla planowanych tras. |

---

## Uwagi poza podziałem

- Ostrzeżenie w konsoli „Removing XFA form data as pdf-lib does not support…” pojawia się 3 razy przy generowaniu ZAS-53 i ZAM. To oczekiwane przy oficjalnych formularzach ZUS i nic nie psuje.
- Katalog `.playwright-mcp/` (snapshoty, logi, zrzuty ekranu, wygenerowane PDF-y) jest nieśledzony. Nie commituj go, najlepiej dodaj do `.gitignore`.

## Zweryfikowane i działa poprawnie

- Landing: liczniki 20/2/41 po przewinięciu, nawigacja strzałkami w grupie opcji, walidacja „Wybierz swoją sytuację”.
- Kreator w 4 sytuacjach: Wstecz, odświeżenie, „Usuń zapisane odpowiedzi” (dwuetapowe).
- Logowanie 6 profili i JDG z długiem (odmowa wg art. 2a).
- 6 przykładowych spraw: `evaluate` zwraca `matches: true` dla wszystkich.
- Kalkulator, uprawnienia, dokumenty i wsparcie bez błędów konsoli, bez `NaN` i `undefined`.
- Wygenerowane wnioski i PDF-y: ZAS-53, ZAM x2 i USC. Pobrane pliki mają 16-431 KB, bez błędów.
- Import PDF odrzuca poprawnie: txt, plik 13 MB, pusty i podrobiony PDF.
- API: 404 i 422 w kopercie, admin bez tokena daje 401.
- Uszkodzone `?inputs=` nie wywala aplikacji.
- Walidacja ręcznego planera działa: koniec przed początkiem i nakładanie części dają komunikaty.

## Czego nie sprawdzono

- Ręczny planer: etat powyżej 1/2, szósta część i bardzo długi zakres. Zwijający się panel (#5) przerwał skrypt testowy.
- Walidacja pól admina z prawdziwym tokenem (brak `ADMIN_TOKEN`).
- Inne przeglądarki niż Chromium.
