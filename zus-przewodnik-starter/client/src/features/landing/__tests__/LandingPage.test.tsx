import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ScenarioProvider } from '../../../app/ScenarioContext';
import { LandingPage } from '../LandingPage';

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderLanding(initialEntry = '/') {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ScenarioProvider>
        <Routes>
          <Route
            path="/"
            element={
              <>
                <LandingPage />
                <LocationDisplay />
              </>
            }
          />
          <Route path="*" element={<LocationDisplay />} />
        </Routes>
      </ScenarioProvider>
    </MemoryRouter>,
  );
  return { user };
}

const location = () => screen.getByTestId('location').textContent;

describe('LandingPage', () => {
  it('renders 4 situation tiles with correct labels', () => {
    renderLanding();
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(4);
    expect(radios.map((radio) => radio.textContent)).toEqual([
      expect.stringContaining('Planuję dziecko'),
      expect.stringContaining('Jestem w ciąży'),
      expect.stringContaining('Urodziło się dziecko'),
      expect.stringContaining('Adopcja lub rodzina zastępcza'),
    ]);
    expect(screen.getByRole('radio', { name: 'Jestem w ciąży' })).toBeInTheDocument();
    expect(
      screen.getByRole('radiogroup', { name: 'W jakiej jesteś sytuacji?' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('clicking a tile checks it and writes ?situation= to the URL', async () => {
    const { user } = renderLanding();
    const tile = screen.getByRole('radio', { name: 'Urodziło się dziecko' });
    await user.click(tile);
    expect(tile).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Planuję dziecko' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(location()).toBe('/?situation=afterBirth');
  });

  it('"Kontynuuj bez logowania" without a selection shows a message and does not navigate', async () => {
    const { user } = renderLanding();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Kontynuuj bez logowania' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Wybierz swoją sytuację, aby przejść dalej',
    );
    expect(location()).toBe('/');

    await user.click(screen.getByRole('radio', { name: 'Planuję dziecko' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('with "pregnant" selected navigates to /wizard?situation=pregnant', async () => {
    const { user } = renderLanding();
    await user.click(screen.getByRole('radio', { name: 'Jestem w ciąży' }));
    await user.click(screen.getByRole('button', { name: 'Kontynuuj bez logowania' }));
    expect(location()).toBe('/wizard?situation=pregnant');
  });

  it('with "pregnant" selected the mObywatel button navigates to /login?situation=pregnant', async () => {
    const { user } = renderLanding();
    await user.click(screen.getByRole('radio', { name: 'Jestem w ciąży' }));
    await user.click(screen.getByRole('button', { name: 'Zaloguj się przez mObywatela' }));
    expect(location()).toBe('/login?situation=pregnant');
  });

  it('entering /?situation=adoption checks the adoption tile', () => {
    renderLanding('/?situation=adoption');
    expect(screen.getByRole('radio', { name: 'Adopcja lub rodzina zastępcza' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('an invalid ?situation= value selects nothing and does not crash', () => {
    renderLanding('/?situation=unknown');
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toHaveAttribute('aria-checked', 'false');
    }
  });

  it('supports keyboard: arrows move the selection, roving tabindex', async () => {
    const { user } = renderLanding();
    await user.tab();
    const first = screen.getByRole('radio', { name: 'Planuję dziecko' });
    expect(first).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    const second = screen.getByRole('radio', { name: 'Jestem w ciąży' });
    expect(second).toHaveFocus();
    expect(second).toHaveAttribute('aria-checked', 'true');
    expect(second).toHaveAttribute('tabindex', '0');
    expect(first).toHaveAttribute('tabindex', '-1');

    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(screen.getByRole('radio', { name: 'Adopcja lub rodzina zastępcza' })).toHaveFocus();
    expect(location()).toBe('/?situation=adoption');
  });

  it('external links open in a new tab safely', () => {
    renderLanding();
    const zus = screen.getByRole('link', { name: /zus\.pl/ });
    expect(zus).toHaveAttribute('href', 'https://www.zus.pl');
    expect(zus).toHaveAttribute('target', '_blank');
    expect(zus).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('link', { name: 'Przewodnik' })).toHaveAttribute('href', '/guide');
    expect(screen.getByRole('link', { name: 'Przykładowe sprawy' })).toHaveAttribute(
      'href',
      '/cases',
    );
  });
});
