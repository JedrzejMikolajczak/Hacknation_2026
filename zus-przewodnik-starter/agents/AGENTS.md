# AGENTS.md: instrukcje dla ChatGPT / OpenAI Codex

> Projekt: **Zasiłkowy Przewodnik Przyszłego Rodzica** (HackNation 2026, wyzwanie ZUS). Te same zasady obowiązują Claude i Gemini (`agents/CLAUDE.md`, `agents/GEMINI.md`), żeby kod z różnych agentów się integrował.
> Umieść kopię tego pliku (lub symlink) w katalogu głównym repo jako `AGENTS.md`: Codex czyta go stamtąd automatycznie. W zwykłym czacie ChatGPT wklej treść tego pliku (oraz `agents/CONVENTIONS.md` i `shared/types.ts`) na początku rozmowy.

## Zanim napiszesz jakikolwiek kod

1. Przeczytaj **`README.md`** (cel projektu, źródła, architektura, workflow Git).
2. Przeczytaj **`agents/CONVENTIONS.md`** (nazwy, formaty, API). To kontrakt; nie wymyślaj własnych nazw.
3. Otwórz **`shared/types.ts`** i **`shared/params.json`**. Importuj typy stamtąd, a liczby bierz z params.
4. Jeśli zadanie dotyczy reguł zasiłków, sprawdź źródło w `docs/zus/` (lista plików w README §3). Każdą regułę opisz w `explanations` z `legalBasis`.
5. Sprawdź, na jakim jesteś branchu: `git branch --show-current`. Jeśli to `main` albo `checkN`, **zatrzymaj się** i utwórz branch `feature/<obszar>-<opis>` od najnowszego `checkN`.

## Zasady, których nie łamiesz

- **Nazwy:** pola domenowe API, JSON i URL używają `snake_case`. Wartości wyliczeniowe mają zapis `UPPER_SNAKE_CASE`. Funkcje i zmienne lokalne używają `camelCase`.
- **Formaty:** daty `YYYY-MM-DD`, kwoty `number` w PLN (zaokrąglane tylko na wyjściu), stawki w odpowiedziach jako procenty (`81.5`), brak wartości = `null`.
- **Bez liczb w kodzie:** żadnych `20`, `41`, `0.7`, `0.1371` itp. w logice. Wszystko z `params: BenefitParams`.
- **Silnik (`shared/engine`):** czyste funkcje `fn(input, params)`, bez I/O, bez `Date.now()`; każda reguła ma test w Vitest.
- **API:** tylko ścieżki z `CONVENTIONS.md` §6, prefiks `/api/v1`, odpowiedź w kopercie `{ data, error }`. Nowy endpoint = zmiana kontraktu.
- **Frontend:** API wołasz tylko przez `client/src/api/client.ts`; stan scenariusza w `ScenarioContext` (dane planu typu `CaseInputs`).
- **Kontrakt** (`shared/types.ts`, `shared/params.json`, ścieżki API): nie zmieniaj w zwykłym feature branchu. Jeśli musisz, zaproponuj zmianę człowiekowi i dopisz ją do *Changelog kontraktu*.
- **Zakres:** rób tylko to, o co poproszono. Bez refaktorów „przy okazji”, bez zmiany plików innych właścicieli (README §6), bez nowych zależności bez pytania.
- **Dane ZUS:** nigdy nie commituj `docs/zus/`, `data/cases-raw/`, `.env`, kluczy. Do `data/cases/*.json` trafiają tylko wyciągnięte wartości.
- **AI w aplikacji:** każda funkcja korzystająca z modelu AI dostaje `<AiBadge />` i wpis w README §9.
- **Wygląd:** spokojny, przyjazny interfejs inspirowany paletą ZUS (Lato, zieleń `#007834`, granat `#00416e`, pomarańczowe CTA `#fab856`, miękkie zaokrąglenia i cienie). Kolory, odstępy, promienie i fonty wyłącznie z `client/src/styles/tokens.css`. Bez logo ZUS i bez udawania oficjalnego serwisu. Szczegóły: `CONVENTIONS.md` §7.1.

## Git: workflow, który wykonujesz

- Jeden feature = jeden branch: `feature/<obszar>-<krótki-opis>`, obszary: `engine`, `api`, `ui`, `mock`, `guide`, `admin`, `cases`, `ai`, `docs`, `contract`.
- Małe commity w Conventional Commits: `feat(engine): ...`, `fix(api): ...`, `test(engine): ...`, `docs: ...`.
- Przed każdym commitem/pushem: `npm run lint && npm run typecheck && npm test`. Czerwone = nie commitujesz.
- Nigdy: commit do `main` / `checkN`, `git push --force` na wspólne gałęzie, `git rebase` na wypchniętym branchu.
- Integracja co 2–3 h do `check1`, `check2`, …: robi to człowiek (README §7). Po integracji zaktualizuj swój branch: `git merge checkN`.
- Na koniec pracy podaj: listę zmienionych plików, czy zmieniłeś kontrakt (powinno być „nie”), jak przetestować.

## Gdy czegoś nie wiesz

Nie zgaduj reguł prawnych ani nazw. Zapytaj człowieka albo dopisz pytanie do `CONVENTIONS.md` §10 *Otwarte kwestie*, a w kodzie zostaw `// TODO(contract): ...`.

## Specyficzne dla ChatGPT / Codex

- W zwykłym czacie (bez dostępu do repo) zawsze zwracaj **pełne pliki** ze ścieżką w nagłówku, np. `// shared/engine/maternity.ts`, żeby dało się je wkleić bez zgadywania.
- Nie twórz typów lokalnie: jeśli brakuje typu, poproś o aktualny `shared/types.ts`.
- W Codex: uruchamiaj `npm run lint && npm run typecheck && npm test` przed zgłoszeniem PR.
