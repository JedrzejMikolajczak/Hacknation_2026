<div align="center">

# Zasiłkowy Przewodnik Przyszłego Rodzica

**Prosty plan urlopów, świadczeń i formalności ZUS — od ciąży i porodu po adopcję i trudne sytuacje życiowe.**

Projekt zespołowy przygotowany na **HackNation 2026** dla wyzwania Zakładu Ubezpieczeń Społecznych.

![Node.js 20+](https://img.shields.io/badge/Node.js-20.12%2B-339933?style=flat-square&logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)
![React + Vite](https://img.shields.io/badge/React%20%2B%20Vite-Frontend-007834?style=flat-square&logo=react&logoColor=white)
![Express API](https://img.shields.io/badge/Express-REST%20API-1c3d2e?style=flat-square)
![Gemini AI](https://img.shields.io/badge/Gemini%20AI-Asystent%20Wsparcia-4285F4?style=flat-square&logo=google&logoColor=white)

</div>

---

## O co chodzi w projekcie?

Przepisy wokół zasiłku macierzyńskiego, urlopu rodzicielskiego i zwolnień w ciąży potrafią przytłoczyć — szczególnie wtedy, gdy w życiu rodziny dzieje się najważniejsza rzecz. Rodzice często nie wiedzą:
- czy przysługuje im zasiłek i kto go wypłaca (**pracodawca** czy **ZUS**),
- czy wybrać **81,5% przez cały rok**, czy **100% + 70%**, i kiedy mija kluczowy termin **21 dni od porodu**,
- co grozi przy działalności gospodarczej (**dług powyżej 1% płacy minimalnej blokuje wypłatę**), przy kończącej się umowie na czas określony albo przy dwóch tytułach ubezpieczenia,
- jakie dokumenty złożyć, do kogo i w jakiej kolejności.

**ZUS Przewodnik** zamienia zawiłe przepisy w **jeden spójny, spersonalizowany plan** ułożony ludzkim językiem. Najpierw odpowiada na najważniejsze pytanie (*„co mi przysługuje i ile dostanę?”*), a dopiero później rozwija szczegóły, podstawy prawne i gotowe wnioski.

> [!NOTE]
> Aplikacja jest prototypem demonstracyjnym. Logowanie przez **mObywatela**, dane z **ZUS** (w tym e-ZLA i zaświadczenie o zadłużeniu) oraz wysyłka wniosków działają w trybie symulacji na fikcyjnych profilach. Wyliczenia mają charakter informacyjny i nie zastępują oficjalnej decyzji ZUS.

---

## Jak działa krok po kroku?

```text
1. Wybór sytuacji          2. Dane (ręcznie lub mObywatel)     3. Twój spersonalizowany plan
   Ciąża · Po porodzie  ─►    Prosty kreator krok po kroku  ─►    Uprawnienia · Kalkulator · Urlopy
   Planowanie · Adopcja       albo gotowe profile testowe         Dokumenty · Wnioski PDF · Asystent AI
```

### Co znajdziesz w aplikacji?

| Moduł | Co daje użytkownikowi |
| --- | --- |
| **Kreator sytuacji** (`/wizard`) | Zbiera tylko te informacje, które faktycznie wpływają na uprawnienia i kwoty — bez żargonu, z obsługą m.in. JDG, umowy zlecenia, drugiego tytułu ubezpieczenia, wcześniaków i trudnych sytuacji życiowych (ze spokojnym, empatycznym tonem). |
| **Symulacja mObywatela i ZUS** (`/login`) | Pozwala zalogować się na fikcyjny profil (np. UoP, zlecenie, JDG z długiem lub bez), automatycznie uzupełnić puste pola w formularzu z oznaczeniem źródła danych, obejrzeć **e-ZLA z kodem „B”** oraz **zaświadczenie o zadłużeniu składkowym**. |
| **Twój plan** (`/plan`) | Sześć czytelnych zakładek w jednym miejscu: **Uprawnienia** (ze zwijanymi szczegółami świadczeń), **Kalkulator** (porównanie 81,5% vs 100% + 70%), **Plan urlopów** (oś czasu mamy i taty, presety podziału, kalendarz i łączenie urlopu z pracą), **Dokumenty i terminy**, **Wnioski** (podgląd, mapa składania i generator wypełnionych PDF-ów **ZAM** / **ZAS-53**) oraz **Wsparcie**. |
| **Centrum powiadomień „Uwagi”** | Wspólny przycisk z licznikiem w górnym pasku planu zbiera w jednym miejscu wszystkie ryzyka i kluczowe terminy (np. zadłużenie JDG, termin 21 dni, okres wyczekiwania), żeby nie dublować ostrzeżeń między zakładkami. |
| **Asystent AI w zakładce Wsparcie** | Odpowiada na pytania w kontekście zanonimizowanego planu użytkownika (Google Gemini `gemini-3.1-flash-lite`), maskuje wrażliwe dane (PESEL, numer konta), blokuje wklejanie zdjęć, chroni limity cache'em i rate limiterem, a bez klucza API płynnie przechodzi na lokalną bazę ZUS 2026. |
| **Przykładowe sprawy i import PDF** (`/cases`) | Katalog 6 spraw testowych do natychmiastowego sprawdzenia działania silnika oraz lokalny odczyt pól z własnego pliku PDF w przeglądarce (z weryfikacją przez użytkownika przed przeliczeniem). |
| **Przewodnik i Panel parametrów** (`/guide`, `/admin`) | Baza wiedzy po ludzku oraz panel demonstracyjny do podglądu i zmiany aktualnych stawek i progów (np. płacy minimalnej). |

---

## Szybki start

Wymagania: **Node.js 20.12+** oraz **npm 10+**.

```bash
cd zus-przewodnik-starter
npm ci
npm run dev
```

Po uruchomieniu:
- **Aplikacja (frontend):** [`http://localhost:5173`](http://localhost:5173/)
- **API (healthcheck):** [`http://localhost:3001/api/v1/health`](http://localhost:3001/api/v1/health) — powinno zwrócić `{"data":{"status":"ok"},"error":null}`

> [!TIP]
> **Asystent AI działa od razu nawet bez konfiguracji** (w lokalnym trybie bazy ZUS 2026). Jeśli chcesz włączyć odpowiedzi na żywo z Google Gemini, skopiuj [`zus-przewodnik-starter/.env.example`](zus-przewodnik-starter/.env.example) do `zus-przewodnik-starter/.env` i wpisz swój `GEMINI_API_KEY`. Plik `.env` jest ignorowany przez Git.

---

## Jak przetestować aplikację w 2 minuty?

### Ścieżka 1 — najszybsza (1 kliknięcie)
1. Otwórz [**Przykładowe sprawy**](http://localhost:5173/cases), wybierz np. **sprawę 04** i kliknij **„Otwórz w planie”** — zobaczysz od razu uprawnienia, kalkulator, oś czasu obojga rodziców, powiadomienia **Uwagi**, dokumenty i wnioski PDF.
2. Możesz też wejść w [**Logowanie (mObywatel – symulacja)**](http://localhost:5173/login), wybrać profil np. **Katarzyna (JDG z zadłużeniem)** i zobaczyć zaświadczenie o długu oraz alert w powiadomieniach.

### Ścieżka 2 — pełny test ręczny z fikcyjną rodziną

<details>
<summary><strong>Rozwiń scenariusz testowy: Anna i Piotr Kowalscy (spodziewają się dziecka)</strong></summary>

Wybierz na stronie startowej: **Jestem w ciąży → Kontynuuj bez logowania → Dwoje rodziców**.

| Krok w kreatorze | Dane do wpisania |
| --- | --- |
| Przewidywany termin porodu i liczba dzieci | Data ok. **8 tygodni od dziś**, **1 dziecko** |
| Zaświadczenie „Za życiem” i sytuacja mamy | **Nie** oraz **Nie dotyczy** |
| Zatrudnienie obojga | **Umowa o pracę**. Ubezpieczenie Anny od `01.03.2022`, Piotra od `01.06.2021`. Dla obojga wybierz umowę bezterminową. |
| Liczba osób zgłoszonych przez płatników | Pracodawca Anny: **80**, pracodawca Piotra: **15** |
| Dodatkowe pytania o Annę | Wiek **30 lat**, rozwiązanie umowy: **Nie**, zwolnienie w tej ciąży: **Nie** |
| Urlop i zarobki | Oboje planują skorzystać. Wybierz **„Podstawę ustalimy później”** i wpisz po **7 000 zł** brutto dla Anny oraz **8 500 zł** brutto dla Piotra. |
| Drugi tytuł i wariant zasiłku | **Nie, mam tylko jeden tytuł** oraz **Jeszcze nie wiemy – pokażcie porównanie** |

Kliknij **Zapisz odpowiedzi → Przejdź do planu → Kalkulator**.
- Podstawy wymiaru powinny wynieść **6 040,30 zł** dla Anny (wypłaca pracodawca) i **7 334,65 zł** dla Piotra (wypłaca ZUS).
- Porównaj oba warianty wypłaty (**81,5%** vs **100% + 70%**) i sprawdź podział urlopów na osi czasu w zakładce **Plan urlopów**.

</details>

---

## Testy i weryfikacja

Wszystkie polecenia wykonuj w katalogu `zus-przewodnik-starter`:

```bash
npm run lint       # ESLint dla całego monorepo
npm run typecheck  # TypeScript (shared, server, client)
npm test           # Testy jednostkowe i integracyjne Vitest
npm run build      # Pełny build produkcyjny
```

---

## Struktura repozytorium

```text
Hacknation_2026/
├── zus-przewodnik-starter/        # Główna aplikacja (monorepo npm workspaces)
│   ├── client/                    # Frontend React + Vite + TypeScript (kreator, plan, PDF, AI UI)
│   ├── server/                    # REST API Express + walidacja Zod + adaptery (mObywatel, ZUS, Gemini)
│   ├── shared/                    # Deterministyczny silnik uprawnień, kwot, okresów i dokumentów
│   ├── data/                      # Sprawy katalogowe (cases/) i fikcyjne profile demonstracyjne (profiles/)
│   ├── agents/                    # Konwencje API i wytyczne pracy zespołu
│   └── README.md                  # Szczegółowa dokumentacja techniczna, zmienne .env i mapa modułów
├── docs/                          # Dokumentacja weryfikacyjna projektu
│   ├── FIX_ALL_REPORT.md          # Raport integracji
│   └── test-cases.md              # Matryca spraw testowych
└── README.md                      # Ten plik
```

Szczegółową konfigurację środowiska (zmienne `.env`, własne porty, opis endpointów API, licencje i raport E2E) znajdziesz w **[dokumentacji technicznej aplikacji](zus-przewodnik-starter/README.md)**.
