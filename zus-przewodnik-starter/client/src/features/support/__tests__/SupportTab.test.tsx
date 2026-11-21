import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ScenarioInput } from '@shared/types';
import { DEFAULT_PARAMS } from '../../../app/benefitParams';
import { ScenarioProvider, type ScenarioDraft } from '../../../app/ScenarioContext';
import { buildDefaultSpecial, buildEmptyParent } from '../../plan/planScenario';
import { SupportTab } from '../../plan/tabs/SupportTab';
import { CHARITABLE_ORGANIZATIONS, OFFICIAL_LINKS } from '../supportData';

function makeScenario(overrides: Partial<ScenarioInput> = {}): ScenarioInput {
  return {
    situation: 'afterBirth',
    referenceDate: '2026-11-21',
    expectedBirthDate: null,
    birthDate: '2026-11-10',
    childrenCount: 1,
    adoptionType: null,
    childAcceptanceDate: null,
    childAgeYears: null,
    schoolObligationDeferred: false,
    rateVariant: 'combined',
    mother: buildEmptyParent('mother', {
      insuranceTitle: 'employment',
      sicknessInsurance: 'mandatory',
      insuredSince: '2020-01-01',
      benefitBase: 6903.2,
      employerInsuredCount: 150,
      age: 31,
      wantsLeave: true,
    }),
    father: buildEmptyParent('father', {
      insuranceTitle: 'employment',
      sicknessInsurance: 'mandatory',
      insuredSince: '2019-01-01',
      benefitBase: 5000,
      employerInsuredCount: 10,
      wantsLeave: true,
    }),
    special: buildDefaultSpecial(),
    ...overrides,
  };
}

function renderSupportTab(
  scenario: ScenarioInput,
  initialEntry = '/plan/support?situation=afterBirth',
  draft?: ScenarioDraft,
) {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ScenarioProvider initialScenario={draft}>
        <SupportTab scenario={scenario} params={DEFAULT_PARAMS} />
      </ScenarioProvider>
    </MemoryRouter>,
  );
  return { user };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SupportTab – integracja wsparcia z silnikiem i wymaganiami 3h/3i', () => {
  it('wyświetla ryzyka wynikające z silnika (JDG z zadłużeniem, okres wyczekiwania) i nie pokazuje etykiety AI', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

    const jdgScenario = makeScenario({
      situation: 'pregnant',
      birthDate: null,
      expectedBirthDate: '2027-02-15',
      rateVariant: 'standard',
      mother: buildEmptyParent('mother', {
        insuranceTitle: 'selfEmployed',
        sicknessInsurance: 'voluntary',
        insuredSince: '2026-11-01',
        benefitBase: 5000,
        contributionDebt: 300,
        wantsLeave: true,
      }),
      father: null,
    });

    renderSupportTab(jdgScenario, '/plan/support?situation=pregnant');

    const keySection = screen
      .getByRole('heading', { level: 2, name: 'Najważniejsze dla Ciebie' })
      .closest('section') as HTMLElement;

    expect(within(keySection).getByText(/Zadłużenie składkowe \(JDG\)/i)).toBeInTheDocument();
    expect(
      within(keySection).getByText(/Sprawdź saldo składek na PUE\/eZUS i spłać całość zaległości/i),
    ).toBeInTheDocument();

    // Brak nieprawdziwego oznaczenia AI
    expect(screen.queryByText(/Wspierane przez AI/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/asystent.*AI/i)).not.toBeInTheDocument();

    // Ogólna lista 4 ryzyk z pkt 3h jest zwinięta w <details>
    const generalDetails = screen
      .getByText(/Ogólne ryzyka utraty lub obniżenia zasiłku/i)
      .closest('details');
    expect(generalDetails).not.toHaveAttribute('open');
    expect(
      screen.getByText(/Umowa o pracę lub działalność zawarta dla pozoru/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Podwyższenie podstawy wymiaru składek w okresie ciąży/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Brak ubezpieczenia chorobowego w dniu porodu/i)).toBeInTheDocument();
  });

  it('wyświetla pasujące sytuacje szczególne na górze spokojnym tonem, a pozostałe w zwiniętym <details>', () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

    const lossScenario = makeScenario({
      special: buildDefaultSpecial({ stillbirth: true }),
    });

    renderSupportTab(lossScenario);

    const keySection = screen
      .getByRole('heading', { level: 2, name: 'Najważniejsze dla Ciebie' })
      .closest('section') as HTMLElement;

    expect(
      within(keySection).getByRole('heading', {
        level: 3,
        name: 'Martwe urodzenie lub zgon dziecka',
      }),
    ).toBeInTheDocument();
    expect(
      within(keySection).getByText(/8 tygodni urlopu i zasiłku macierzyńskiego/i),
    ).toBeInTheDocument();

    // Spokojny ton: brak wykrzykników i gratulacji w całej sekcji
    expect(keySection.textContent).not.toContain('!');
    expect(keySection.textContent).not.toMatch(/gratulacj/i);

    // Organizacje charytatywne: przy stracie dziecka otwarte i z fundacjami wsparcia po stracie na początku
    const orgsDetails = screen
      .getByText(/Organizacje charytatywne – bezpłatna pomoc/i)
      .closest('details') as HTMLElement;
    expect(orgsDetails).toHaveAttribute('open');
    const orgHeadings = within(orgsDetails)
      .getAllByRole('heading', { level: 3 })
      .map((el) => el.textContent);
    expect(orgHeadings[0]).toBe('Fundacja Nagle Sami');
    expect(orgHeadings[1]).toBe('Fundacja Ernest');

    // Pozostałe sytuacje szczególne w zwiniętym <details>
    const otherSpecialDetails = screen.getByText('Inne sytuacje szczególne').closest('details');
    expect(otherSpecialDetails).not.toHaveAttribute('open');
    expect(
      within(otherSpecialDetails as HTMLElement).getByText(/Zaświadczenie „Za życiem”/i),
    ).toBeInTheDocument();
  });

  it('pokazuje wyłącznie organizacje charytatywne oraz oficjalne linki wymagane w zadaniu', () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

    const prematureScenario = makeScenario({
      special: buildDefaultSpecial({ pregnancyWeekAtBirth: 30, hospitalizationDays: 21 }),
    });

    renderSupportTab(prematureScenario);

    // Wszystkie organizacje to fundacje charytatywne
    expect(CHARITABLE_ORGANIZATIONS.every((org) => org.legalForm.includes('Fundacja'))).toBe(true);

    // Dla wcześniaka Fundacja Wcześniak jest na początku
    const orgsDetails = screen
      .getByText(/Organizacje charytatywne – bezpłatna pomoc/i)
      .closest('details') as HTMLElement;
    const orgHeadings = within(orgsDetails)
      .getAllByRole('heading', { level: 3 })
      .map((el) => el.textContent);
    expect(orgHeadings[0]).toBe('Fundacja Wcześniak Rodzice-Rodzicom');

    // Wymagane przekierowania oficjalne
    const requiredHrefs = [
      'https://www.zus.pl',
      'https://www.gov.pl/web/rodzina/urlop-rodzicielski',
      'https://www.pip.gov.pl/dla-pracodawcow/porady-prawne/rodzicielstwo',
      'https://www.gov.pl/web/cyfryzacja/rejestr-stanu-cywilnego',
    ];
    for (const href of requiredHrefs) {
      expect(OFFICIAL_LINKS.some((link) => link.href === href)).toBe(true);
      expect(
        screen.getAllByRole('link').some((anchor) => anchor.getAttribute('href') === href),
      ).toBe(true);
    }
  });

  it('pokazuje wyraźny stan brakujących danych z przyciskiem Uzupełnij dane i bez zmyślonych ryzyk', () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

    const emptyScenario = makeScenario({
      birthDate: null,
      expectedBirthDate: null,
      mother: buildEmptyParent('mother'),
      father: null,
    });

    renderSupportTab(emptyScenario, '/plan/support?situation=afterBirth', { situation: null });

    const keySection = screen
      .getByRole('heading', { level: 2, name: 'Najważniejsze dla Ciebie' })
      .closest('section') as HTMLElement;

    expect(
      within(keySection).getByText(/uzupełnij brakujące dane w kreatorze/i),
    ).toBeInTheDocument();
    expect(within(keySection).getByText(/Data porodu/i)).toBeInTheDocument();
    expect(
      within(keySection).getByText(/Forma zatrudnienia \/ tytuł ubezpieczenia matki/i),
    ).toBeInTheDocument();

    const wizardCta = within(keySection).getByRole('link', { name: /Uzupełnij dane/i });
    expect(wizardCta).toHaveAttribute('href', '/wizard?situation=afterBirth');

    // Brak zmyślonych ostrzeżeń użytkownika
    expect(screen.queryByLabelText(/Wykryte ryzyka dla Twoich danych/i)).not.toBeInTheDocument();
  });

  it('umożliwia symulację podglądu konta PUE/eZUS, wysłania pytania POG, wniosku USC i Najczęstszych pytań', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

    const scenario = makeScenario();
    const { user } = renderSupportTab(scenario);

    // 1. PUE/eZUS: podgląd konta i wysłanie pytania
    await user.click(screen.getByText(/Kontakt z ZUS i podgląd konta/i));
    await user.click(
      screen.getByRole('button', { name: /Sprawdź dane na koncie \(symulacja PUE \/ eZUS\)/i }),
    );
    const accountRegion = screen.getByRole('region', {
      name: /Symulacja podglądu konta PUE\/eZUS/i,
    });
    expect(within(accountRegion).getByText(/Umowa o pracę/i)).toBeInTheDocument();
    expect(within(accountRegion).getByText(/150 osób/i)).toBeInTheDocument();

    await user.type(
      screen.getByLabelText(/Treść pytania do doradcy ZUS/i),
      'Proszę o potwierdzenie terminu złożenia wniosku ZAM.',
    );
    await user.click(screen.getByRole('button', { name: /Wyślij pytanie do PUE \/ eZUS/i }));
    expect(screen.getByText(/Zapytanie zostało wysłane/i)).toBeInTheDocument();

    // 2. Symulacja wniosku o odpis aktu urodzenia (USC)
    await user.click(screen.getByText(/Oficjalne strony urzędowe i wniosek o odpis/i));
    await user.selectOptions(screen.getByLabelText(/Rodzaj odpisu aktu stanu cywilnego/i), 'full');
    await user.click(screen.getByRole('button', { name: /Złóż wniosek o odpis/i }));
    expect(screen.getByText(/Wniosek o odpis zupełny został złożony/i)).toBeInTheDocument();

    // 3. Najczęstsze pytania (bez AI)
    await user.click(screen.getByText('Najczęstsze pytania'));
    await user.click(screen.getByRole('button', { name: /Kiedy opłaca się wariant 81,5%/i }));
    expect(screen.getByText(/ujednoliconą stawkę 81,5%/i)).toBeInTheDocument();
  });

  it('pobiera ostrzeżenia z API /eligibility, gdy serwer odpowiada', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            entitlements: [],
            warnings: [
              {
                code: 'SHAM_CONTRACT_RISK',
                message: 'Krótki okres ubezpieczenia przed porodem (odpowiedź API).',
                legalBasis: 'KC art. 83',
              },
            ],
          },
          error: null,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    renderSupportTab(makeScenario());

    await waitFor(() => {
      expect(
        screen.getByText(/Możliwa kontrola tytułu ubezpieczenia przez ZUS/i),
      ).toBeInTheDocument();
    });
  });
});
