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

function openPlan(tab = 'entitlements') {
  render(
    <MemoryRouter initialEntries={[`/plan/${tab}?case=case-04`]}>
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
    fireEvent.click(screen.getByRole('button', { name: /^Wyślij ZAM.*Matka/ }));
    expect(screen.getByRole('status')).toHaveTextContent('Zakończono symulację');
    expect(api.mock.calls).toHaveLength(count);
    expect(window.location.search).not.toContain('11111111111');

    fireEvent.click(tabLink('Plan urlopów'));
    fireEvent.click(tabLink('Wnioski'));
    expect(within(await screen.findByRole('group', { name: 'Matka' })).getByLabelText('PESEL')).toHaveValue('');
  });

  it('pokazuje w zakładce Wsparcie sytuacje szczególne planu, organizacje charytatywne i uczciwe FAQ', async () => {
    openPlan('support');
    expect(await screen.findByRole('heading', { name: 'Wsparcie', level: 2 })).toBeInTheDocument();
    expect(screen.getByText('Najważniejsze dla Ciebie')).toBeInTheDocument();
    expect(
      screen.getByText('Wcześniak lub hospitalizacja dziecka po porodzie'),
    ).toBeInTheDocument();
    expect(screen.getByText('Fundacja Wcześniak Rodzice-Rodzicom')).toBeInTheDocument();
    expect(screen.getByText('Najczęstsze pytania')).toBeInTheDocument();
    expect(screen.queryByText(/Wspierane przez AI/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/asystent AI/i)).not.toBeInTheDocument();
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
});
