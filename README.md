# Zasiłkowy Przewodnik Przyszłego Rodzica

Projekt zespołowy na **HackNation 2026** w ramach wyzwania Zakładu Ubezpieczeń Społecznych.

ZUS Przewodnik pomaga przygotować plan na czas ciąży, po porodzie, przy adopcji lub przyjęciu dziecka do niezawodowej rodziny zastępczej. Kreator zbiera dane rodziny, a kalkulator pokazuje przewidywane świadczenia, płatnika i podział urlopów. Plan obejmuje też terminy, listę dokumentów i pobieranie wybranych formularzy. Logowanie mObywatelem i dane ZUS działają na profilach demonstracyjnych.

## Uruchomienie i pierwszy test

Przygotuj **Node.js 20.12 lub nowszy** oraz **npm 10 lub nowszy**. W katalogu głównym repozytorium uruchom:

```sh
cd zus-przewodnik-starter
npm ci
npm run dev
```

Otwórz [aplikację](http://localhost:5173/) i sprawdź [odpowiedź API](http://localhost:3001/api/v1/health). Powinna zawierać `"status": "ok"`. W [przykładowych sprawach](http://localhost:5173/cases) wybierz sprawę 04 i otwórz „Twój plan”. Możesz sprawdzić wynik kalkulatora, oś czasu i wymagane dokumenty.

Po zatrzymaniu serwerów lub w drugim terminalu, w katalogu `zus-przewodnik-starter`, uruchom `npm test`. Jeśli potrzebujesz innych portów lub chcesz uruchomić opcjonalne funkcje, zajrzyj do [instrukcji aplikacji](zus-przewodnik-starter/README.md).

## Ręczny test z fikcyjną rodziną

Anna i Piotr Kowalscy spodziewają się jednego dziecka. Wybierz **Jestem w ciąży → Kontynuuj bez logowania → Dwoje rodziców**.

| Pytanie | Dane testowe |
| --- | --- |
| Przewidywany termin porodu i liczba dzieci | Data około 8 tygodni od dziś, 1 dziecko |
| Zaświadczenie „Za życiem” i sytuacja mamy | „Nie” oraz „Nie dotyczy” |
| Zatrudnienie obojga | Umowa o pracę. Ubezpieczenie Anny od 01.03.2022, Piotra od 01.06.2021. Dla obojga wybierz opcję umowy bezterminowej przy dacie końca umowy. |
| Liczba osób zgłoszonych przez płatników | Pracodawca Anny 80, pracodawca Piotra 15 |
| Dodatkowe pytania o Annę | 30 lat. Przy pytaniu o rozwiązanie umowy wybierz „Nie”. Przy pytaniu o zwolnienie w tej ciąży również wybierz „Nie”. |
| Urlop i kwoty | Oboje planują skorzystać. Wybierz „Podstawę ustalimy później”. W polach wynagrodzenia brutto i wynagrodzenia z umowy wpisz po 7 000 zł dla Anny i po 8 500 zł dla Piotra. |
| Drugi tytuł i wariant zasiłku | „Nie, mam tylko jeden tytuł do ubezpieczenia” oraz „Jeszcze nie wiemy – pokażcie porównanie” |

Kliknij **Zapisz odpowiedzi → Przejdź do planu → Kalkulator**. Podstawy z podanych kwot brutto powinny wynieść **6 040,30 zł** dla Anny i **7 334,65 zł** dla Piotra. Sprawdź oba warianty kalkulatora oraz okresy obojga rodziców w zakładce **Plan urlopów**.

## Co jest w repozytorium

- [`zus-przewodnik-starter/`](zus-przewodnik-starter/) zawiera aplikację React/Vite, REST API Express i współdzielony silnik TypeScript.
- [`zus-przewodnik-starter/data/`](zus-przewodnik-starter/data/) zawiera dane spraw i fikcyjne profile używane w aplikacji.
- [`docs/`](docs/) zawiera [raport integracji](docs/FIX_ALL_REPORT.md) i [matrycę spraw testowych](docs/test-cases.md).
- [`modules/`](modules/) i [`data/sample-cases/`](data/sample-cases/) zachowują znaczniki pierwotnego podziału pracy zespołu. Uruchamiany kod i dane są w `zus-przewodnik-starter/`.
