# Wspólne konwencje (kontrakt) dla ludzi i agentów AI

> Ten plik jest **jedynym źródłem prawdy** o nazwach, typach, formatach i API.
> Claude, Gemini i ChatGPT/Codex czytają ten sam plik, więc piszą zgodny kod.
> Jeśli coś tu nie pasuje do Twojego zadania, **nie wymyślaj własnej nazwy**: zaproponuj zmianę kontraktu (README §7).

---

## 1. Język i nazewnictwo

| Co | Konwencja | Przykład |
|---|---|---|
| Kod (zmienne, funkcje, typy, pola JSON, endpointy) | **angielski** | `maternityLeave`, `benefitBase` |
| Teksty widoczne dla użytkownika | **polski** | „Zasiłek macierzyński” |
| Komentarze w kodzie | polski lub angielski, krótko | |
| Zmienne, funkcje, pola JSON | `camelCase` | `birthDate`, `calculateMaternityBenefit()` |
| Typy, interfejsy, komponenty React | `PascalCase` | `MaternityCalculationResult`, `WizardStep` |
| Stałe | `UPPER_SNAKE_CASE` | `API_BASE_URL` |
| Pliki TS (nie komponenty) | `camelCase.ts` | `benefitBase.ts` |
| Pliki komponentów | `PascalCase.tsx` | `LeaveTimeline.tsx` |
| Wartości enumów (string unions) | `camelCase` | `'selfEmployed'` |
| Ścieżki URL API | `kebab-case`, `/api/v1/...` | `/api/v1/calculate/benefit-base` |

## 2. Słownik domeny (PL → kod). UŻYWAJ DOKŁADNIE TYCH NAZW

| Polski termin | Nazwa w kodzie |
|---|---|
| zasiłek chorobowy | `sicknessBenefit` |
| wynagrodzenie chorobowe (od pracodawcy) | `employerSickPay` |
| zasiłek macierzyński | `maternityBenefit` |
| zasiłek w wysokości zasiłku macierzyńskiego | `maternityEquivalentBenefit` |
| świadczenie rehabilitacyjne | `rehabilitationBenefit` |
| urlop macierzyński | `maternityLeave` |
| urlop na warunkach urlopu macierzyńskiego | `adoptionMaternityLeave` |
| uzupełniający urlop macierzyński | `supplementaryMaternityLeave` |
| urlop rodzicielski | `parentalLeave` |
| urlop ojcowski | `paternityLeave` |
| łączenie urlopu rodzicielskiego z pracą | `parentalLeaveWithWork` |
| podstawa wymiaru zasiłku | `benefitBase` |
| podstawa wymiaru składek | `contributionBase` |
| okres zasiłkowy | `benefitPeriod` |
| okres wyczekiwania (30/90 dni) | `waitingPeriod` |
| tytuł ubezpieczenia | `insuranceTitle` |
| umowa o pracę | `'employment'` |
| umowa zlecenie | `'mandateContract'` |
| działalność gospodarcza (JDG) | `'selfEmployed'` |
| brak ubezpieczenia | `'none'` |
| ubezpieczenie chorobowe obowiązkowe / dobrowolne | `sicknessInsurance: 'mandatory' \| 'voluntary' \| 'none'` |
| płatnik składek (kto wypłaca) | `payer: 'employer' \| 'zus'` |
| zaświadczenie „Za życiem” | `zaZyciemCertificate: boolean` |
| przewidywana / faktyczna data porodu | `expectedBirthDate` / `birthDate` |
| data przyjęcia dziecka na wychowanie | `childAcceptanceDate` |
| rodzina zastępcza / przysposobienie | `adoptionType: 'fosterFamily' \| 'adoption'` |
| matka / ojciec (drugi rodzic) | `parentRole: 'mother' \| 'father'` |
| zadłużenie składkowe | `contributionDebt` |
| e-ZLA (zwolnienie lekarskie) | `sickLeaveCertificate` (ZLA) |
| kod literowy „B” (ciąża) | `pregnancyCode: true` |
| przykładowa sprawa ZUS | `case` (`ZusCase`) |
| profil testowy (symulacja) | `mockProfile` |
| wniosek | `application` |

## 3. Formaty danych

| Typ | Format | Przykład |
|---|---|---|
| Data | ISO `YYYY-MM-DD` (string), bez godzin | `"2027-03-10"` |
| Kwota | `number` w **PLN**, zaokrąglenie do 2 miejsc **tylko na wyjściu** (`roundPln()` w engine) | `4147.10` |
| Stawka procentowa | ułamek dziesiętny | `0.815` (nie `81.5`) |
| Okres urlopu | `weeks` (liczba całkowita) **i** `startDate` / `endDate` | |
| Dni | `days` (liczba całkowita) | |
| Wartość nieznana | `null` (nie `""`, nie `0`, nie `undefined` w JSON) | |
| Waluta w UI | `Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' })` | `4 147,10 zł` |
| Data w UI | `Intl.DateTimeFormat('pl-PL')` | `10.03.2027` |

## 4. Typy i parametry (kod, nie opis)

- Typy: **`shared/types.ts`**. Importuj stamtąd zarówno w `client`, jak i w `server`. Nie duplikuj typów lokalnie.
- Parametry: **`shared/params.json`** (typ `BenefitParams`). Engine dostaje parametry jako argument: `calculateX(input, params)`. Dzięki temu panel admina i testy mogą podać inne wartości.

## 5. Silnik obliczeń (`shared/engine`)

- **Czyste funkcje:** bez `fetch`, bez `fs`, bez `Date.now()` (datę „dzisiaj” podaje się jako argument `referenceDate`).
- Jedna funkcja publiczna na moduł, eksportowana z `shared/engine/index.ts`:
  - `checkEligibility(input: ScenarioInput, params): EligibilityResult`
  - `calculateMaternity(input: ScenarioInput, params): MaternityCalculationResult`
  - `calculateBenefitBase(input: BenefitBaseInput, params): BenefitBaseResult`
  - `planParentalSplit(input: ParentalSplitInput, params): ParentalSplitResult`
  - `calculateParentalLeaveWithWork(input: ParentalWithWorkInput, params): ParentalWithWorkResult`
  - `calculateSicknessInPregnancy(input: ScenarioInput, params): SicknessResult`
  - `getRequiredDocuments(input: ScenarioInput, params): DocumentChecklist`
- Każdy wynik zawiera `explanations: Explanation[]` (dlaczego tak wyszło + źródło prawne), żeby UI mógł pokazać uzasadnienie.
- **Testy:** `shared/engine/__tests__/*.test.ts` (Vitest). Każda reguła ma test. Każda przykładowa sprawa z `data/cases` ma test porównujący z decyzją ZUS.

## 6. REST API

Bazowy prefiks: **`/api/v1`**. Wszystko JSON. Odpowiedź zawsze w kopercie:

```json
{ "data": { ... }, "error": null }
{ "data": null, "error": { "code": "VALIDATION_ERROR", "message": "birthDate is required", "details": [...] } }
```

Kody błędów: `VALIDATION_ERROR` (422), `NOT_FOUND` (404), `UNAUTHORIZED` (401), `INTERNAL_ERROR` (500).

| Metoda | Ścieżka | Body → `data` | Właściciel |
|---|---|---|---|
| POST | `/api/v1/eligibility` | `ScenarioInput` → `EligibilityResult` | Osoba 4 (engine: 3/5) |
| POST | `/api/v1/calculate/maternity` | `ScenarioInput` → `MaternityCalculationResult` | Osoba 4 (engine: 5) |
| POST | `/api/v1/calculate/benefit-base` | `BenefitBaseInput` → `BenefitBaseResult` | Osoba 4 (engine: 6) |
| POST | `/api/v1/calculate/sickness` | `ScenarioInput` → `SicknessResult` | Osoba 4 (engine: 3) |
| POST | `/api/v1/plan/parental-split` | `ParentalSplitInput` → `ParentalSplitResult` | Osoba 4 (engine: 5) |
| POST | `/api/v1/plan/parental-with-work` | `ParentalWithWorkInput` → `ParentalWithWorkResult` | Osoba 4 (engine: 5) |
| POST | `/api/v1/documents` | `ScenarioInput` → `DocumentChecklist` | Osoba 4 (treść: 1) |
| GET | `/api/v1/cases` | → `ZusCaseSummary[]` | Osoba 6 |
| GET | `/api/v1/cases/:caseId` | → `ZusCase` | Osoba 6 |
| POST | `/api/v1/cases/:caseId/evaluate` | → `CaseEvaluationResult` | Osoba 6 |
| GET | `/api/v1/mock/profiles` | → `MockProfileSummary[]` | Osoba 3 |
| POST | `/api/v1/mock/login` | `{ profileId }` → `{ sessionToken, profile: UserProfile }` | Osoba 3 |
| GET | `/api/v1/mock/zus-data` | (nagłówek `Authorization: Bearer <sessionToken>`) → `ZusData` | Osoba 3 |
| GET | `/api/v1/params` | → `BenefitParams` | Osoba 4 |
| PUT | `/api/v1/admin/params` | `BenefitParams` → `BenefitParams` (wymaga admina) | Osoba 4 |
| POST | `/api/v1/assistant/ask` | `{ question }` → `{ answer, sources[] }` (AI, opcjonalne) | Osoba 4 |

Frontend woła API **tylko** przez `client/src/api/client.ts` (jedno miejsce z `API_BASE_URL` i obsługą koperty).

## 7. Frontend

- Routing (React Router): `/`, `/login`, `/wizard`, `/plan`, `/plan/:tab`, `/guide`, `/guide/:slug`, `/cases`, `/cases/:caseId`, `/admin`.
- Zakładki `/plan/:tab`: `entitlements`, `calculator`, `leave-plan`, `documents`, `applications`, `support`.
- Stan scenariusza: jeden obiekt `ScenarioInput` w kontekście `ScenarioContext`, zsynchronizowany z query stringiem URL.
- Struktura: `client/src/features/<feature>/` (komponenty + hooki danej funkcji), `client/src/components/` (wspólne UI), `client/src/api/`.
- Responsywność: mobile-first; punkty przerwania 640 / 1024 px.
- Funkcje AI oznaczone komponentem `<AiBadge />`.
- Teksty dla użytkownika: prosty, empatyczny polski; przy trudnych sytuacjach (śmierć dziecka) bez wykrzykników i bez „gratulacji”.

## 8. Backend

- `server/src/routes/*.ts` → walidacja (zod) → wywołanie `shared/engine` → koperta.
- Adaptery: `server/src/adapters/AuthProvider.ts`, `ZusDataProvider.ts` (interfejsy) + `Mock*` (implementacje). Nikt poza adapterem nie czyta `data/profiles` bezpośrednio.
- Port domyślny: `3001`. CORS dla `http://localhost:5173` i adresu demo.
- Parametry: odczyt z `shared/params.json`; zapis z panelu admina do tego samego pliku (wersja demo).

## 9. Jakość

- TypeScript `strict: true`. Bez `any` (wyjątek z komentarzem `// eslint-disable-next-line` i powodem).
- ESLint + Prettier (konfiguracja w root). `npm run lint`, `npm run typecheck`, `npm test` przed każdym pushem.
- Dane z przykładowych spraw ZUS: tylko wyciągnięte wartości w `data/cases/<caseId>.json`, **bez** skanów i PDF-ów.

## 10. Otwarte kwestie (do potwierdzenia u mentorów ZUS)

- [ ] Minimalna podstawa wymiaru 2026: tabela w załączniku jest pusta. Roboczo `minimumWage × (1 − 0.1371)` ≈ 4147,10 zł (art. 45).
- [ ] Granice tygodnia ciąży w tabeli urlopu uzupełniającego („przed 28.” / „po 28.”): interpretujemy jako `< 28` i `>= 28 && < 37`.

## 11. Changelog kontraktu

| Data | Zmiana | Autor |
|---|---|---|
| 2026-11-21 | Wersja początkowa | zespół |
