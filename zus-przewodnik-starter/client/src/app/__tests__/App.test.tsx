import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from '../App';
import { ScenarioProvider } from '../ScenarioContext';

function renderApp(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <ScenarioProvider>
        <App />
      </ScenarioProvider>
    </MemoryRouter>,
  );
  return userEvent.setup();
}

describe('nawigacja aplikacji', () => {
  it('pozwala pominąć nagłówek pierwszym Tabem i przenosi fokus do treści', async () => {
    const user = renderApp('/');
    const skip = screen.getByRole('link', { name: 'Przejdź do treści' });

    await user.tab();
    expect(skip).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('main')).toHaveFocus();
  });

  it('pokazuje stronę 404 z powrotem do strony startowej', async () => {
    const user = renderApp('/xyz');
    expect(screen.getByRole('heading', { name: 'Nie znaleziono strony' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Wróć na stronę startową' }));
    expect(screen.queryByRole('heading', { name: 'Nie znaleziono strony' })).not.toBeInTheDocument();
  });
});
