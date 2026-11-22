import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { apiPost } from '../../../api/client';

import { CasePdfUpload } from '../CasePdfUpload';
import { readCasePdf } from '../readCasePdf';

vi.mock('../readCasePdf', () => ({ MAX_PDF_BYTES: 12 * 1024 * 1024, readCasePdf: vi.fn() }));
vi.mock('../../../api/client', () => ({ apiPost: vi.fn() }));

it('wymaga potwierdzenia i wysyła tylko poprawione pola do kalkulatora', async () => {
  vi.mocked(readCasePdf).mockResolvedValue(
    'Data porodu: 1.11.2026\nLiczba dzieci: 1\nPodstawa wymiaru zasiłku: 6500,00 zł',
  );
  vi.mocked(apiPost).mockResolvedValue({
    outcome: {
      decision_summary_pl: 'Przyznano świadczenie.',
      calculated_amount_pln: null,
      benefit_base_pln: 6200,
      granted_duration_days: 140,
    },
    validation_errors: [],
  });
  const user = userEvent.setup();
  render(<MemoryRouter><CasePdfUpload /></MemoryRouter>);
  expect(screen.getByText(/Dane z oficjalnych formularzy ZUS/)).toBeInTheDocument();
  await user.upload(
    screen.getByLabelText(/Plik PDF/),
    new File(['%PDF-'], 'wniosek.pdf', { type: 'application/pdf' }),
  );
  await user.selectOptions(await screen.findByLabelText('Sytuacja'), 'POST_BIRTH');
  await user.selectOptions(screen.getByLabelText('Wnioskodawca'), 'MOTHER');
  await user.selectOptions(screen.getByLabelText('Tytuł ubezpieczenia'), 'UOP');
  expect(screen.getByLabelText('Data porodu')).toHaveValue('2026-11-01');
  const base = screen.getByLabelText('Podstawa wymiaru w zł');
  expect(base).toHaveValue(6500);
  const submit = screen.getByRole('button', { name: 'Przelicz potwierdzone dane' });
  expect(submit).toBeDisabled();
  await user.click(screen.getByRole('checkbox', { name: /Potwierdzam/ }));
  await user.clear(base);
  await user.type(base, '6200');
  expect(submit).toBeDisabled();
  expect(apiPost).not.toHaveBeenCalled();
  await user.click(screen.getByRole('checkbox', { name: /Potwierdzam/ }));
  await user.click(submit);
  expect(await screen.findByText('Przyznano świadczenie.')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Wynik kalkulatora' })).toHaveFocus();
  const href = screen.getByRole('link', { name: 'Otwórz plan' }).getAttribute('href')!;
  const plan = new URL(href, 'http://localhost');
  expect(plan.pathname).toBe('/plan/calculator');
  expect(JSON.parse(plan.searchParams.get('inputs')!)).toEqual(vi.mocked(apiPost).mock.calls[0][1]);
  expect(apiPost).toHaveBeenCalledOnce();
  expect(apiPost).toHaveBeenCalledWith(
    '/plan',
    expect.objectContaining({
      due_or_birth_date: '2026-11-01',
      benefit_base_amount_pln: 6200,
      children_count: 1,
    }),
  );
  expect(JSON.stringify(vi.mocked(apiPost).mock.calls)).not.toContain('wniosek.pdf');
});
