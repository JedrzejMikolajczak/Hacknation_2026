# Kontrakt projektu

## 1. Język i nazwy

- Teksty interfejsu są po polsku.
- Funkcje i zmienne lokalne używają `camelCase`. Typy i komponenty używają `PascalCase`.
- Dane domenowe przesyłane przez REST oraz zapisane w JSON i URL używają kluczy `snake_case` i wartości wyliczeniowych `UPPER_SNAKE_CASE`.

## 2. Słownik

| Termin | Pole lub wartość |
|---|---|
| Dane sprawy i scenariusza | `CaseInputs`, w sprawie pod `inputs` |
| Wynik silnika i dane porównawcze | `CaseOutcome`, `CaseRecord.ground_truth_outcome` |
| Wnioskodawca | `applicant_role` · `MOTHER`, `FATHER` |
| Etap | `stage` · `PLANNING`, `PREGNANCY`, `POST_BIRTH`, `ADOPTION` |
| Tytuł ubezpieczenia | `employment_type` · `UOP`, `B2B`, `ZLECENIE`, `NONE` |
| Wariant wypłaty | `requested_payment_variant` · `COMBINED_81_5`, `SPLIT_100_70` |
| Płatnik świadczenia | `who_pays` · `EMPLOYER`, `ZUS`, `SPLIT_EMPLOYER_THEN_ZUS` |
| Data porodu lub przewidywana data | `due_or_birth_date` |
| Data złożenia u płatnika | `application_to_payer_date` ma pierwszeństwo przed `application_date` |
| Liczba dzieci z porodu / żyjących / zmarłych | `children_count` / `living_children_count` / `deceased_children_count` |
| Drugi tytuł ubezpieczenia | `secondary_employment_type`, `secondary_voluntary_sickness_insured` |
| Szczególne sytuacje matki / zwolnienia | `mother_deceased`, `mother_abandoned_child`, `unlawful_termination_confirmed_by_court` |
| Okresy świadczeń | `periods` i `leave_type` |
| Części rodzicielskiego | `parental_leave_parts`, opcjonalne `parent_role` i `work_fraction` |
| Przychody do podstawy | `monthly_bases`, elementy `{ month, amount_pln, excluded_bonus_pln? }` |
| Ostrzeżenie | `{ code, message_pl, legal_basis }` |

## 3. Formaty

Daty kalendarzowe w formacie `YYYY-MM-DD`, miesiące w formacie `YYYY-MM`. Kwoty w PLN są zaokrąglane do grosza na wyjściu. Stawki świadczeń mają wartości procentowe, np. `81.5`, `70` i `100`. `work_fraction` jest częścią etatu, np. `0.5`. Nieustalone wyniki mają wartość `null`. Opcjonalne pola wejściowe mogą być pominięte.

## 4. Typy i parametry

Typy domenowe pochodzą z `shared/types.ts`. `shared/params.json` jest początkowym źródłem parametrów. Nazwy pól konfiguracji administracyjnej zachowują swój dotychczasowy format, a stawki w konfiguracji są współczynnikami obliczeniowymi. Typy pomocnicze szkicu kreatora służą także do odczytu istniejących zapisów przeglądarki. Przed wywołaniem API szkic przechodzi na `CaseInputs`.

## 5. Silnik i terminy

`calculateCasePlan(input, params)` jest czystą funkcją. Zwraca wynik, uprawnienia, dokumenty, walidację podziału urlopu oraz materiały wsparcia. Harmonogram w dokumentach i wnioskach wynika z tych samych części, które zatwierdził silnik. Datę porównania terminów podaje klient przez `reference_date`. Ostrzeżenia o możliwej weryfikacji przez ZUS nie wpływają na kwalifikację.

## 6. REST API

Obowiązuje prefiks `/api/v1` i koperta `{ data, error }`. Sukces zwraca `error: null`. Błąd zwraca `data: null`, kod i komunikat. Nieprawidłowy JSON lub kontrakt zwracają 422. Nieznana sprawa zwraca 404.

| Metoda | Ścieżka | Wejście | `data` |
|---|---|---|---|
| GET | `/health` | — | `{ status: 'ok' }` |
| POST | `/plan` | `CaseInputs` | `CasePlan` |
| POST | `/eligibility` | `CaseInputs` | `{ entitlements, warnings }` |
| POST | `/calculate/maternity` | `CaseInputs` | `CaseOutcome` |
| POST | `/calculate/sickness` | `CaseInputs` | `{ periods, employer_sick_pay, warnings }` |
| POST | `/calculate/benefit-base` | `CaseInputs` | `{ benefit_base_pln }` |
| POST | `/plan/parental-split` | `CaseInputs` z `parental_leave_parts` | `CasePlan` |
| POST | `/plan/parental-with-work` | `CaseInputs` z `part_time_work_fraction` lub częściami | `CasePlan` |
| POST | `/documents` | `CaseInputs` | `CaseDocument[]` |
| GET | `/cases` | — | `CaseSummary[]` |
| GET | `/cases/:caseId` | — | `CaseRecord` |
| POST | `/cases/:caseId/evaluate` | puste żądanie | `{ case_id, outcome, matches, differences }` |
| GET | `/params` | — | `BenefitParams` |
| PUT | `/admin/params` | `BenefitParams`, nagłówek `Authorization: Bearer …` | Parametry aktywne do restartu |
| POST | `/assistant/ask` | `{ question }` | `{ answer, sources, is_demo_fallback }` |

`matches` porównuje kwalifikację, płatnika, stawkę, wymiary, formularze, okresy oraz znane kwoty. Streszczenie i cytaty źródłowe są zwracane obok wyniku jako treść decyzji.

## 7. Frontend

`/plan/:tab` obsługuje `entitlements`, `calculator`, `leave-plan`, `documents`, `applications`, `support`. Kontekst scenariusza odczytuje i zapisuje aktualne wejście do obliczeń w URL. `?case=case-04` wskazuje sprawę katalogową, a zapisane edycje są w `inputs`. Wnioski demo przechowują wpisane wartości tylko w pamięci komponentu. Klient wywołuje HTTP przez `client/src/api/client.ts`.

### 7.1 Wygląd

Stosuj Lato, tokeny z `client/src/styles/tokens.css` i istniejące polskie etykiety. Zachowaj czytelność przy 375 px i widoczny fokus klawiatury. Nazwa i elementy projektu mają być rozpoznawalne jako wersja demonstracyjna.

## 8. Backend

Express i Zod walidują kontrakt na granicy HTTP. Adaptery i symulacje nie zapisują danych formularzy. Podstawowe dane katalogowe pochodzą z `data/cases`. Dokumenty konkursowe i surowe dane są poza indeksem Git.

## 9. Jakość

Uruchom `npm ci`, `npm run lint`, `npm run typecheck`, `npm test` i `npm run build` w katalogu `zus-przewodnik-starter`.

## 10. Otwarte kwestie

Minimalna podstawa dla pracownika w brakującej tabeli, różnice w decyzji case-02 i zaokrągleniu case-06 mają opis w [raporcie](../../docs/FIX_ALL_REPORT.md).

## 11. Changelog kontraktu

| Data | Zmiana |
|---|---|
| 2026-11-21 | Początkowy kontrakt, endpoint health i reguły stylu projektu |
| 2026-11-21 | `CaseInputs`, `CaseOutcome`, `CasePlan`, format spraw ZUS oraz katalog i porównanie wyników |
| 2026-11-21 | Wspólne okresy planu, dokumenty według zapisanych dat, ostrzeżenia z parametrami i symulacja odpowiedzi asystenta |
| 2026-11-21 | Opcjonalne pola w `CaseParentInsurance` (`monthly_bases`, `title_start_date`, `debt_amount_pln`) i `CaseCircumstances` (`mother_deceased`) dla obliczeń drugiego rodzica |
| 2026-11-21 | Rozszerzenie kontraktu o przypadki z PDF: `mother_abandoned_child`, `unlawful_termination_confirmed_by_court`, `WizardScenario.mother: ParentData \| null` (samotny ojciec), `secondary_employment_type` / `secondary_voluntary_sickness_insured` (dwa tytuły naraz) oraz `deceased_children_count` (poród mnogi) |
| 2026-11-21 | Dane przejęcia po porzuceniu wymagają daty i informacji o ubezpieczeniu matki. `CaseInputs.additional_insurance_titles` przechowuje odrębne dane każdego tytułu, a `CasePlan.additional_title_outcomes` jego wyliczenie. Pola `secondary_*` pozostają obsługiwane jako starszy format. |
