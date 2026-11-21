import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { calculateCasePlan } from '@shared/engine/casePlan';
import params from '@shared/params.json';
import type { CaseInputs, CaseRecord } from '@shared/types';
import data from '../../../../../data/cases/case-04.json';
import { ScenarioProvider } from '../../../app/ScenarioContext';
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
    expect(await screen.findByText('19.10.2027')).toBeInTheDocument();
    const link = tabLink('Wnioski');
    expect(new URL((link as HTMLAnchorElement).href).searchParams.get('inputs')).toContain(
      '2027-11-09',
    );
    fireEvent.click(link);
    expect(await screen.findByText(/DANE PRZYKŁADOWE/)).toBeInTheDocument();
    expect(screen.getByLabelText('PESEL')).toHaveValue('00000000000');
    const selected = screen.getByLabelText('Wzór wniosku');
    const father = within(selected).getByRole('option', {
      name: /Ojciec.*rodzicielskiego.*09.11.2027/,
    });
    fireEvent.change(selected, { target: { value: (father as HTMLOptionElement).value } });
    expect(screen.getByText(/09.11.2027–10.01.2028/)).toBeInTheDocument();
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

  it('edytuje wzór w pamięci zakładki i symuluje wysyłkę bez żądania API', async () => {
    openPlan('applications');
    const pesel = await screen.findByLabelText('PESEL');
    fireEvent.change(pesel, { target: { value: '11111111111' } });
    const count = api.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Symuluj złożenie wniosku' }));
    expect(screen.getByRole('status')).toHaveTextContent('Zakończono symulację');
    expect(api.mock.calls).toHaveLength(count);
    expect(window.location.search).not.toContain('11111111111');
    fireEvent.click(tabLink('Plan urlopów'));
    fireEvent.click(tabLink('Wnioski'));
    expect(await screen.findByLabelText('PESEL')).toHaveValue('00000000000');
  });
});
