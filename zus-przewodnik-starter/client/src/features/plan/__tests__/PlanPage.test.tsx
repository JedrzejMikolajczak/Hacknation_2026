import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { calculateCasePlan } from '@shared/engine/casePlan';
import params from '@shared/params.json';
import type { CaseInputs, CaseRecord } from '@shared/types';
import data from '../../../../../data/cases/case-04.json';
import { ScenarioProvider, type ScenarioDraft } from '../../../app/ScenarioContext';
import { PlanPage } from '../PlanPage';

const fixture = data as CaseRecord;
const api = vi.fn(async (url: string, request?: RequestInit) => {
  const result = url.endsWith('/params')
    ? params
    : url.endsWith('/case-04')
      ? fixture
      : calculateCasePlan(JSON.parse(String(request?.body)) as CaseInputs, params);
  return new Response(JSON.stringify({ data: result, error: null }), { status: 200 });
});
const tabs = [
  'Uprawnienia',
  'Kalkulator',
  'Plan urlopów',
  'Dokumenty i terminy',
  'Wnioski',
  'Wsparcie',
];

function openPlan(tab = 'entitlements', input?: CaseInputs) {
  const search = input
    ? new URLSearchParams({ inputs: JSON.stringify(input) }).toString()
    : 'case=case-04';
  render(
    <MemoryRouter initialEntries={[`/plan/${tab}?${search}`]}>
      <ScenarioProvider>
        <Routes>
          <Route path="/plan/:tab" element={<PlanPage />} />
        </Routes>
      </ScenarioProvider>
    </MemoryRouter>,
  );
}

function tabLink(title: string) {
  return within(screen.getByRole('navigation', { name: 'Zakładki Twojego planu' })).getByRole(
    'link',
    { name: title },
  );
}

describe('Twój plan', () => {
  beforeEach(() => {
    api.mockClear();
    vi.stubGlobal('fetch', api);
  });

  it('udostępnia wszystkie zakładki i pobiera kontrakt sprawy z API', async () => {
    openPlan();
    for (const title of tabs) {
      fireEvent.click(tabLink(title));
      expect(await screen.findByRole('heading', { name: title, level: 2 })).toBeInTheDocument();
    }
    expect(api.mock.calls.some(([url]) => url === '/api/v1/cases/case-04')).toBe(true);
    const input = api.mock.calls.find(([url]) => url === '/api/v1/plan')?.[1];
    expect(JSON.parse(String(input?.body))).toMatchObject({
      applicant_role: 'MOTHER',
      stage: 'POST_BIRTH',
      pregnancy_week_at_birth: '28+5',
    });
  });

  it('wyświetla odrębną podstawę i płatnika drugiego tytułu w kalkulatorze', async () => {
    openPlan('calculator', {
      ...fixture.inputs,
      additional_insurance_titles: [{
        employment_type: 'ZLECENIE',
        payer_insured_count_nov_30: '<= 20',
        benefit_base_amount_pln: 3000,
        sickness_insured: true,
        voluntary_sickness_insured: true,
      }],
    });

    const heading = await screen.findByRole('heading', { name: /Dodatkowy tytuł 1.*Umowa zlecenie/ });
    const result = heading.closest('section')!;
    expect(result).toHaveTextContent(/podstawa\s+3\s?000,00\s*zł/);
    expect(result).toHaveTextContent('wypłaca ZUS');
    expect(within(result).getByText('Dokumenty z tego tytułu')).toBeInTheDocument();
  });

  it('synchronizuje zmianę daty ojca z dokumentami i wnioskiem', async () => {
    openPlan('leave-plan');
    const manualSummary = await screen.findByText('Ułóż ręcznie / połącz z pracą');
    const manualDetails = manualSummary.closest('details') as HTMLDetailsElement;
    expect(manualDetails.open).toBe(false);
    fireEvent.click(manualSummary);
    fireEvent.change(await screen.findByLabelText('Koniec części 2'), {
      target: { value: '2028-01-10' },
    });
    fireEvent.change(await screen.findByLabelText('Początek części 2'), {
      target: { value: '2027-11-09' },
    });
    fireEvent.click(tabLink('Dokumenty i terminy'));
    expect((await screen.findAllByText('19.10.2027')).length).toBeGreaterThan(0);
    const link = tabLink('Wnioski');
    expect(new URL((link as HTMLAnchorElement).href).searchParams.get('inputs')).toContain(
      '2027-11-09',
    );
    fireEvent.click(link);
    expect(
      await screen.findByText(/uzupełnisz po zalogowaniu przez mObywatela \(symulacja\)/),
    ).toBeInTheDocument();
    expect(screen.getAllByLabelText('PESEL').every((field) => (field as HTMLInputElement).value === '')).toBe(true);
    expect(screen.getAllByText(/09\.11\.2027–10\.01\.2028/).length).toBeGreaterThan(0);
  });

  it('pokazuje podsumowanie, oś czasu obu rodziców i działające presety w Planie urlopów', async () => {
    openPlan('leave-plan');
    expect(
      await screen.findByRole('heading', { name: 'Plan urlopów w skrócie', level: 3 }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Oś czasu urlopów mamy')).toBeInTheDocument();
    expect(screen.getByLabelText('Oś czasu urlopów taty')).toBeInTheDocument();

    const calendarDetails = screen
      .getByText('Pokaż kalendarz dzień po dniu')
      .closest('details') as HTMLDetailsElement;
    expect(calendarDetails.open).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: /Po połowie/ }));
    expect(
      await screen.findByRole('button', { name: /Po połowie/, pressed: true }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dalej: Dokumenty i terminy ›' })).toBeInTheDocument();
  });

  it('edytuje dane osobowe w pamięci zakładki i symuluje wysyłkę bez żądania API', async () => {
    openPlan('applications');
    const mother = within(await screen.findByRole('group', { name: 'Matka' }));
    const nameInput = mother.getByLabelText('Imię i nazwisko');
    const peselInput = mother.getByLabelText('PESEL');
    const bankInput = mother.getByLabelText('Numer rachunku');
    expect(nameInput).toHaveValue('');
    expect(peselInput).toHaveValue('');
    expect(bankInput).toHaveValue('');

    fireEvent.change(nameInput, { target: { value: 'Maria Testowa' } });
    fireEvent.change(peselInput, { target: { value: '11111111111' } });
    fireEvent.change(bankInput, { target: { value: '12345678901234567890123456' } });

    const count = api.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: /^Wyślij Wniosek o urlop macierzyński i rodzicielski.*Matka/ }));
    expect(screen.getByRole('status')).toHaveTextContent('Zakończono symulację');
    expect(api.mock.calls).toHaveLength(count);
    expect(window.location.search).not.toContain('11111111111');

    fireEvent.click(tabLink('Plan urlopów'));
    fireEvent.click(tabLink('Wnioski'));
    expect(within(await screen.findByRole('group', { name: 'Matka' })).getByLabelText('PESEL')).toHaveValue('');
  });

  it('w zakładce Wnioski dla planu dwojga rodziców (UoP) pokazuje spójne wnioski z realnymi datami i bez duplikatów', async () => {
    const twoParentScenario: ScenarioDraft = {
      situation: 'afterBirth',
      referenceDate: '2026-11-21',
      birthDate: '2026-11-10',
      expectedBirthDate: null,
      childrenCount: 1,
      childAcceptanceDate: null,
      childAgeYears: null,
      adoptionType: null,
      rateVariant: 'combined',
      mother: {
        role: 'mother',
        insuranceTitle: 'employment',
        sicknessInsurance: 'mandatory',
        insuredSince: '2020-01-01',
        insuranceEndDate: null,
        benefitBase: 6903.2,
        contributionDebt: null,
        employerInsuredCount: 150,
        age: 31,
        wantsLeave: true,
      },
      father: {
        role: 'father',
        insuranceTitle: 'employment',
        sicknessInsurance: 'mandatory',
        insuredSince: '2019-01-01',
        insuranceEndDate: null,
        benefitBase: 5000,
        contributionDebt: null,
        employerInsuredCount: 10,
        wantsLeave: true,
      },
      special: {
        zaZyciemCertificate: false,
        motherHospitalized: false,
        motherIncapableOfIndependentLiving: false,
        motherDeceased: false,
      },
    };

    render(
      <MemoryRouter initialEntries={['/plan/applications?situation=afterBirth']}>
        <ScenarioProvider initialScenario={twoParentScenario}>
          <Routes>
            <Route path="/plan/:tab" element={<PlanPage />} />
          </Routes>
        </ScenarioProvider>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', { name: 'Lista wniosków (5)', level: 3 }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Wniosek do USC o wydanie odpisu aktu urodzenia')).toHaveLength(1);
    expect(screen.getAllByText(/10\.11\.2026–29\.03\.2027/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/28\.11\.2026–11\.12\.2026/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/09\.11\.2027–10\.01\.2028/).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/Wzór zgodny z rozporządzeniem MRPiPS 2025 poz\. 322 – do weryfikacji/)
        .length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Dalej: Wsparcie ›' })).toHaveAttribute(
      'href',
      '/plan/support?situation=afterBirth',
    );
  });

  it('pokazuje w zakładce Wsparcie sytuacje szczególne planu, organizacje charytatywne i asystenta AI', async () => {
    openPlan('support');
    expect(await screen.findByRole('heading', { name: 'Wsparcie', level: 2 })).toBeInTheDocument();
    expect(screen.getByText('Najważniejsze dla Ciebie')).toBeInTheDocument();
    expect(
      screen.getByText('Wcześniak lub hospitalizacja dziecka po porodzie'),
    ).toBeInTheDocument();
    expect(screen.getByText('Fundacja Wcześniak Rodzice-Rodzicom')).toBeInTheDocument();
    expect(screen.getByText('Wspierane przez AI')).toBeInTheDocument();
    expect(screen.getByText(/Asystent AI – zapytaj o swoją sytuację/)).toBeInTheDocument();
  });

  it('wyświetla hub planu z kolejnością kroków, bez zduplikowanych linków w nagłówku', () => {
    render(
      <MemoryRouter initialEntries={['/plan']}>
        <ScenarioProvider initialScenario={{ situation: null }}>
          <Routes>
            <Route path="/plan" element={<PlanPage />} />
            <Route path="/plan/:tab" element={<PlanPage />} />
          </Routes>
        </ScenarioProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText(/Od czego zacząć\?/)).toBeInTheDocument();
    expect(screen.getByText('Zacznij tutaj')).toBeInTheDocument();
    const header = screen.getByRole('banner');
    expect(within(header).getByRole('link', { name: 'Zmień odpowiedzi' })).toBeInTheDocument();
    expect(within(header).queryByRole('link', { name: 'Przewodnik' })).not.toBeInTheDocument();
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getByRole('link', { name: 'Przewodnik' })).toBeInTheDocument();
    expect(within(footer).getByRole('link', { name: 'Przykładowe sprawy' })).toBeInTheDocument();
  });

  it('pokazuje jednoliniowe podsumowanie danych formularza, zwinięte kontrolki i breadcrumb', async () => {
    const formScenario: ScenarioDraft = {
      situation: 'afterBirth',
      referenceDate: '2026-11-21',
      birthDate: '2026-11-10',
      expectedBirthDate: null,
      childrenCount: 1,
      childAcceptanceDate: null,
      childAgeYears: null,
      adoptionType: null,
      rateVariant: 'combined',
      mother: {
        role: 'mother',
        insuranceTitle: 'employment',
        sicknessInsurance: 'mandatory',
        insuredSince: '2020-01-01',
        insuranceEndDate: null,
        benefitBase: 6903.2,
        contributionDebt: null,
        employerInsuredCount: 150,
        age: 31,
        wantsLeave: true,
      },
      father: {
        role: 'father',
        insuranceTitle: 'employment',
        sicknessInsurance: 'mandatory',
        insuredSince: '2019-01-01',
        insuranceEndDate: null,
        benefitBase: 5000,
        contributionDebt: null,
        employerInsuredCount: 10,
        wantsLeave: true,
      },
      special: {
        zaZyciemCertificate: false,
        motherHospitalized: false,
        motherIncapableOfIndependentLiving: false,
        motherDeceased: false,
      },
    };

    render(
      <MemoryRouter initialEntries={['/plan/calculator?situation=afterBirth']}>
        <ScenarioProvider initialScenario={formScenario}>
          <Routes>
            <Route path="/plan" element={<PlanPage />} />
            <Route path="/plan/:tab" element={<PlanPage />} />
          </Routes>
        </ScenarioProvider>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', { name: 'Kalkulator', level: 2 }),
    ).toBeInTheDocument();
    const breadcrumb = screen.getByRole('navigation', { name: 'Ścieżka nawigacji' });
    expect(within(breadcrumb).getByRole('link', { name: '← Twój plan' })).toBeInTheDocument();
    expect(within(breadcrumb).getByText('Kalkulator')).toBeInTheDocument();

    const controls = screen.getByRole('region', { name: 'Twoje dane planu' });
    expect(controls).toHaveTextContent(
      /Twoje dane:\s*Urodziło się dziecko · umowa o pracę · 1 dziecko · 81,5%/,
    );
    expect(within(controls).queryByLabelText('Sytuacja')).not.toBeInTheDocument();

    expect(
      await screen.findByText(/Otrzymasz ok\..*miesięcznie przez.*52 tygodnie/),
    ).toBeInTheDocument();

    fireEvent.click(within(controls).getByRole('button', { name: 'Zmień dane' }));
    const childrenSelect = within(controls).getByLabelText('Liczba dzieci');
    fireEvent.change(childrenSelect, { target: { value: '2' } });
    expect(controls).toHaveTextContent(/2 dzieci/);

    expect(
      await screen.findByText(/Otrzymasz ok\..*miesięcznie przez.*65 tygodni/),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dalej: Plan urlopów ›' })).toBeInTheDocument();
  });

  it('pokazuje stan braku danych bez zmyślonych kwot, gdy formularz jest pusty', () => {
    render(
      <MemoryRouter initialEntries={['/plan/calculator']}>
        <ScenarioProvider initialScenario={{ situation: null }}>
          <Routes>
            <Route path="/plan/:tab" element={<PlanPage />} />
          </Routes>
        </ScenarioProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText(/Nie przyjmujemy zmyślonych założeń/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Uzupełnij dane ›' })).toHaveAttribute(
      'href',
      '/wizard',
    );
  });

  it('pokazuje odpowiedź najpierw w Uprawnieniach oraz grupuje okresy według rodzica w Kalkulatorze', async () => {
    openPlan('entitlements');
    expect(
      await screen.findByRole('heading', { name: 'Uprawnienia', level: 2 }),
    ).toBeInTheDocument();

    const controls = screen.getByRole('region', { name: 'Twoje dane planu' });
    expect(controls).toHaveTextContent(fixture.short_title);
    expect(screen.getByText(/Przysługuje zasiłek macierzyński/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dalej: Kalkulator ›' })).toBeInTheDocument();

    fireEvent.click(tabLink('Kalkulator'));
    expect(
      await screen.findByRole('heading', { name: 'Kalkulator', level: 2 }),
    ).toBeInTheDocument();

    const periodsSummary = screen.getByText('Zobacz okresy i kwoty');
    const periodsDetails = periodsSummary.closest('details');
    expect(periodsDetails).not.toBeNull();
    expect(periodsDetails).not.toHaveAttribute('open');
    fireEvent.click(periodsSummary);

    expect(screen.getByRole('region', { name: 'Okresy: Mama' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Okresy: Tata' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dalej: Plan urlopów ›' })).toBeInTheDocument();
  });

  it('w zakładce Dokumenty poprawnie wskazuje zleceniodawcę (> 20) bez Z-3a oraz ścieżkę ciążową bez daty L4', async () => {
    const mandateScenario: ScenarioDraft = {
      situation: 'pregnant',
      referenceDate: '2026-11-21',
      birthDate: null,
      expectedBirthDate: '2027-04-10',
      childrenCount: 1,
      childAcceptanceDate: null,
      childAgeYears: null,
      adoptionType: null,
      rateVariant: 'combined',
      mother: {
        role: 'mother',
        insuranceTitle: 'mandateContract',
        sicknessInsurance: 'voluntary',
        insuredSince: '2022-01-01',
        insuranceEndDate: null,
        benefitBase: 5500,
        contributionDebt: null,
        employerInsuredCount: 45,
        age: 30,
        wantsLeave: true,
      },
      father: null,
      special: {
        zaZyciemCertificate: false,
        motherHospitalized: false,
        motherIncapableOfIndependentLiving: false,
        motherDeceased: false,
      },
    };

    render(
      <MemoryRouter initialEntries={['/plan/documents?situation=pregnant']}>
        <ScenarioProvider initialScenario={mandateScenario}>
          <Routes>
            <Route path="/plan/:tab" element={<PlanPage />} />
          </Routes>
        </ScenarioProvider>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', { name: 'Dokumenty i terminy', level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/U zleceniodawcy \(> 20 ubezpieczonych – wypłaca zleceniodawca\)/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Zwolnienie lekarskie w ciąży \(e-ZLA, kod „B”\)/)).toBeInTheDocument();
    expect(screen.queryByText(/Z-3a –/)).not.toBeInTheDocument();
    expect(screen.queryByText(/ZAS-12 –/)).not.toBeInTheDocument();
  });

  it('pokazuje ryzyka z danych formularza (ubezpieczenie 2 mies. przed porodem) w zakładkach Uprawnienia i Wsparcie', async () => {
    const riskyFormScenario: ScenarioDraft = {
      situation: 'pregnant',
      referenceDate: '2026-11-21',
      birthDate: null,
      expectedBirthDate: '2027-01-21',
      childrenCount: 1,
      childAcceptanceDate: null,
      childAgeYears: null,
      adoptionType: null,
      rateVariant: 'combined',
      mother: {
        role: 'mother',
        insuranceTitle: 'employment',
        sicknessInsurance: 'mandatory',
        insuredSince: '2026-11-21',
        insuranceEndDate: null,
        benefitBase: 6000,
        contributionDebt: null,
        employerInsuredCount: 50,
        age: 30,
        wantsLeave: true,
      },
      father: null,
      special: {
        zaZyciemCertificate: false,
        motherHospitalized: false,
        motherIncapableOfIndependentLiving: false,
        motherDeceased: false,
      },
    };

    render(
      <MemoryRouter initialEntries={['/plan/entitlements?situation=pregnant']}>
        <ScenarioProvider initialScenario={riskyFormScenario}>
          <Routes>
            <Route path="/plan" element={<PlanPage />} />
            <Route path="/plan/:tab" element={<PlanPage />} />
          </Routes>
        </ScenarioProvider>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', { name: 'Uprawnienia', level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByText('Możliwa kontrola tytułu ubezpieczenia')).toBeInTheDocument();
    expect(screen.getByText('Okres wyczekiwania na zasiłek chorobowy')).toBeInTheDocument();

    fireEvent.click(tabLink('Wsparcie'));
    expect(await screen.findByRole('heading', { name: 'Wsparcie', level: 2 })).toBeInTheDocument();
    expect(
      screen.getByText('Możliwa weryfikacja tytułu ubezpieczenia przez ZUS'),
    ).toBeInTheDocument();
    expect(screen.getByText('Okres wyczekiwania na zasiłek chorobowy')).toBeInTheDocument();
  });

  it('dla umowy na czas określony przedłużanej do porodu pokazuje w Uprawnieniach i Wsparciu informację o przedłużeniu zamiast alarmu', async () => {
    const fixedTermScenario: ScenarioDraft = {
      situation: 'pregnant',
      referenceDate: '2026-11-21',
      birthDate: null,
      expectedBirthDate: '2027-02-01',
      childrenCount: 1,
      childAcceptanceDate: null,
      childAgeYears: null,
      adoptionType: null,
      rateVariant: 'standard',
      mother: {
        role: 'mother',
        insuranceTitle: 'employment',
        sicknessInsurance: 'mandatory',
        insuredSince: '2022-01-01',
        insuranceEndDate: '2026-12-31',
        benefitBase: 6000,
        contributionDebt: null,
        employerInsuredCount: 50,
        age: 30,
        wantsLeave: true,
      },
      father: null,
      special: {
        zaZyciemCertificate: false,
        motherHospitalized: false,
        motherIncapableOfIndependentLiving: false,
        motherDeceased: false,
      },
    };

    render(
      <MemoryRouter initialEntries={['/plan/entitlements?situation=pregnant']}>
        <ScenarioProvider initialScenario={fixedTermScenario}>
          <Routes>
            <Route path="/plan" element={<PlanPage />} />
            <Route path="/plan/:tab" element={<PlanPage />} />
          </Routes>
        </ScenarioProvider>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', { name: 'Uprawnienia', level: 2 }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Koniec umowy przed porodem')).not.toBeInTheDocument();
    expect(screen.getByText(/przedłuża się z mocy prawa do dnia porodu/)).toBeInTheDocument();

    fireEvent.click(tabLink('Wsparcie'));
    expect(await screen.findByRole('heading', { name: 'Wsparcie', level: 2 })).toBeInTheDocument();
    expect(
      screen.queryByText('Umowa lub ubezpieczenie kończy się przed zdarzeniem'),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText(/przedłuża się z mocy prawa do dnia porodu/).length).toBeGreaterThan(
      0,
    );
  });
});
