import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { calculateCasePlan } from '@shared/engine/casePlan';
import params from '@shared/params.json';
import type { BenefitParams, CaseDocument, CaseInputs, CaseRecord } from '@shared/types';
import case01 from '../../../../../../data/cases/case-01.json';
import case02 from '../../../../../../data/cases/case-02.json';
import case03 from '../../../../../../data/cases/case-03.json';
import case04 from '../../../../../../data/cases/case-04.json';
import case05 from '../../../../../../data/cases/case-05.json';
import case06 from '../../../../../../data/cases/case-06.json';
import { ScenarioProvider, type ScenarioDraft } from '../../../../app/ScenarioContext';
import { wizardCase } from '../../caseScenario';
import { formatPolishDate } from '../../planScenario';
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
    expect(
      screen.getAllByText(/Wzór zgodny z rozporządzeniem MRPiPS 2025 poz\. 322 – do weryfikacji/)
        .length,
    ).toBeGreaterThan(0);
    const nextLink = screen.getByRole('link', { name: 'Dalej: Wsparcie ›' });
    expect(nextLink).toHaveAttribute('href', '/plan/support?case=case-04');
  });

  it('dla planu dwojga rodziców na UoP usuwa duplikaty USC/ZAM, wpisuje realne daty i wysyła pojedynczo oraz zbiorczo', () => {
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

    // Wysyłka pojedynczego wniosku matki (> 20 ubezpieczonych: wystarczy imię i PESEL)
    fireEvent.change(screen.getByLabelText('Imię i nazwisko'), {
      target: { value: 'Anna Kowalska' },
    });
    fireEvent.change(screen.getByLabelText('PESEL'), { target: { value: '95050512345' } });
    fireEvent.click(
      screen.getByRole('button', {
        name: /Wyślij Wniosek o urlop macierzyński i rodzicielski/,
      }),
    );
    expect(screen.getByRole('status')).toHaveTextContent(/UPO-\d{4}-WNIOSEK815-001/);
    expect(screen.getByRole('button', { name: 'Wyślij pozostałe (4) ›' })).toBeInTheDocument();

    // Zbiorcza wysyłka pozostałych wymaga rachunku (bo ojciec ma Z-3 -> wypłaca ZUS)
    fireEvent.click(screen.getByRole('button', { name: 'Wyślij pozostałe (4) ›' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/numer rachunku bankowego/);

    fireEvent.change(screen.getByLabelText('Numer rachunku'), {
      target: { value: '12345678901234567890123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Wyślij pozostałe (4) ›' }));
    expect(screen.getByRole('button', { name: 'Wszystkie wnioski wysłane' })).toBeDisabled();

    // Podgląd do druku zawiera notkę poz. 322
    const printButtons = screen.getAllByRole('button', { name: 'Drukuj lub zapisz PDF' });
    fireEvent.click(printButtons[0]);
    const dialog = screen.getByRole('dialog');
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
    expect(screen.getByText(/12\.01\.2026–07\.02\.2027/)).toBeInTheDocument();
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
        name: 'ZAM – zasiłek za okres odpowiadający urlopowi rodzicielskiemu (część 1)',
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
    expect(screen.getAllByText(/20\.09\.2026–31\.10\.2026/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/01\.11\.2026–31\.12\.2026/).length).toBeGreaterThan(0);
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
