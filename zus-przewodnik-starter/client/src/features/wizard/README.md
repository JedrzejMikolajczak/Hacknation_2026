# Kreator planu rodziny

Kreator zbiera odpowiedzi w ścieżkach **planuję dziecko**, **jestem w ciąży**, **po porodzie** oraz **adopcja lub rodzina zastępcza**. Można wejść z ekranu startowego przez „Kontynuuj bez logowania” lub przejść z symulacji mObywatela z danymi profilu demonstracyjnego.

## Przebieg

- Plan można przygotować dla mamy, taty lub dwojga rodziców. Pytania o ubezpieczenie, urlop i kwoty dotyczą wybranego rodzica. Samodzielny tata może przejść do planu bez danych mamy.
- Zakres pytań zależy od sytuacji. Formularz pyta m.in. o zwolnienie w ciąży, okoliczności porodu, hospitalizację, „Za życiem”, drugi tytuł ubezpieczenia i szczególne sytuacje rodziców, gdy mają zastosowanie.
- Przy nieznanej podstawie wymiaru można podać dane do obliczenia, np. wynagrodzenie brutto przy umowie o pracę. Podsumowanie pozwala zmienić odpowiedzi przed zapisaniem i przejściem do planu.
- Data jest wybierana w polach dnia, miesiąca i roku. „Dalej” zatwierdza datę po walidacji. Podsumowanie pokazuje `DD/MM/YYYY`, a model używa `YYYY-MM-DD`.

## Model danych

[Model kreatora](wizardModel.ts) określa aktywne pytania, reguły walidacji i budowę szkicu. [Integracja danych ZUS](zusMerge.ts) zaznacza źródła odpowiedzi i rozbieżności z danymi wprowadzonymi ręcznie. [Kontekst scenariusza](../../app/ScenarioContext.tsx) przechowuje:

| Dane | Przeznaczenie |
| --- | --- |
| `zus-manual-scenario-v1` | Szkic sytuacji rodzinnej, m.in. rodzice, dane do obliczenia podstawy i okoliczności szczególne. |
| `zus-manual-form-v2` | Odpowiedzi, bieżące pytanie i informacja o zapisaniu formularza. |

Zmiana odpowiedzi może usunąć pola, które przestały dotyczyć wybranej ścieżki. Przykładem jest zmiana planu dwojga rodziców na plan samodzielnego rodzica. „Usuń zapisane odpowiedzi” po potwierdzeniu czyści oba zapisy. Nieznane daty i kwoty pozostają `null`. Brak rodzica jest reprezentowany jako `mother: null` lub `father: null`.

[Mapowanie szkicu na plan](../plan/caseScenario.ts) przygotowuje `CaseInputs` dla `POST /api/v1/plan`. Wartości z formularza takie jak średnie wynagrodzenie dostarczają danych wejściowych. Podstawę wymiaru i harmonogram oblicza silnik.

## Testowanie

Uruchom aplikację zgodnie z [instrukcją projektu](../../../../README.md). [Ręczny test rodziny](../../../../../README.md#ręczny-test-z-fikcyjną-rodziną) prowadzi od wyboru sytuacji do porównania wariantów w kalkulatorze.

Z katalogu `zus-przewodnik-starter` uruchom testy kreatora i mapowania planu:

```sh
npm run test -w client -- src/features/wizard/__tests__ src/features/plan/__tests__/caseScenario.test.ts
```
