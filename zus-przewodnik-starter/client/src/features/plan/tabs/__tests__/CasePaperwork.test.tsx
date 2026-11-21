import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { CaseDocument } from '@shared/types';
import { ScenarioProvider } from '../../../../app/ScenarioContext';
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

  it('dla umowy zlecenia > 20 wskazuje zleceniodawcę jako płatnika i miejsce złożenia ZAM (bez Z-3a)', () => {
    const mandateOver20Docs: CaseDocument[] = [
      {
        id: 'ZAM',
        name_pl: 'ZAM – wniosek o zasiłek macierzyński (do płatnika składek – zleceniodawcy)',
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
        id: 'BIRTH_CERTIFICATE',
        name_pl: 'Skrócony odpis aktu urodzenia dziecka',
        parent_role: 'MOTHER',
        submit_to: 'EMPLOYER',
        leave_type: null,
        start_date: null,
        end_date: null,
        deadline: null,
        is_overdue: false,
        legal_basis: 'Ustawa zasiłkowa, art. 29–29a i 61',
      },
    ];

    renderWithRouter(<CaseDocuments documents={mandateOver20Docs} effectiveDate="2026-10-24" />);

    expect(
      screen.getByText(/U zleceniodawcy \(> 20 ubezpieczonych – wypłaca zleceniodawca\)/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Bezpośrednio w ZUS/)).not.toBeInTheDocument();
    expect(screen.getAllByText('Zleceniodawca').length).toBeGreaterThan(0);
    expect(screen.getByText(/u zleceniodawcy\./)).toBeInTheDocument();
  });

  it('dla umowy zlecenia ≤ 20 pokazuje złożenie w ZUS i przekazanie Z-3a przez zleceniodawcę', () => {
    const mandateSmallDocs: CaseDocument[] = [
      {
        id: 'ZAM',
        name_pl: 'ZAM – wniosek o zasiłek macierzyński',
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
        id: 'Z-3a',
        name_pl: 'Z-3a – zaświadczenie płatnika składek przekazywane przez zleceniodawcę',
        parent_role: 'MOTHER',
        submit_to: 'ZUS',
        leave_type: null,
        start_date: null,
        end_date: null,
        deadline: null,
        is_overdue: false,
        legal_basis: 'Ustawa zasiłkowa, art. 29–29a i 61',
      },
    ];

    renderWithRouter(<CaseDocuments documents={mandateSmallDocs} effectiveDate="2026-10-24" />);

    expect(
      screen.getByText(
        /W ZUS \(PUE\/eZUS\) – zleceniodawca przekazuje Z-3a do ZUS \(wypłaca ZUS\)/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Z-3a – zaświadczenie płatnika składek przekazywane przez zleceniodawcę'),
    ).toBeInTheDocument();
  });

  it('dla martwego urodzenia wyświetla odrębny dokument ze spokojnym, empatycznym opisem bez wykrzykników', () => {
    const stillbirthDocs: CaseDocument[] = [
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
        id: 'STILLBIRTH_CERTIFICATE',
        name_pl:
          'Skrócony odpis aktu urodzenia z adnotacją o martwym urodzeniu lub zaświadczenie o martwym urodzeniu',
        parent_role: 'MOTHER',
        submit_to: 'EMPLOYER',
        leave_type: null,
        start_date: null,
        end_date: null,
        deadline: null,
        is_overdue: false,
        legal_basis: 'Kodeks pracy, art. 180 i 180¹',
      },
    ];

    const { container } = renderWithRouter(
      <CaseDocuments documents={stillbirthDocs} effectiveDate="2026-10-24" />,
    );

    expect(
      screen.getByText(
        'Skrócony odpis aktu urodzenia z adnotacją o martwym urodzeniu lub zaświadczenie o martwym urodzeniu',
      ),
    ).toBeInTheDocument();
    expect(container.textContent).not.toContain('!');
    expect(container.textContent).not.toMatch(/gratulacj/i);
  });

  it('w ciąży bez daty zwolnienia oraz przy wcześniejszym macierzyńskim pokazuje właściwe dokumenty', () => {
    const pregnancyAndEarlyDocs: CaseDocument[] = [
      {
        id: 'e-ZLA',
        name_pl: 'e-ZLA (kod „B”) – elektroniczne zaświadczenie lekarskie w ciąży',
        parent_role: 'MOTHER',
        submit_to: 'ZUS',
        leave_type: null,
        start_date: null,
        end_date: null,
        deadline: null,
        is_overdue: false,
        legal_basis: 'Ustawa zasiłkowa, art. 4, 8 i 11',
      },
      {
        id: 'ZAS-53',
        name_pl: 'ZAS-53 – wniosek o zasiłek chorobowy',
        parent_role: 'MOTHER',
        submit_to: 'ZUS',
        leave_type: null,
        start_date: null,
        end_date: null,
        deadline: null,
        is_overdue: false,
        legal_basis: 'Ustawa zasiłkowa, art. 4, 8 i 11',
      },
      {
        id: 'EXPECTED_BIRTH_CERTIFICATE',
        name_pl: 'Zaświadczenie lekarskie o przewidywanej dacie porodu',
        parent_role: 'MOTHER',
        submit_to: 'ZUS',
        leave_type: null,
        start_date: null,
        end_date: null,
        deadline: null,
        is_overdue: false,
        legal_basis: 'Kodeks pracy, art. 180 i 180¹',
      },
    ];

    renderWithRouter(
      <CaseDocuments documents={pregnancyAndEarlyDocs} effectiveDate="2026-10-24" />,
    );

    expect(screen.getByText(/Bezpośrednio w ZUS/)).toBeInTheDocument();
    expect(screen.getByText('ZAS-53 – wniosek o zasiłek chorobowy')).toBeInTheDocument();
    expect(
      screen.getByText('Zaświadczenie lekarskie o przewidywanej dacie porodu'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/maksymalnie 6 tygodni przed przewidywaną datą porodu/),
    ).toBeInTheDocument();
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
    expect(screen.getByLabelText('Imię i nazwisko')).toHaveValue('');
    expect(screen.getByLabelText('PESEL')).toHaveValue('');
    expect(screen.getByLabelText('Numer rachunku')).toHaveValue('');

    // Walidacja przy pustych polach
    fireEvent.click(screen.getByRole('button', { name: /Wyślij wszystkie/ }));
    expect(screen.getByRole('alert')).toHaveTextContent(/uzupełnij dane osobowe/);

    // Uzupełnienie i symulowana wysyłka wszystkich
    fireEvent.change(screen.getByLabelText('Imię i nazwisko'), {
      target: { value: 'Janina Nowak' },
    });
    fireEvent.change(screen.getByLabelText('PESEL'), { target: { value: '90010112345' } });
    fireEvent.change(screen.getByLabelText('Numer rachunku'), {
      target: { value: '12345678901234567890123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Wyślij wszystkie/ }));
    expect(screen.getByRole('status')).toHaveTextContent(/Zakończono symulację wysyłki pakietu/);
    expect(screen.getByRole('button', { name: 'Wszystkie wnioski wysłane' })).toBeDisabled();

    // Podstawa z Rozporządzenia 2025 poz. 322 i link dalej
    expect(screen.getAllByText(/Dz\.U\. z 2025 r\. poz\. 322/).length).toBeGreaterThan(0);
    const nextLink = screen.getByRole('link', { name: 'Dalej: Wsparcie ›' });
    expect(nextLink).toHaveAttribute('href', '/plan/support?case=case-04');
  });
});
