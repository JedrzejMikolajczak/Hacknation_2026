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
    expect(screen.getByLabelText('PESEL')).toHaveValue('');
    expect(screen.getAllByText(/09\.11\.2027–10\.01\.2028/).length).toBeGreaterThan(0);
  });

  it('edytuje dane osobowe w pamięci zakładki i symuluje wysyłkę bez żądania API', async () => {
    openPlan('applications');
    const nameInput = await screen.findByLabelText('Imię i nazwisko');
    const peselInput = screen.getByLabelText('PESEL');
    const bankInput = screen.getByLabelText('Numer rachunku');
    expect(nameInput).toHaveValue('');
    expect(peselInput).toHaveValue('');
    expect(bankInput).toHaveValue('');

    fireEvent.change(nameInput, { target: { value: 'Maria Testowa' } });
    fireEvent.change(peselInput, { target: { value: '11111111111' } });
    fireEvent.change(bankInput, { target: { value: '12345678901234567890123456' } });

    const count = api.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: /Wyślij wszystkie/ }));
    expect(screen.getByRole('status')).toHaveTextContent('Zakończono symulację');
    expect(api.mock.calls).toHaveLength(count);
    expect(window.location.search).not.toContain('11111111111');

    fireEvent.click(tabLink('Plan urlopów'));
    fireEvent.click(tabLink('Wnioski'));
    expect(await screen.findByLabelText('PESEL')).toHaveValue('');
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
});
