import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  render(<CasePdfUpload />);
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
