import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { CaseDocument } from '@shared/types';
import { ScenarioProvider } from '../../../../app/ScenarioContext';
import { LoginPage } from '../../../login/LoginPage';
import { CaseApplications, CaseDocuments } from '../CasePaperwork';

function renderWithRouter(ui: React.ReactElement, initialEntry = '/plan/documents?case=case-04') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ScenarioProvider>{ui}</ScenarioProvider>
    </MemoryRouter>,
  );
}

const sampleDocuments: CaseDocument[] = [
  {
    id: 'e-ZLA',
    name_pl: 'Elektroniczne zaświadczenie lekarskie',
    parent_role: 'MOTHER',
    submit_to: 'ZUS',
    leave_type: 'SICKNESS',
    start_date: '2026-06-01',
    end_date: '2026-10-31',
    deadline: null,
    is_overdue: false,
    legal_basis: 'Ustawa zasiłkowa, art. 4, 8 i 11',
  },
  {
    id: 'ZAS-12',
    name_pl: 'ZAS-12 – wniosek o zasiłek za dalszy okres',
    parent_role: 'MOTHER',
    submit_to: 'ZUS',
    leave_type: 'SICKNESS',
    start_date: '2026-06-01',
    end_date: '2026-10-31',
    deadline: null,
    is_overdue: false,
    legal_basis: 'Ustawa zasiłkowa, art. 4, 8 i 11',
  },
  {
    id: 'ZAM',
    name_pl: 'ZAM – wniosek o zasiłek macierzyński',
    parent_role: 'MOTHER',
    submit_to: 'EMPLOYER',
    leave_type: null,
    start_date: null,
    end_date: null,
    deadline: null,
    is_overdue: false,
    legal_basis: 'Ustawa zasiłkowa, art. 29–29a i 61',
  },
  {
    id: 'Z-3',
    name_pl: 'Z-3 – zaświadczenie płatnika składek przekazywane przez pracodawcę',
    parent_role: 'MOTHER',
    submit_to: 'ZUS',
    leave_type: null,
    start_date: null,
    end_date: null,
    deadline: null,
    is_overdue: false,
    legal_basis: 'Ustawa zasiłkowa, art. 29–29a i 61',
  },
  {
    id: 'COMBINED_RATE',
    name_pl: 'Wniosek o stawkę 81,5%',
    parent_role: 'MOTHER',
    submit_to: 'EMPLOYER',
    leave_type: 'MATERNITY',
    start_date: '2026-11-01',
    end_date: '2027-03-20',
    deadline: '2026-11-22',
    is_overdue: true,
    legal_basis: 'Ustawa zasiłkowa, art. 30a i 31',
  },
  {
    id: 'HOSPITAL_CERTIFICATE',
    name_pl:
      'Zaświadczenie ze szpitala o okresie hospitalizacji, tygodniu ciąży i masie urodzeniowej',
    parent_role: 'MOTHER',
    submit_to: 'EMPLOYER',
    leave_type: null,
    start_date: null,
    end_date: null,
    deadline: null,
    is_overdue: false,
    legal_basis: 'Kodeks pracy, art. 180²',
  },
  {
    id: 'ZA_ZYCIEM_CERTIFICATE',
    name_pl: 'Zaświadczenie „Za życiem”',
    parent_role: 'MOTHER',
    submit_to: 'EMPLOYER',
    leave_type: null,
    start_date: null,
    end_date: null,
    deadline: null,
    is_overdue: false,
    legal_basis: 'Kodeks pracy, art. 182¹ᵃ § 2 i ustawa „Za życiem”, art. 4 ust. 3',
  },
  {
    id: 'PARENTAL_REQUEST',
    name_pl: 'Wniosek o okres rodzicielskiego',
    parent_role: 'FATHER',
    submit_to: 'EMPLOYER',
    leave_type: 'PARENTAL',
    start_date: '2027-06-01',
    end_date: '2027-08-02',
    deadline: '2027-05-11',
    is_overdue: false,
    legal_basis: 'Kodeks pracy, art. 182¹ᵃ–182¹ᵈ',
  },
  {
    id: 'USC_COPY',
    name_pl: 'Wniosek do USC o wydanie odpisu aktu urodzenia',
    parent_role: 'MOTHER',
    submit_to: 'USC',
    leave_type: null,
    start_date: null,
    end_date: null,
    deadline: null,
    is_overdue: false,
    legal_basis: 'Prawo o aktach stanu cywilnego',
  },
];

describe('CaseDocuments', () => {
  it('pokazuje blok „Co zrobić teraz”, płatnika per rodzic, postęp i link Dalej: Wnioski', () => {
    renderWithRouter(<CaseDocuments documents={sampleDocuments} effectiveDate="2026-10-24" />);

    expect(
      screen.getByRole('heading', { name: 'Dokumenty i terminy', level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Co zrobić teraz', level: 3 })).toBeInTheDocument();
    expect(screen.getByText(/Następny krok: złóż „Wniosek o stawkę 81,5%”/)).toBeInTheDocument();
    expect(screen.getAllByText(/Termin minął/).length).toBeGreaterThan(0);

    // Płatnik per rodzic
    expect(screen.getByText('Matka składa dokumenty')).toBeInTheDocument();
    expect(screen.getByText('Ojciec składa dokumenty')).toBeInTheDocument();
    expect(screen.getByText(/pracodawca przekazuje Z-3 do ZUS/)).toBeInTheDocument();
    expect(screen.getByText(/U pracodawcy \(> 20 ubezpieczonych/)).toBeInTheDocument();

    // Checklista z postępem i odhaczaniem
    expect(screen.getByText('Skompletowano: 0 z 9 (0%)')).toBeInTheDocument();
    const firstCheckbox = screen.getAllByRole('checkbox')[0];
    fireEvent.click(firstCheckbox);
    expect(screen.getByText('Skompletowano: 1 z 9 (11%)')).toBeInTheDocument();

    // Formularze po 24.10.2026 i ścieżka ciążowa
    expect(screen.getByText(/Zmiany w formularzach ZUS \(od 24\.10\.2026\)/)).toBeInTheDocument();
    expect(screen.getByText(/Zwolnienie lekarskie w ciąży \(e-ZLA, kod „B”\)/)).toBeInTheDocument();

    // Link dalej
    const nextLink = screen.getByRole('link', { name: 'Dalej: Wnioski ›' });
    expect(nextLink).toHaveAttribute('href', '/plan/applications?case=case-04');
  });

  it('pokazuje czytelny stan pusty z CTA do kreatora, gdy brak dokumentów', () => {
    renderWithRouter(<CaseDocuments documents={[]} effectiveDate="2026-10-24" />);

    expect(screen.getByText('Brak dokumentów do złożenia')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Uzupełnij dane ›' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dalej: Wnioski ›' })).toBeInTheDocument();
  });
});

describe('CaseApplications', () => {
  it('renderuje kompaktowe karty, puste pola osobowe bez wymyślonych danych i waliduje przed wysyłką', () => {
    renderWithRouter(
      <CaseApplications documents={sampleDocuments} />,
      '/plan/applications?case=case-04',
    );

    expect(screen.getByRole('heading', { name: 'Wnioski', level: 2 })).toBeInTheDocument();
    expect(
      screen.getByText(/uzupełnisz po zalogowaniu przez mObywatela \(symulacja\)/),
    ).toBeInTheDocument();

    // Brak wymyślonych danych osobowych
    expect(screen.queryByText(/Anna Przykładowa/i)).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('00000000000')).not.toBeInTheDocument();
    const mother = within(screen.getByRole('group', { name: 'Matka' }));
    const father = within(screen.getByRole('group', { name: 'Ojciec' }));
    expect(mother.getByLabelText('Imię i nazwisko')).toHaveValue('');
    expect(father.getByLabelText('Imię i nazwisko')).toHaveValue('');
    expect(mother.getByLabelText('PESEL')).toHaveValue('');
    expect(mother.getByLabelText('Numer rachunku')).toHaveValue('');
    expect(father.queryByLabelText('PESEL')).not.toBeInTheDocument();

    // Walidacja przy pustych polach
    fireEvent.click(screen.getByRole('button', { name: /Wyślij wszystkie/ }));
    expect(screen.getByRole('alert')).toHaveTextContent(/uzupełnij dane osobowe/i);

    // Uzupełnienie i symulowana wysyłka wszystkich
    fireEvent.change(mother.getByLabelText('Imię i nazwisko'), {
      target: { value: 'Janina Nowak' },
    });
    fireEvent.change(mother.getByLabelText('PESEL'), { target: { value: '90010112345' } });
    fireEvent.change(mother.getByLabelText('Numer rachunku'), {
      target: { value: '12345678901234567890123456' },
    });
    fireEvent.change(father.getByLabelText('Imię i nazwisko'), { target: { value: 'Jan Nowak' } });
    fireEvent.click(screen.getByRole('button', { name: /Wyślij wszystkie/ }));
    expect(screen.getByRole('alert')).toHaveTextContent(/dotychczas wykorzystanego urlopu/);
    fireEvent.change(screen.getByLabelText(/Okres dotychczas/), { target: { value: 'Nie korzystałem' } });
    fireEvent.change(screen.getByLabelText(/Liczba wykorzystanych/), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText(/Oświadczenie pracownika o urlopie/), {
      target: { value: 'Drugi rodzic nie korzysta w tym okresie.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Wyślij wszystkie/ }));
    expect(screen.getByRole('status')).toHaveTextContent(/Zakończono symulację wysyłki pakietu/);
    expect(screen.getByRole('button', { name: 'Wszystkie wnioski wysłane' })).toBeDisabled();

    // Podstawa z Rozporządzenia 2025 poz. 322 i link dalej
    expect(screen.getAllByText(/Dz\.U\. z 2025 r\. poz\. 322/).length).toBeGreaterThan(0);
    const nextLink = screen.getByRole('link', { name: 'Dalej: Wsparcie ›' });
    expect(nextLink).toHaveAttribute('href', '/plan/support?case=case-04');
  });

  it('przenosi dane testowe mObywatela tylko do wybranego wnioskodawcy i drukuje załączniki', () => {
    render(
      <MemoryRouter initialEntries={['/plan/applications?case=case-04']}>
        <ScenarioProvider>
          <Routes>
            <Route path="/plan/applications" element={<CaseApplications documents={sampleDocuments} />} />
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </ScenarioProvider>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('link', { name: 'Pobierz dane z mObywatela (symulacja)' }));
    fireEvent.change(screen.getByLabelText('Wnioskodawca'), { target: { value: 'FATHER' } });
    fireEvent.change(screen.getByLabelText('Imię i nazwisko'), { target: { value: 'Jan Testowy' } });
    fireEvent.click(screen.getByRole('button', { name: 'Przekaż dane testowe' }));
    expect(within(screen.getByRole('group', { name: 'Ojciec' })).getByLabelText('Imię i nazwisko'))
      .toHaveValue('Jan Testowy');
    expect(within(screen.getByRole('group', { name: 'Matka' })).getByLabelText('Imię i nazwisko'))
      .toHaveValue('');
    const card = screen.getByRole('heading', { name: 'Wniosek o okres rodzicielskiego' }).closest('article')!;
    fireEvent.click(within(card).getByText('Podgląd wniosku'));
    fireEvent.click(within(card).getByRole('button', { name: 'Drukuj lub zapisz PDF' }));
    const preview = within(screen.getByRole('dialog'));
    expect(preview.getByText('Jan Testowy')).toBeInTheDocument();
    expect(preview.getByText(/Skrócony odpis aktu urodzenia/)).toBeInTheDocument();
    expect(preview.getByText(/§ 15 rozporządzenia/)).toBeInTheDocument();
  });
});
