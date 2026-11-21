import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useSearchParams } from 'react-router-dom';
import { expect, it } from 'vitest';
import { GuidePage } from '../GuidePage';

function WizardDestination() {
  const [params] = useSearchParams();
  return <p>Wybrana ścieżka: {params.get('situation')}</p>;
}

function renderGuide(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/guide/:slug?" element={<GuidePage />} />
        <Route path="/wizard" element={<WizardDestination />} />
      </Routes>
    </MemoryRouter>,
  );
}

it('prowadzi z listy tematów przez artykuł do ścieżki adopcji w kreatorze', async () => {
  renderGuide('/guide');
  const user = userEvent.setup();
  await user.click(screen.getByRole('link', { name: 'Adopcja i niezawodowa piecza zastępcza' }));
  expect(
    screen.getByRole('heading', { level: 1, name: 'Adopcja i niezawodowa piecza zastępcza' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Gov.pl · Urlop adopcyjny' })).toHaveAttribute(
    'href',
    'https://www.gov.pl/web/rodzina/urlop-adopcyjny',
  );
  await user.click(screen.getByRole('link', { name: 'Policz dla siebie' }));
  expect(screen.getByText('Wybrana ścieżka: adoption')).toBeInTheDocument();
});

it('po wejściu na nieznany adres pozwala wrócić do tematów', () => {
  renderGuide('/guide/nieznany-temat');
  expect(screen.getByRole('heading', { name: 'Nie znaleziono tematu' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Wszystkie tematy' })).toHaveAttribute('href', '/guide');
});
