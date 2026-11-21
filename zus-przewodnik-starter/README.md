# Zasiłkowy Przewodnik Przyszłego Rodzica

> Projekt na **HackNation 2026**, wyzwanie **Zakładu Ubezpieczeń Społecznych (ZUS)**.
> Ten plik jest punktem startowym dla ludzi **i agentów AI** (Claude, Gemini, ChatGPT/Codex).
> Agencie: przeczytaj go w całości, potem `agents/CONVENTIONS.md`, a dopiero potem pisz kod.

---

## 1. Cel projektu w jednym akapicie

Budujemy responsywną aplikację webową, która pomaga osobom planującym dziecko, kobietom w ciąży, rodzicom małych dzieci oraz rodzicom adopcyjnym i zastępczym:
1. **ustalić, jakie świadczenia z ubezpieczenia chorobowego im przysługują** (albo dlaczego nie przysługują),
2. **policzyć okres i wysokość zasiłków** (chorobowego w ciąży, macierzyńskiego za każdy rodzaj urlopu) na podstawie ich indywidualnej sytuacji,
3. **przejść przez procedurę**: jakie dokumenty, gdzie (pracodawca czy ZUS) i w jakim terminie złożyć,
4. **uniknąć ryzyk** utraty lub obniżenia świadczeń.

Integracje z systemami państwowymi (mObywatel, ZUS, PUE/eZUS, e-ZLA, akty stanu cywilnego) są **wyłącznie symulowane**. Jury przetestuje demo na **przykładowych sprawach ZUS** i sprawdzi, czy wyliczenia są poprawne. **Poprawność liczb jest najważniejsza.**

## 2. Kryteria oceny (pod nie optymalizujemy)

| Kryterium | Waga |
|---|---|
| Związek z wyzwaniem | 25% |
| Kompletność projektu i UX | 25% |
| Pomysł | 20% |
| Oryginalność | 15% |
| Potencjał wdrożeniowy | 15% |

Wymagania twarde: aplikacja **w pełni responsywna**, **REST API**, **demo online** z możliwością wybrania lub wgrania przykładowej sprawy, **oznaczenie funkcji AI**, prezentacja (max 10 slajdów), film (max 3 min), repozytorium.

## 3. Źródła: co przeczytać, żeby zrozumieć domenę

### 3.1 Dokumenty od ZUS (lokalnie, w `docs/zus/`, NIE w publicznym repo)

> ⚠️ Materiały od ZUS, a zwłaszcza **zestawy przykładowych spraw**, są **wyłącznie na użytek HackNation**: nie wolno ich kopiować ani rozpowszechniać. Folder `docs/zus/` i `data/cases-raw/` są w `.gitignore`. Do repo trafiają tylko **nasze** dane wyciągnięte ze spraw (`data/cases/*.json`), bez kopiowania dokumentów.

| Plik w `docs/zus/` | Co zawiera | Kiedy czytać |
|---|---|---|
| `ZUS_Pelna_tresc_zadania.pdf` | Treść wyzwania: wymagania funkcjonalne (pkt 3a–3j), symulacje, wymagania techniczne, kryteria | **Zawsze najpierw** |
| `Zalacznik_czas_trwania_wysokosc_podstawa.docx` | **Wszystkie liczby:** wymiary urlopów, stawki %, tabela urlopu uzupełniającego, algorytm podstawy wymiaru | Przed każdą pracą w `shared/engine` |
| `Ustawa_zasilkowa_wyciag.pdf` | Ustawa z 25.06.1999 (art. 2a – zadłużenie JDG, art. 29–31 – prawo do macierzyńskiego, art. 36–48a – podstawa wymiaru, art. 61 – płatnik) | Reguły uprawnień i podstawy |
| `Kodeks_pracy_wyciag.pdf` | Art. 177 (ochrona), 180–1823 (urlopy, terminy wniosków, łączenie z pracą) | Kalkulator, plan urlopów, wnioski |
| `Rozporzadzenie_2026_poz_1316.pdf` | Jakie dokumenty i dane są niezbędne do przyznania zasiłków | Moduł „Dokumenty i terminy” |
| `Rozporzadzenie_2025_poz_322.pdf` | Treść wniosków o urlopy rodzicielskie i dokumenty do nich dołączane | Moduł „Wnioski” |
| `Poradnik_dla_rodzicow_ZUS_2026.pdf` | Poradnik ZUS (stan na 1.04.2026), przystępny język | Teksty przewodnika, baza wiedzy dla asystenta AI |

### 3.2 Oficjalne strony (wskazane w treści zadania)

- ZUS – formularze i informacje: https://www.zus.pl (zakładka *Wzory formularzy → Zasiłki*: ZAM, Z-3, Z-3a, ZAS-53)
- Ministerstwo Rodziny – urlop rodzicielski: https://www.gov.pl/web/rodzina/urlop-rodzicielski
- Państwowa Inspekcja Pracy – rodzicielstwo: https://www.pip.gov.pl/dla-pracodawcow/porady-prawne/rodzicielstwo
- Rejestr stanu cywilnego (odpis aktu urodzenia): https://www.gov.pl/web/cyfryzacja/rejestr-stanu-cywilnego

### 3.3 Najważniejsze reguły w pigułce

Wszystkie liczby żyją w `shared/params.json`. **Nigdy nie wpisuj ich w kod.**

- **Urlop macierzyński:** 20 / 31 / 33 / 35 / 37 tyg. dla 1 / 2 / 3 / 4 / 5+ dzieci; do 6 tyg. przed porodem; 14 tyg. po porodzie tylko matka.
- **Urlop rodzicielski:** 41 tyg. (1 dziecko), 43 tyg. (2+); z zaświadczeniem „Za życiem” 65 / 67 tyg.; 9 tyg. nieprzenoszalnych dla każdego rodzica; max 5 części; do końca roku, w którym dziecko kończy 6 lat.
- **Urlop ojcowski:** 2 tyg., w całości lub 2 częściach po min. 1 tydzień; do 12. miesiąca życia dziecka.
- **Urlop uzupełniający:** wcześniaki i dzieci w szpitalu; 1 tydzień za każdy tydzień w szpitalu, limit 8 lub 15 tyg. (tabela w params).
- **Stawki:** 100% (macierzyński, uzupełniający, ojcowski, na warunkach macierzyńskiego); 70% (rodzicielski); **81,5%** za całość, jeśli matka złoży wniosek do 21 dni po porodzie, **ale 9 tyg. drugiego rodzica zawsze 70%**.
- **Martwe urodzenie / zgon dziecka:** przed 8. tygodniem życia – 8 tyg. po porodzie, min. 7 dni od zgonu; po 8. tygodniu – 7 dni od zgonu.
- **Adopcja / rodzina zastępcza:** 20–37 tyg. (min. 9); limit wieku dziecka 7 lat (10 przy odroczeniu obowiązku szkolnego) dla rodziny zastępczej, 14 lat dla adopcji.
- **Zasiłek chorobowy w ciąży:** prawo po 30 dniach (ubezpieczenie obowiązkowe) lub 90 dniach (dobrowolne); 100% przy kodzie „B”; do 270 dni; pracownik najpierw 33 dni (14 po 50. r.ż.) wynagrodzenia chorobowego od pracodawcy.
- **Podstawa wymiaru:** średnia z 12 miesięcy minus 13,71% (szczegóły w załączniku i `CONVENTIONS.md`).
- **JDG:** zadłużenie składkowe > 1% płacy minimalnej w dniu powstania prawa oznacza brak zasiłku do czasu spłaty (art. 2a).
- **Kto wypłaca:** pracodawca, jeśli zgłasza > 20 ubezpieczonych; w innym przypadku ZUS.
- **Formularze:** ZUR i ZAO są od 24.10.2026 włączone do ZAM; Z-3b zlikwidowany.

## 4. Architektura

```
/client     React + Vite + TypeScript       – UI (tylko wyświetla wyniki z API)
/server     Express + TypeScript            – REST API /api/v1/*, adaptery mocków
/shared
  /engine   czyste funkcje TS (bez I/O)     – całe liczenie, 100% pokryte testami
  types.ts  WSPÓLNE TYPY – kontrakt front/back
  params.json  wszystkie stawki i wymiary (edytowalne w panelu admina)
/data
  /profiles   profile testowe do symulacji mObywatela/ZUS (JSON)
  /cases      dane wyciągnięte z przykładowych spraw ZUS (JSON, bez dokumentów)
/docs
  /zus        dokumenty ZUS (gitignored, lokalnie)
/agents     instrukcje dla agentów AI
```

Zasady architektury (ważne dla wdrożenia w ZUS):
- **Najpierw API:** frontend nie liczy niczego sam, woła API. Silnik da się podpiąć pod PUE/eZUS bez naszego UI.
- **Adaptery:** `AuthProvider` (dziś `MockMObywatelProvider`) i `ZusDataProvider` (dziś `MockZusDataProvider`). Prawdziwe integracje = podmiana adaptera.
- **Stan w URL** (`/plan?...`): można linkować do konkretnego wyliczenia.
- **Bez danych osobowych na serwerze** w wersji demo.

## 5. Mapa aplikacji

1. **Start:** wybór sytuacji (planuję / w ciąży / po porodzie / adopcja) + „Zaloguj przez mObywatela” lub „Kontynuuj bez logowania”.
2. **Logowanie (symulacja):** wybór profilu → „Pobrane dane z ZUS” (edytowalne).
3. **Kreator sytuacji:** forma zatrudnienia → data porodu/przyjęcia → liczba dzieci → okoliczności szczególne → drugi rodzic.
4. **Twój plan** (zakładki): Uprawnienia · Kalkulator · Plan urlopów · Dokumenty i terminy · Wnioski · Wsparcie.
5. Z menu: **Przewodnik** (baza wiedzy) · **Przykładowe sprawy** (dla jury) · **Panel admina** (`/admin`).

## 6. Zadania i właściciele

| Zadanie | Katalog | Właściciel |
|---|---|---|
| Przewodnik (dokumenty, terminy, ryzyka), materiały do zgłoszenia | `client/src/features/guide`, `docs/` | Osoba 1 |
| UI/UX: kreator, layout, responsywność | `client/src/app`, `client/src/components` | Osoba 2 |
| Symulacja mObywatela i danych z ZUS, świadczenia w ciąży, wnioski | `client/src/features/{login,applications}`, `server/src/adapters` | Osoba 3 |
| REST API, parametry, panel admina, deploy, asystent AI | `server/`, `client/src/features/admin` | Osoba 4 |
| Kalkulator zasiłku macierzyńskiego, plan urlopów, łączenie z pracą, adopcja | `shared/engine/{maternity,parental,adoption}` | Osoba 5 |
| Podstawa wymiaru, przykładowe sprawy ZUS | `shared/engine/benefitBase`, `data/cases` | Osoba 6 |

## 7. Workflow Git (obowiązkowy, także dla agentów)

**Jeden feature = jeden branch. Nikt nie commituje bezpośrednio do `main` ani do `checkN`.**

### Gałęzie
| Gałąź | Rola |
|---|---|
| `main` | Ostatni działający stan, z którego idzie deploy demo. Tylko fast-forward z checkpointu. |
| `check1`, `check2`, `check3`, … | **Checkpointy integracyjne co 2–3 h.** Tu łączymy wszystkie feature branche. |
| `feature/<obszar>-<krótki-opis>` | Praca nad jednym zadaniem, np. `feature/engine-maternity-leave`, `feature/ui-wizard`, `feature/api-cases` |
| `fix/<opis>` | Poprawka błędu znalezionego przy integracji |

Obszary w nazwie brancha: `engine`, `api`, `ui`, `mock`, `guide`, `admin`, `cases`, `ai`, `docs`.

### Cykl pracy
1. **Start:** `git checkout checkN && git pull && git checkout -b feature/<obszar>-<opis>` (zawsze od **najnowszego** checkpointu).
2. **Praca:** małe commity w konwencji **Conventional Commits**:
   `feat(engine): add maternity leave weeks by children count`
   `fix(api): return 422 on invalid birthDate`
   `test(engine): cover 81.5% rate with 9 weeks for second parent`
   Typy: `feat`, `fix`, `test`, `refactor`, `docs`, `style`, `chore`.
3. **Przed pushem:** `npm run lint && npm run typecheck && npm test` muszą przejść.
4. **Push** brancha i otwarcie PR do bieżącego checkpointu (`checkN+1`), z opisem: co zrobione, jak przetestować, czy zmienia kontrakt.
5. **Co 2–3 h – integracja (prowadzi Osoba 4 albo lider):**
   ```bash
   git checkout checkN && git pull
   git checkout -b checkN+1
   git merge --no-ff feature/...     # po kolei każdy gotowy branch
   npm ci && npm run typecheck && npm test && npm run build
   git push origin checkN+1
   # jeśli wszystko zielone:
   git checkout main && git merge --ff-only checkN+1 && git push
   ```
6. **Po integracji** każdy aktualizuje swój branch: `git merge checkN+1` (bez `rebase` na już wypchniętych branchach).
7. **Branch nieskończony?** Nie wchodzi do checkpointu. Lepiej mniejszy działający zakres niż zepsuty build.

### Zmiany kontraktu (`shared/types.ts`, `shared/params.json`, ścieżki API)
- Zmiany kontraktu tylko w osobnym branchu `feature/contract-<opis>`, ogłoszone zespołowi **przed** merge.
- Każda zmiana kontraktu trafia do sekcji *Changelog kontraktu* w `agents/CONVENTIONS.md`.
- Nie zmieniaj nazw istniejących pól. Dodawaj nowe, stare oznacz jako przestarzałe.

### Zakazy
- ❌ `git push --force` na wspólne gałęzie (`main`, `checkN`)
- ❌ commit plików z `docs/zus/`, `data/cases-raw/`, `.env`, kluczy API
- ❌ commit z czerwonymi testami
- ❌ „przy okazji” refaktory poza zakresem zadania

## 8. Uruchomienie

Wymagania (Node.js ≥ 20, npm ≥ 10), pełna lista zależności i opis skryptów: **[`REQUIREMENTS.md`](REQUIREMENTS.md)**.

```bash
npm ci               # katalog zus-przewodnik-starter, workspaces client, server, shared
npm run dev          # client :5173 + server :3001
npm test             # testy shared + server + client
npm run build
```

## 9. Funkcje AI (do oznaczenia w UI i w opisie zgłoszenia)

Każdą funkcję korzystającą z AI oznaczamy w UI etykietą „Wspierane przez AI” i wpisujemy do listy poniżej.

- [x] Asystent odpowiadający na podstawie poradnika ZUS (opcjonalny) — zakładka Wsparcie (`/plan/support`, oznaczona `<AiBadge />`. Odpowiedzi pochodzą z bazy demonstracyjnej)
- [ ] Odczyt danych z PDF przykładowej sprawy (opcjonalny)

## Test wersji konkursowej

1. Otwórz `http://localhost:5173/cases` i wybierz jedną z sześciu spraw.
2. Przejdź przez sześć zakładek planu. W sprawie 04 ustaw drugą część od 09.11.2027 do 10.01.2028. Sprawdź termin 19.10.2027 w dokumentach i zakres dat we wniosku ojca.
3. Sprawdź `/api/v1/health` na porcie API. Porównanie z decyzją jest dostępne w katalogu spraw oraz w `POST /api/v1/cases/:caseId/evaluate`.

### Wnioski i walidacja kreatora

1. Po porodzie ustaw datę sprzed 21 dni, a następnie sprzed 22 dni. Sprawdź, czy kreator nadal pozwala wybrać 81,5% w pierwszym przypadku i wybiera stawki rozdzielone w drugim.
2. W planie obojga rodziców zaznacz pobyt mamy w szpitalu i orzeczenie jednocześnie. Następnie wybierz zgon mamy. Podaj datę zgonu i sprawdź, czy formularz przechodzi do danych taty.
3. W zakładce **Wnioski** wybierz **Pobierz dane z mObywatela (symulacja)**. Podaj testowe imię i nazwisko oraz opcjonalny PESEL. Po powrocie sprawdź dane wybranego wnioskodawcy.
4. Rozwiń wniosek urlopowy. Uzupełnij wymagane pola i sprawdź listę załączników oraz podgląd do druku. Symulacja wysyłki sprawdza pola wniosku. Załączniki należy skompletować osobno.

Wnioski pracownicze generowane z planu obejmują urlopy i czynności dostępne w aplikacji. Dane osobowe z symulacji pozostają w pamięci strony do jej odświeżenia. [Rozporządzenie MRPiPS, Dz.U. 2025 poz. 322](https://dziennikustaw.gov.pl/DU/2025/322)

Gdy domyślne porty są zajęte, uruchom w PowerShell:

```powershell
$env:PORT = '3301'
$env:VITE_PORT = '5276'
npm run dev
```

Panel `/admin` przyjmuje token ustawiony w zmiennej środowiskowej serwera `ADMIN_TOKEN`. Testowe zmiany parametrów obowiązują do restartu API. Plik `shared/params.json` zawiera wartości początkowe. Używaj przykładowych danych we wnioskach. Link planu zawiera dane scenariusza potrzebne do wyliczenia.

[Raport integracji i wyniki spraw](../docs/FIX_ALL_REPORT.md)
