import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetSessionAdminParams } from '../adminApi';
import { AdminPage } from '../AdminPage';

const TEST_ADMIN_TOKEN = 'test-admin-token-0123456789abcdef0123';

function renderAdmin() {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </MemoryRouter>,
  );
  return { user };
}

afterEach(() => {
  resetSessionAdminParams();
  vi.restoreAllMocks();
});

describe('AdminPage', () => {
  it('renders heading, derived metrics, tabs and loads default parameters', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

    renderAdmin();

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Konfiguracja parametrów ustawowych ZUS',
      }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByLabelText('Płaca minimalna (zł brutto)')).toHaveValue(4806);
    });

    expect(screen.getByText('4147,10 zł')).toBeInTheDocument();
    expect(screen.getByText('48,06 zł')).toBeInTheDocument();
  });

  it('shows Before -> After diff when editing parameters and requires admin token to save', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

    const { user } = renderAdmin();

    await waitFor(() => {
      expect(screen.getByLabelText('Płaca minimalna (zł brutto)')).toBeInTheDocument();
    });

    const minWageInput = screen.getByLabelText('Płaca minimalna (zł brutto)');
    await user.clear(minWageInput);
    await user.type(minWageInput, '5000');

    expect(screen.getByText(/Liczba zmienionych parametrów do zapisania: 1/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Lista zmienionych parametrów')).toHaveTextContent(
      /Płaca minimalna: 4806 zł → 5000 zł/i,
    );

    // Próba zapisu bez tokenu pokazuje czytelny błąd.
    await user.click(screen.getByRole('button', { name: 'Zapisz parametry w systemie' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/Podaj klucz dostępu administratora/i);

    // Token wpisuje administrator – nie ma go w kodzie aplikacji.
    await user.type(
      screen.getByLabelText('Klucz dostępu administratora (token)'),
      TEST_ADMIN_TOKEN,
    );
    await user.click(screen.getByRole('button', { name: 'Zapisz parametry w systemie' }));

    await waitFor(() => {
      expect(
        screen.getByText(/Zapisano nowe parametry w sesji demonstracyjnej/i),
      ).toBeInTheDocument();
    });
  });

  it('switches between parameter categories and restores 2026 statutory defaults', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

    const { user } = renderAdmin();

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /2\. Długości urlopów/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('tab', { name: /2\. Długości urlopów/i }));
    const parentalInput = screen.getByLabelText('Urlop rodzicielski – 1 dziecko (tygodnie)');
    expect(parentalInput).toHaveValue(41);

    await user.clear(parentalInput);
    await user.type(parentalInput, '45');
    expect(screen.getByText(/Liczba zmienionych parametrów do zapisania: 1/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Przywróć oficjalne przepisy 2026' }));
    expect(parentalInput).toHaveValue(41);
    expect(screen.getByText(/Brak niezapisanych zmian/i)).toBeInTheDocument();
  });

  it('calls PUT /api/v1/admin/params with Bearer token when backend is online', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      if (init?.method === 'PUT') {
        const body = JSON.parse(String(init.body));
        return new Response(JSON.stringify({ data: body, error: null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(
        JSON.stringify({
          data: (await import('@shared/params.json')).default,
          error: null,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    const { user } = renderAdmin();

    await waitFor(() => {
      expect(screen.getByLabelText('Płaca minimalna (zł brutto)')).toBeInTheDocument();
    });

    await user.type(
      screen.getByLabelText('Klucz dostępu administratora (token)'),
      TEST_ADMIN_TOKEN,
    );
    await user.click(screen.getByRole('button', { name: 'Zapisz parametry w systemie' }));

    await waitFor(() => {
      expect(
        screen.getByText('Zapisano nowe parametry ustawowe na serwerze ZUS.'),
      ).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/admin/params',
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({ Authorization: `Bearer ${TEST_ADMIN_TOKEN}` }),
      }),
    );
  });
});
