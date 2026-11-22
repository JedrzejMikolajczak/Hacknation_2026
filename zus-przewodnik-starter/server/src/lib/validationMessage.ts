import type { ZodError } from 'zod';

const fieldLabels: Readonly<Record<string, string>> = {
  applicant_role: 'Wnioskodawca',
  stage: 'Sytuacja rodziny',
  co_parenting: 'Plan obojga rodziców',
  other_parent_insured: 'Ubezpieczenie drugiego rodzica',
  employment_type: 'Forma zatrudnienia',
  contract_type: 'Rodzaj umowy',
  contract_end_date: 'Data zakończenia umowy',
  payer_insured_count_nov_30: 'Liczba osób zgłoszonych do ubezpieczenia',
  voluntary_sickness_insured: 'Dobrowolne ubezpieczenie chorobowe',
  insurance_duration_days: 'Liczba dni ubezpieczenia chorobowego',
  has_b2b_arrears: 'Zadłużenie składkowe',
  applicant_age_50_plus: 'Wiek wnioskodawcy',
  benefit_base_amount_pln: 'Podstawa wymiaru zasiłku',
  due_or_birth_date: 'Data porodu lub przewidywany termin porodu',
  application_date: 'Data złożenia wniosku',
  days_from_birth_to_application: 'Liczba dni od porodu do złożenia wniosku',
  children_count: 'Liczba dzieci',
  requested_payment_variant: 'Wariant wypłaty zasiłku',
  father_parental_weeks: 'Liczba tygodni urlopu rodzicielskiego ojca',
  part_time_work_fraction: 'Wymiar pracy w trakcie urlopu',
  special_circumstances: 'Szczególne okoliczności',
  has_code_b_on_ezla: 'Kod B na zwolnieniu lekarskim',
  premature_or_hospitalized_newborn: 'Wcześniactwo lub pobyt dziecka w szpitalu',
  za_zyciem_certificate: 'Zaświadczenie „Za życiem”',
  stillbirth_or_child_death: 'Przebieg porodu lub utrata dziecka',
  mother_hospitalized_or_incapable: 'Pobyt mamy w szpitalu lub orzeczenie',
  mother_deceased: 'Zgon mamy',
  mother_abandoned_child: 'Porzucenie dziecka',
  unlawful_termination_confirmed_by_court: 'Orzeczenie o niezgodnym z prawem rozwiązaniu umowy',
  employer_bankruptcy_or_liquidation: 'Upadłość lub likwidacja pracodawcy',
  adopted_or_foster_child_age_years: 'Wiek przyjętego dziecka',
  is_professional_foster_family: 'Zawodowa rodzina zastępcza',
  living_children_count: 'Liczba żyjących dzieci',
  deceased_children_count: 'Liczba zmarłych dzieci',
  pregnancy_week_at_birth: 'Tydzień ciąży w dniu porodu',
  birth_weight_grams: 'Masa urodzeniowa w gramach',
  newborn_hospitalization_start: 'Początek pobytu dziecka w szpitalu',
  newborn_hospitalization_end: 'Koniec pobytu dziecka w szpitalu',
  za_zyciem_certificate_date: 'Data wystawienia zaświadczenia „Za życiem”',
  application_to_payer_date: 'Data złożenia wniosku u płatnika',
  maternity_leave_start_date: 'Początek urlopu macierzyńskiego',
  sickness_leave_start_date: 'Początek zwolnienia lekarskiego',
  sickness_leave_end_date: 'Koniec zwolnienia lekarskiego',
  sickness_benefit_start_date: 'Początek wypłaty zasiłku chorobowego',
  sickness_waiting_period_confirmed: 'Potwierdzenie okresu wyczekiwania',
  monthly_bases: 'Miesięczne podstawy wymiaru zasiłku',
  month: 'Miesiąc podstawy wymiaru zasiłku',
  amount_pln: 'Kwota w złotych',
  excluded_bonus_pln: 'Premia wyłączona z podstawy',
  parental_leave_parts: 'Części urlopu rodzicielskiego',
  start_date: 'Data rozpoczęcia okresu urlopu',
  end_date: 'Data zakończenia okresu urlopu',
  parent_role: 'Rodzic korzystający z urlopu',
  work_fraction: 'Wymiar pracy w części urlopu',
  title_start_date: 'Data rozpoczęcia ubezpieczenia',
  employer_is_family_member: 'Zatrudnienie u członka rodziny',
  newly_created_position: 'Nowo utworzone stanowisko',
  adopted_or_foster_child_acceptance_date: 'Data przyjęcia dziecka',
  adopted_or_foster_child_birth_date: 'Data urodzenia przyjętego dziecka',
  adoption_order_final_date: 'Data uprawomocnienia przysposobienia',
  adoption_type: 'Rodzaj przyjęcia dziecka',
  school_obligation_deferred: 'Odroczenie obowiązku szkolnego',
  child_death_date: 'Data zgonu dziecka',
  parental_only: 'Wniosek wyłącznie o urlop rodzicielski',
  paternity_leave_start_date: 'Początek urlopu ojcowskiego',
  father_takeover_date: 'Data przejęcia urlopu przez ojca',
  mother_death_date: 'Data śmierci matki',
  mother_was_insured_at_death: 'Ubezpieczenie mamy w dniu śmierci',
  sickness_prior_credited_days: 'Dni poprzedniego ubezpieczenia zaliczone do wyczekiwania',
  mother_abandonment_date: 'Data porzucenia dziecka',
  mother_maternity_days_used: 'Liczba wykorzystanych dni urlopu macierzyńskiego',
  mother_was_insured_at_abandonment: 'Ubezpieczenie mamy w dniu porzucenia dziecka',
  father_stops_gainful_activity: 'Przerwanie działalności zarobkowej przez ojca',
  reference_date: 'Data odniesienia planu',
  debt_amount_pln: 'Kwota zadłużenia składkowego',
  sick_pay_days_already_used: 'Liczba wykorzystanych dni wynagrodzenia chorobowego',
  sickness_benefit_days_already_used: 'Liczba wykorzystanych dni zasiłku chorobowego',
  other_parent: 'Dane ubezpieczenia drugiego rodzica',
  additional_insurance_titles: 'Dodatkowy tytuł ubezpieczenia',
  sickness_insured: 'Ubezpieczenie chorobowe',
  secondary_employment_type: 'Forma dodatkowego zatrudnienia',
  secondary_voluntary_sickness_insured: 'Dobrowolne ubezpieczenie z drugiego tytułu',
  sickness_base_changes: 'Zmiany podstawy zasiłku chorobowego',
  effective_date: 'Data zmiany podstawy',
  profile_id: 'Profil testowy',
  question: 'Pytanie do asystenta',
};

export function validationMessage(issue: ZodError['issues'][number]): string {
  const label = issue.path
    .map((part) => typeof part === 'string' && Object.hasOwn(fieldLabels, part) ? fieldLabels[part] : null)
    .filter(Boolean)
    .join(' → ');
  let instruction: string;
  switch (issue.code) {
    case 'custom':
      instruction = issue.message;
      break;
    case 'invalid_format':
      instruction = issue.format === 'date'
        ? 'Wybierz prawidłową datę.'
        : 'Sprawdź format wpisanej wartości.';
      break;
    case 'too_small':
      instruction = issue.origin === 'number'
        ? `Podaj wartość ${issue.inclusive ? 'co najmniej' : 'większą niż'} ${issue.minimum}.`
        : 'Uzupełnij wymagane dane.';
      break;
    case 'too_big':
      instruction = issue.origin === 'number'
        ? `Podaj wartość ${issue.inclusive ? 'co najwyżej' : 'mniejszą niż'} ${issue.maximum}.`
        : 'Skróć wartość lub usuń zbędne pozycje.';
      break;
    case 'invalid_value':
      instruction = 'Wybierz jedną z dostępnych opcji.';
      break;
    case 'unrecognized_keys':
      instruction = 'Formularz zawiera dodatkowe pola. Otwórz ponownie kreator lub pobierz aktualny wzór sprawy.';
      break;
    case 'invalid_type':
      instruction = issue.expected === 'number' || issue.expected === 'int'
        ? 'Podaj prawidłową liczbę.'
        : 'Uzupełnij lub wybierz prawidłową wartość.';
      break;
    default:
      instruction = 'Sprawdź i popraw wartość w formularzu.';
  }
  return label ? `${label}. ${instruction}` : instruction;
}
