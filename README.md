# Zasiłkowy Przewodnik Przyszłego Rodzica

> **Projekt realizowany w ramach hackathonu HackNation 2026 (wyzwanie Zakładu Ubezpieczeń Społecznych).**

**Zasiłkowy Przewodnik Przyszłego Rodzica** to interaktywna aplikacja webowa, która przeprowadza przyszłych i obecnych rodziców przez gąszcz przepisów ubezpieczeniowych. Narzędzie tłumaczy zawiłe zasady na konkretny plan działania: wylicza przysługujące świadczenia, pomaga zaplanować podział urlopów między rodziców, wskazuje płatnika zasiłku oraz kompletuje wymagane dokumenty.

---

## Kluczowe funkcjonalności

* **Ścieżki dopasowane do sytuacji życiowej** — osobne prowadzenie dla osób planujących ciążę, będących w ciąży, po porodzie oraz w przypadku adopcji (pieczy zastępczej), a także dedykowane wsparcie w sytuacjach trudnych (wcześniactwo, hospitalizacja dziecka, zaświadczenie *„Za życiem”*, poronienie lub urodzenie martwego dziecka).
* **Zintegrowany kalkulator zasiłkowy (reguły 2026)** — deterministyczny silnik wyliczający prawo do świadczenia oraz jego wysokość z uwzględnieniem tytułu ubezpieczenia (UoP, umowa zlecenie, JDG), okresów wyczekiwania (`30`/`90` dni), odliczenia `13,71%`, limitów podstawy JDG oraz wyboru między wariantem uśrednionym (`81,5%`) a standardowym (`100%` / `70%`).
* **Interaktywny kalendarz i oś czasu urlopów** — wizualne planowanie urlopu macierzyńskiego, uzupełniającego (dla wcześniaków), ojcowskiego oraz rodzicielskiego — z automatycznym pilnowaniem `14` tygodni obowiązkowych dla matki, `9` tygodni nieprzenoszalnych dla drugiego rodzica oraz wydłużenia urlopu przy łączeniu go z pracą na maksymalnie `1/2` etatu.
* **Centrum dokumentów i symulator eZUS / mObywatel** — automatyczna lista wymaganych druków (`ZAM`, `Z-3`, `Z-3a`, `ZAS-53`), wskazanie podmiotu wypłacającego (pracodawca zgłaszający powyżej `20` ubezpieczonych vs ZUS), obsługa przykładowych plików PDF oraz symulacja pobrania danych ubezpieczonego.
* **Ostrzeżenia przed pułapkami prawnymi** — alerty m.in. o terminie `21` dni od porodu na złożenie wniosku o `81,5%`, zaległościach składkowych w JDG powyżej `1%` minimalnego wynagrodzenia czy konieczności ponownego zgłoszenia się do dobrowolnego ubezpieczenia chorobowego (`ZUS ZUA`) po zakończeniu zasiłku macierzyńskiego.
* **Panel administracyjny parametrów** — możliwość aktualizacji stawek procentowych, limitów kwotowych i wymiarów urlopów bez ingerencji w kod źródłowy aplikacji.

---

## Architektura projektu

Repozytorium zostało podzielone na niezależne moduły funkcjonalne oraz warstwę dokumentacji i przypadków testowych:

```text
Hacknation_2026/
├── modules/
│   ├── 01-kalendarz/             # Wizualna oś czasu, podział urlopów i kluczowe terminy
│   ├── 02-formularz/             # Kreator danych użytkownika i walidacja sytuacji życiowej
│   ├── 03-kalkulator/            # Deterministyczny silnik reguł prawnych i wyliczeń ZUS
│   ├── 04-ui/                    # Interfejs użytkownika, komponenty, RWD i dostępność
│   └── 05-documents-profiles/    # Parser wniosków PDF, profile testowe, symulacja eZUS
├── data/
│   └── sample-cases/             # Przykładowe sprawy i dokumenty testowe ZUS
└── docs/
    └── test-cases.md             # Matryca weryfikacji wyników na bazie spraw konkursowych
```

## Uruchomienie wersji konkursowej

```bash
cd zus-przewodnik-starter
npm ci
npm run dev
```

Otwórz `http://localhost:5173/cases`. Katalog prowadzi do sześciu spraw i panelu „Twój plan”. [Instrukcja aplikacji](zus-przewodnik-starter/README.md) · [Raport integracji](docs/FIX_ALL_REPORT.md)
