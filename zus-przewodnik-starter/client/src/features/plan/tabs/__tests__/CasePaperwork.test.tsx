import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { calculateCasePlan } from '@shared/engine/casePlan';
import params from '@shared/params.json';
import type { BenefitParams, CaseDocument, CaseInputs, CaseRecord } from '@shared/types';
import case01 from '../../../../../../data/cases/case-01.json';
import case02 from '../../../../../../data/cases/case-02.json';
import case03 from '../../../../../../data/cases/case-03.json';
import case04 from '../../../../../../data/cases/case-04.json';
import case05 from '../../../../../../data/cases/case-05.json';
import case06 from '../../../../../../data/cases/case-06.json';
import jan from '../../../../../../data/profiles/jan.json';
import { ScenarioProvider, type ScenarioDraft } from '../../../../app/ScenarioContext';
import { wizardCase } from '../../caseScenario';
import { formatPolishDate } from '../../planScenario';
import { LoginPage } from '../../../login/LoginPage';
import { CaseApplications, CaseDocuments } from '../CasePaperwork';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

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

    // Mapa składania z postępem i odhaczaniem aktywnego kroku
    expect(screen.getByRole('heading', { name: 'Mapa składania dokumentów' })).toBeInTheDocument();
    const progress = () => document.querySelector('.fmap__progress')?.textContent ?? '';
    expect(progress()).toMatch(/Załatwione:\s*0\s*z\s*\d+/);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Mam to załatwione' }));
    expect(progress()).toMatch(/Załatwione:\s*1\s*z\s*\d+/);

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
    expect(screen.getAllByText(/Do zleceniodawcy/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/u zleceniodawcy\./).length).toBeGreaterThan(0);
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
      screen.getAllByText(
        'Skrócony odpis aktu urodzenia z adnotacją o martwym urodzeniu lub zaświadczenie o martwym urodzeniu',
      ).length,
    ).toBeGreaterThan(0);
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
    expect(screen.getAllByText('ZAS-53 – wniosek o zasiłek chorobowy').length).toBeGreaterThan(0);
    fireEvent.click(
      screen.getByRole('button', { name: /Zaświadczenie lekarskie o przewidywanej dacie porodu/ }),
    );
    expect(
      screen.getAllByText('Zaświadczenie lekarskie o przewidywanej dacie porodu').length,
    ).toBeGreaterThan(0);
    fireEvent.click(screen.getByText('Co to za dokument i podstawa prawna'));
    expect(
      screen.getByText(/maksymalnie 6 tygodni przed przewidywaną datą porodu/),
    ).toBeInTheDocument();
  });
});

describe('FilingMap (mapa składania)', () => {
  it('prowadzi za rękę: co, gdzie i kiedy, z linkiem do wniosku, e-mailem do kadr i PUE', () => {
    renderWithRouter(<CaseDocuments documents={sampleDocuments} effectiveDate="2026-10-24" />);

    // Kroki na osi, rozpoczęte od automatycznych i załączników
    const steps = screen
      .getAllByRole('listitem')
      .filter((li) => li.classList.contains('fmap__step'));
    expect(steps.length).toBe(sampleDocuments.length);

    // Wniosek do pracodawcy: link „Wypełnij i pobierz” z kluczem dokumentu + e-mail do kadr
    fireEvent.click(screen.getByRole('button', { name: /Wniosek o urlop rodzicielski/ }));
    const fill = screen.getByRole('link', { name: 'Wypełnij i pobierz wniosek ›' });
    expect(fill.getAttribute('href')).toMatch(
      /^\/plan\/applications\?case=case-04&open=FATHER-PARENTAL_REQUEST/,
    );
    const mail = screen.getByRole('link', { name: /Napisz e-mail do kadr/ });
    expect(mail.getAttribute('href')).toMatch(/^mailto:\?subject=/);

    // ZUS: link do PUE/eZUS
    fireEvent.click(screen.getByRole('button', { name: /ZAS-12/ }));
    expect(screen.getByText(/przesyła do ZUS Twój płatnik składek/)).toBeInTheDocument();

    // USC: link do gov.pl
    fireEvent.click(screen.getByRole('button', { name: /Wniosek do USC/ }));
    expect(screen.getByRole('link', { name: /Złóż wniosek na gov\.pl/ })).toHaveAttribute(
      'href',
      expect.stringContaining('gov.pl'),
    );
  });
});

describe('FilingMap – zapamiętywanie', () => {
  it('przywraca zaznaczenia „Mam to załatwione” po ponownym wejściu', () => {
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    });
    const first = renderWithRouter(
      <CaseDocuments documents={sampleDocuments} effectiveDate="2026-10-24" />,
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'Mam to załatwione' }));
    expect(document.querySelector('.fmap__progress')?.textContent).toMatch(/:\s*1\s*z/);
    first.unmount();

    const second = renderWithRouter(<CaseDocuments documents={sampleDocuments} effectiveDate="2026-10-24" />);
    expect(document.querySelector('.fmap__progress')?.textContent).toMatch(/:\s*1\s*z/);

    // inna sprawa ma własny, czysty stan
    second.unmount();
    renderWithRouter(<CaseDocuments documents={sampleDocuments} effectiveDate="2026-10-24" />, '/plan/documents?case=case-05');
    expect(document.querySelector('.fmap__progress')?.textContent).toMatch(/:\s*0\s*z/);
  });
});

describe('CaseApplications – wejście z mapy (?open=)', () => {
  it('pokazuje krótki formularz braków, waliduje i otwiera podgląd z informacją, gdzie wysłać', () => {
    renderWithRouter(
      <CaseApplications documents={sampleDocuments} />,
      '/plan/applications?case=case-04&open=MOTHER-USC_COPY--',
    );

    const panel = within(screen.getByRole('region', { name: /Wniosek do USC/ }));
    expect(panel.getByText(/Brakuje jeszcze 1 informacji/)).toBeInTheDocument();

    // Walidacja przy pustym imieniu
    fireEvent.click(panel.getByRole('button', { name: /Podgląd i pobierz PDF/ }));
    expect(screen.getByRole('alert')).toHaveTextContent(/Imię i nazwisko/);

    fireEvent.change(panel.getByLabelText('Imię i nazwisko'), {
      target: { value: 'Janina Nowak' },
    });
    fireEvent.click(panel.getByRole('button', { name: /Podgląd i pobierz PDF/ }));
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByText('Janina Nowak')).toBeInTheDocument();
    expect(dialog.getByRole('heading', { name: /Gdzie to wysłać/ })).toBeInTheDocument();
    expect(dialog.getByRole('link', { name: /Złóż wniosek na gov\.pl/ })).toBeInTheDocument();
  });

  it('nie chowa pól podczas wpisywania i przyjmuje numer rachunku zapisany ze spacjami', () => {
    const zusDocs: CaseDocument[] = [
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
        name_pl: 'Z-3a – zaświadczenie płatnika składek',
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
    renderWithRouter(
      <CaseApplications documents={zusDocs} />,
      '/plan/applications?case=case-04&open=MOTHER-ZAM--',
    );
    const panel = within(document.getElementById('apps-open') as HTMLElement);

    // Wpisanie pierwszej litery nie usuwa pola z formularza
    fireEvent.change(panel.getByLabelText('Imię i nazwisko'), { target: { value: 'J' } });
    expect(panel.getByLabelText('Imię i nazwisko')).toHaveValue('J');
    fireEvent.change(panel.getByLabelText('Imię i nazwisko'), {
      target: { value: 'Janina Nowak' },
    });
    fireEvent.change(panel.getByLabelText('PESEL'), { target: { value: '90010112349' } });
    expect(panel.getByLabelText('PESEL')).toHaveValue('90010112349');
    const birth = panel.queryByLabelText('Data urodzenia');
    if (birth) fireEvent.change(birth, { target: { value: '1990-01-01' } });

    // Numer rachunku ze spacjami (26 cyfr) jest poprawny
    fireEvent.change(panel.getByLabelText('Numer rachunku'), {
      target: { value: '12 3456 7890 1234 5678 9012 3456' },
    });
    fireEvent.click(panel.getByRole('button', { name: /Podgląd i pobierz PDF/ }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('CaseApplications', () => {
  it('renderuje kompaktowe karty, puste pola osobowe i waliduje przed pobraniem', () => {
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

    const download = screen.getByRole('button', { name: /Pobierz PDF: Wniosek o urlop rodzicielski/ });
    fireEvent.click(download);
    expect(screen.getByRole('alert')).toHaveTextContent(/uzupełnij dane osobowe/i);

    fireEvent.change(father.getByLabelText('Imię i nazwisko'), { target: { value: 'Jan Nowak' } });
    fireEvent.click(download);
    expect(screen.getByRole('alert')).toHaveTextContent(/dotychczas wykorzystanego urlopu/);
    fireEvent.change(screen.getByLabelText(/Okres dotychczas/), {
      target: { value: 'Nie korzystałem' },
    });
    fireEvent.change(screen.getByLabelText(/Liczba wykorzystanych/), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText(/Oświadczenie pracownika o urlopie/), {
      target: { value: 'Drugi rodzic nie korzysta w tym okresie.' },
    });
    fireEvent.click(download);
    const preview = within(screen.getByRole('dialog'));
    expect(preview.getByText('Jan Nowak')).toBeInTheDocument();
    expect(preview.getByRole('button', { name: 'Pobierz wniosek do uzupełnienia (PDF)' })).toBeEnabled();
    expect(screen.queryByText(/UPO – Potwierdzenie/)).not.toBeInTheDocument();

    // Podstawa z Rozporządzenia 2025 poz. 322 i link dalej
    expect(screen.getAllByText(/Dz\.U\. z 2025 r\. poz\. 322/).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/Wzór zgodny z rozporządzeniem MRPiPS 2025 poz\. 322 – do weryfikacji/)
        .length,
    ).toBeGreaterThan(0);
    const nextLink = screen.getByRole('link', { name: 'Dalej: Wsparcie ›' });
    expect(nextLink).toHaveAttribute('href', '/plan/support?case=case-04');
  });

  it('przenosi dane testowe mObywatela tylko do wybranego wnioskodawcy i drukuje załączniki', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (url === '/api/v1/mock/profiles') {
        return Response.json({
          data: [{ profileId: jan.profileId, label: jan.label }],
          error: null,
        });
      }
      if (url === '/api/v1/mock/login') {
        return Response.json({ data: { profile: jan, sessionToken: 'test-token' }, error: null });
      }
      throw new Error(`Unexpected request: ${String(url)}`);
    });
    render(
      <MemoryRouter initialEntries={['/plan/applications?case=case-04']}>
        <ScenarioProvider>
          <Routes>
            <Route
              path="/plan/applications"
              element={
                <CaseApplications documents={sampleDocuments} input={case04.inputs as CaseInputs} />
              }
            />
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </ScenarioProvider>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('link', { name: 'Pobierz dane z mObywatela (symulacja)' }));
    await screen.findByRole('option', { name: jan.label });
    fireEvent.change(screen.getByLabelText('Wnioskodawca'), { target: { value: 'FATHER' } });
    fireEvent.click(screen.getByRole('button', { name: 'Przekaż dane testowe' }));
    const fatherFields = within(await screen.findByRole('group', { name: 'Ojciec' }));
    expect(fatherFields.getByLabelText('Imię i nazwisko')).toHaveValue(jan.label);
    expect(fatherFields.getByLabelText('PESEL')).toHaveValue(jan.pesel);
    expect(fatherFields.getByLabelText('Data urodzenia')).toHaveValue(jan.birthDate);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/mock/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ profile_id: jan.profileId }),
      }),
    );
    expect(
      within(screen.getByRole('group', { name: 'Matka' })).getByLabelText('Imię i nazwisko'),
    ).toHaveValue('');
    const card = screen
      .getByRole('heading', { name: /Wniosek o urlop rodzicielski/ })
      .closest('article')!;
    fireEvent.click(within(card).getByText('Podgląd wniosku'));
    fireEvent.click(within(card).getByRole('button', { name: 'Drukuj lub zapisz PDF' }));
    const preview = within(screen.getByRole('dialog'));
    expect(preview.getByText('Jan Testowy')).toBeInTheDocument();
    expect(preview.getByText(formatPolishDate(jan.birthDate))).toBeInTheDocument();
    expect(preview.getByText(/Skrócony odpis aktu urodzenia/)).toBeInTheDocument();
    expect(preview.getByText(/§ 15 rozporządzenia/)).toBeInTheDocument();
  });
  it('dla planu dwojga rodziców na UoP usuwa duplikaty USC/ZAM i przygotowuje PDF dla właściwego rodzica', () => {
    const draft: ScenarioDraft = {
      situation: 'afterBirth',
      referenceDate: '2026-11-21',
      birthDate: '2026-11-10',
      expectedBirthDate: null,
      childrenCount: 1,
      childAcceptanceDate: null,
      childAgeYears: null,
      adoptionType: null,
      rateVariant: 'combined',
      mother: {
        role: 'mother',
        insuranceTitle: 'employment',
        sicknessInsurance: 'mandatory',
        insuredSince: '2020-01-01',
        insuranceEndDate: null,
        benefitBase: 6903.2,
        contributionDebt: null,
        employerInsuredCount: 150,
        age: 31,
        wantsLeave: true,
      },
      father: {
        role: 'father',
        insuranceTitle: 'employment',
        sicknessInsurance: 'mandatory',
        insuredSince: '2019-01-01',
        insuranceEndDate: null,
        benefitBase: 5000,
        contributionDebt: null,
        employerInsuredCount: 10,
        age: null,
        wantsLeave: true,
      },
      special: {
        zaZyciemCertificate: false,
        motherHospitalized: false,
        motherIncapableOfIndependentLiving: false,
        motherDeceased: false,
      },
    };
    const input = wizardCase(draft, params as BenefitParams)!;
    const plan = calculateCasePlan(input, params as BenefitParams);

    renderWithRouter(
      <CaseApplications
        documents={plan.documents}
        input={input}
        plan={plan}
        params={params as BenefitParams}
      />,
      '/plan/applications?situation=afterBirth',
    );

    // 5 wniosków zamiast 8 (jeden wspólny USC, bez pustych dubli ZAM dla pracowników)
    expect(
      screen.getByRole('heading', { name: 'Lista wniosków (5)', level: 3 }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Wniosek do USC o wydanie odpisu aktu urodzenia')).toHaveLength(1);
    expect(screen.queryByText('ZUS ZAM')).not.toBeInTheDocument();

    // Realne daty, części i terminy obu rodziców
    expect(
      screen.getByRole('heading', {
        name: 'Wniosek o urlop macierzyński i rodzicielski (stawka 81,5%)',
        level: 4,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/10\.11\.2026–29\.03\.2027/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('01.12.2026').length).toBeGreaterThan(0);

    expect(
      screen.getByRole('heading', {
        name: 'Wniosek o urlop rodzicielski (część 1 z 2)',
        level: 4,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/30\.03\.2027–08\.11\.2027/).length).toBeGreaterThan(0);

    expect(
      screen.getByRole('heading', {
        name: 'Wniosek o urlop ojcowski',
        level: 4,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/28\.11\.2026–11\.12\.2026/).length).toBeGreaterThan(0);

    expect(
      screen.getByRole('heading', {
        name: 'Wniosek o urlop rodzicielski (część 2 z 2)',
        level: 4,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/09\.11\.2027–10\.01\.2028/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Pracodawca \(przekazuje Z-3 do ZUS\)/).length).toBeGreaterThan(0);

    // Podgląd zawiera dane wnioskodawcy wybranego wniosku.
    const mother = within(screen.getByRole('group', { name: 'Matka' }));
    const father = within(screen.getByRole('group', { name: 'Ojciec' }));
    fireEvent.change(mother.getByLabelText('Imię i nazwisko'), {
      target: { value: 'Anna Kowalska' },
    });
    fireEvent.change(mother.getByLabelText('PESEL'), { target: { value: '95050512346' } });
    fireEvent.click(
      screen.getByRole('button', {
        name: /Pobierz PDF: Wniosek o urlop macierzyński i rodzicielski/,
      }),
    );
    const motherPreview = within(screen.getByRole('dialog'));
    expect(motherPreview.getByText('Anna Kowalska')).toBeInTheDocument();
    fireEvent.click(motherPreview.getByRole('button', { name: 'Zamknij podgląd' }));

    const fatherDownload = screen.getByRole('button', { name: /Pobierz PDF: Wniosek o urlop ojcowski/ });
    fireEvent.change(screen.getByLabelText(/Oświadczenie ojca, czy korzystał/), {
      target: { value: 'Nie korzystałem.' },
    });
    fireEvent.click(fatherDownload);
    expect(screen.getByRole('alert')).toHaveTextContent('Ojciec');
    fireEvent.change(father.getByLabelText('Imię i nazwisko'), {
      target: { value: 'Jan Kowalski' },
    });
    fireEvent.click(fatherDownload);

    // Podgląd do druku zawiera notkę poz. 322
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Jan Kowalski')).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        /Wzór zgodny z rozporządzeniem MRPiPS 2025 poz\. 322 – do weryfikacji/,
      ),
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Zamknij podgląd' }));
  });

  it('dla pracownika w wariancie 100%+70% uwzględnia wniosek macierzyński, a w case-02 wykazuje łączenie z pracą 1/2 etatu', () => {
    const splitDraft: ScenarioDraft = {
      situation: 'afterBirth',
      referenceDate: '2026-11-21',
      birthDate: '2026-11-10',
      expectedBirthDate: null,
      childrenCount: 1,
      childAcceptanceDate: null,
      childAgeYears: null,
      adoptionType: null,
      rateVariant: 'standard',
      mother: {
        role: 'mother',
        insuranceTitle: 'employment',
        sicknessInsurance: 'mandatory',
        insuredSince: '2020-01-01',
        insuranceEndDate: null,
        benefitBase: 6000,
        contributionDebt: null,
        employerInsuredCount: 50,
        age: 30,
        wantsLeave: true,
      },
      father: null,
      special: {
        zaZyciemCertificate: false,
        motherHospitalized: false,
        motherIncapableOfIndependentLiving: false,
        motherDeceased: false,
      },
    };
    const splitInput = wizardCase(splitDraft, params as BenefitParams)!;
    const splitPlan = calculateCasePlan(splitInput, params as BenefitParams);

    const { unmount } = renderWithRouter(
      <CaseApplications
        documents={splitPlan.documents}
        input={splitInput}
        plan={splitPlan}
        params={params as BenefitParams}
      />,
      '/plan/applications?situation=afterBirth',
    );
    expect(
      screen.getByRole('heading', { name: 'Wniosek o urlop macierzyński', level: 4 }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/10\.11\.2026–29\.03\.2027/).length).toBeGreaterThan(0);
    expect(
      screen.getByRole('heading', { name: 'Wniosek o urlop rodzicielski (część 1)', level: 4 }),
    ).toBeInTheDocument();
    unmount();

    // Sprawa 02: łączenie urlopu rodzicielskiego z pracą na 1/2 etatu
    const record02 = case02 as CaseRecord;
    const input02: CaseInputs = { ...record02.inputs, reference_date: '2026-11-21' };
    const plan02 = calculateCasePlan(input02, params as BenefitParams);
    renderWithRouter(
      <CaseApplications
        documents={plan02.documents}
        input={input02}
        plan={plan02}
        params={params as BenefitParams}
      />,
      '/plan/applications?case=case-02',
    );

    expect(screen.getAllByText(/1\/2 etatu \(50%\)/).length).toBeGreaterThan(0);
    expect(screen.getByText(/14\.09\.2027–09\.10\.2028/)).toBeInTheDocument();
    expect(screen.getByText(/łącznie 112 tyg\./)).toBeInTheDocument();
  });

  it('dla umowy zlecenia i JDG generuje wnioski ZUS ZAM zamiast wniosków o urlop (KP)', () => {
    const mandateDraft: ScenarioDraft = {
      situation: 'afterBirth',
      referenceDate: '2026-11-21',
      birthDate: '2026-11-10',
      expectedBirthDate: null,
      childrenCount: 1,
      childAcceptanceDate: null,
      childAgeYears: null,
      adoptionType: null,
      rateVariant: 'combined',
      mother: {
        role: 'mother',
        insuranceTitle: 'mandateContract',
        sicknessInsurance: 'voluntary',
        insuredSince: '2020-01-01',
        insuranceEndDate: null,
        benefitBase: 5500,
        contributionDebt: null,
        employerInsuredCount: 10,
        age: 29,
        wantsLeave: true,
      },
      father: null,
      special: {
        zaZyciemCertificate: false,
        motherHospitalized: false,
        motherIncapableOfIndependentLiving: false,
        motherDeceased: false,
      },
    };
    const mandateInput = wizardCase(mandateDraft, params as BenefitParams)!;
    const mandatePlan = calculateCasePlan(mandateInput, params as BenefitParams);

    const { unmount } = renderWithRouter(
      <CaseApplications
        documents={mandatePlan.documents}
        input={mandateInput}
        plan={mandatePlan}
        params={params as BenefitParams}
      />,
      '/plan/applications?situation=afterBirth',
    );

    expect(screen.queryByText('WNIOSEK-KP')).not.toBeInTheDocument();
    expect(screen.getAllByText('ZUS ZAM').length).toBe(2);
    expect(
      screen.getByRole('heading', {
        name: 'ZAM – wniosek o zasiłek macierzyński (stawka 81,5%)',
        level: 4,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: 'ZAM – wniosek o zasiłek macierzyński za okres urlopu rodzicielskiego (część 1)',
        level: 4,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/przekazuje Z-3a/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/MRPiPS 2025 poz\. 322/)).not.toBeInTheDocument();
    unmount();

    // Zlecenie > 20 z adresatem EMPLOYER w dokumentach: nadal ZUS ZAM, adresat = zleceniodawca
    const mandateEmployerDocs: CaseDocument[] = [
      {
        id: 'COMBINED_RATE',
        name_pl: 'Wniosek o stawkę 81,5%',
        parent_role: 'MOTHER',
        submit_to: 'EMPLOYER',
        leave_type: 'MATERNITY',
        start_date: '2026-11-10',
        end_date: '2027-03-29',
        deadline: '2026-12-01',
        is_overdue: false,
        legal_basis: 'Ustawa zasiłkowa, art. 30a i 31',
      },
    ];
    const mandateBigInput: CaseInputs = {
      ...mandateInput,
      payer_insured_count_nov_30: '> 20',
    };
    const renderedBig = renderWithRouter(
      <CaseApplications
        documents={mandateEmployerDocs}
        input={mandateBigInput}
        params={params as BenefitParams}
      />,
      '/plan/applications?situation=afterBirth',
    );
    expect(screen.getByText('ZUS ZAM')).toBeInTheDocument();
    expect(screen.queryByText('WNIOSEK-KP')).not.toBeInTheDocument();
    expect(screen.getByText('Płatnik składek (zleceniodawca)')).toBeInTheDocument();
    renderedBig.unmount();

    // JDG (case-06): 2 części rodzicielskiego jako ZUS ZAM, bez pustego ZAM i bez WNIOSEK-KP
    const record06 = case06 as CaseRecord;
    const input06: CaseInputs = { ...record06.inputs, reference_date: '2026-11-21' };
    const plan06 = calculateCasePlan(input06, params as BenefitParams);
    renderWithRouter(
      <CaseApplications
        documents={plan06.documents}
        input={input06}
        plan={plan06}
        params={params as BenefitParams}
      />,
      '/plan/applications?case=case-06',
    );

    expect(
      screen.getByRole('heading', { name: 'Lista wniosków (3)', level: 3 }),
    ).toBeInTheDocument();
    expect(screen.queryByText('WNIOSEK-KP')).not.toBeInTheDocument();
    expect(screen.getAllByText('ZUS ZAM')).toHaveLength(2);
    expect(screen.getAllByText(/16\.08\.2027–26\.09\.2027/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/27\.09\.2027–26\.11\.2027/).length).toBeGreaterThan(0);
  });

  it('zachowuje spójność z plan.documents dla wszystkich 6 spraw ZUS (case-01…case-06)', () => {
    const allCases = [case01, case02, case03, case04, case05, case06] as CaseRecord[];
    for (const record of allCases) {
      const input: CaseInputs = { ...record.inputs, reference_date: '2026-11-21' };
      const plan = calculateCasePlan(input, params as BenefitParams);
      const { unmount } = renderWithRouter(
        <CaseApplications
          documents={plan.documents}
          input={input}
          plan={plan}
          params={params as BenefitParams}
        />,
        `/plan/applications?case=${record.case_id}`,
      );

      // Każdy termin z dokumentów wnioskowych pojawia się we wnioskach
      const appDeadlines = plan.documents
        .filter((doc) => doc.deadline !== null)
        .map((doc) => formatPolishDate(doc.deadline));
      for (const formattedDeadline of appDeadlines) {
        expect(screen.getAllByText(formattedDeadline).length).toBeGreaterThan(0);
      }

      // Nigdy więcej niż 1 wniosek do USC
      expect(
        screen.queryAllByText('Wniosek do USC o wydanie odpisu aktu urodzenia').length,
      ).toBeLessThanOrEqual(1);

      // Dla JDG (B2B) brak wniosków KP
      if (input.employment_type === 'B2B') {
        expect(screen.queryByText('WNIOSEK-KP')).not.toBeInTheDocument();
      }
      unmount();
    }
  });

  it('obsługuje spokojnym tonem sytuację martwego urodzenia oraz pusty stan bez danych', () => {
    const stillbirthDraft: ScenarioDraft = {
      situation: 'afterBirth',
      referenceDate: '2026-11-21',
      birthDate: '2026-11-10',
      expectedBirthDate: null,
      childrenCount: 1,
      childAcceptanceDate: null,
      childAgeYears: null,
      adoptionType: null,
      rateVariant: 'combined',
      mother: {
        role: 'mother',
        insuranceTitle: 'employment',
        sicknessInsurance: 'mandatory',
        insuredSince: '2020-01-01',
        insuranceEndDate: null,
        benefitBase: 6000,
        contributionDebt: null,
        employerInsuredCount: 50,
        age: 30,
        wantsLeave: true,
      },
      father: null,
      special: {
        stillbirth: true,
        zaZyciemCertificate: false,
        motherHospitalized: false,
        motherIncapableOfIndependentLiving: false,
        motherDeceased: false,
      },
    };
    const sbInput = wizardCase(stillbirthDraft, params as BenefitParams)!;
    const sbPlan = calculateCasePlan(sbInput, params as BenefitParams);

    const { container, unmount } = renderWithRouter(
      <CaseApplications
        documents={sbPlan.documents}
        input={sbInput}
        plan={sbPlan}
        params={params as BenefitParams}
      />,
      '/plan/applications?situation=afterBirth',
    );
    expect(
      screen.getByRole('heading', {
        name: 'Wniosek o urlop macierzyński po stracie dziecka',
        level: 4,
      }),
    ).toBeInTheDocument();
    expect(container.textContent).not.toContain('!');
    expect(container.textContent).not.toMatch(/gratul/i);
    expect(screen.getAllByText(/8 tyg\./).length).toBeGreaterThan(0);
    unmount();

    renderWithRouter(<CaseApplications documents={[]} />, '/plan/applications');
    expect(screen.getByText('Brak wniosków do przygotowania')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Uzupełnij dane ›' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dalej: Wsparcie ›' })).toBeInTheDocument();
  });
});
