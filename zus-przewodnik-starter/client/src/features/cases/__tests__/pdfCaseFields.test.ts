import { describe, expect, it } from 'vitest';
import { extractCaseFields, toPdfCaseInputs } from '../pdfCaseFields';

describe('Odczyt pól z PDF', () => {
  it('wydobywa tylko pola potrzebne do obliczeń i normalizuje polski zapis kwoty i daty', () => {
    const input = [
      'Wnioskodawca: Anna Testowa',
      'Data porodu: 1.11.2026',
      'Liczba dzieci: 2',
      'Podstawa wymiaru zasiłku (zł): 6\u00a0500,50 PLN',
      'Data złożenia wniosku: 2026-11-04',
    ].join('\n');
    expect(extractCaseFields(input)).toMatchObject({
      birthDate: '2026-11-01',
      children: '2',
      base: '6500.5',
      applicationDate: '2026-11-04',
    });
    expect(JSON.stringify(extractCaseFields(input))).not.toContain('Anna');
  });

  it('pomija sprzeczne daty, nieistniejące dni i dane bez rozpoznanej etykiety', () => {
    const input = [
      'Data porodu: 01.11.2026',
      'Data urodzenia dziecka: 03.11.2026',
      'Data złożenia wniosku: 31.11.2026',
      'Numer rachunku: 6500',
    ].join('\n');
    expect(Object.values(extractCaseFields(input)).every((value) => value === undefined)).toBe(
      true,
    );
  });
});

it('przekazuje przyjęcie dziecka zgodnie z kontraktem planu, bez pola pliku i danych identyfikacyjnych', () => {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    stage: 'ADOPTION',
    employment: 'UOP',
    applicant: 'MOTHER',
    acceptanceDate: '2026-10-09',
    adoptionType: 'FOSTER_FAMILY',
    childAge: '2',
    children: '1',
    base: '6500.50',
    name: 'Anna Testowa',
  }))
    data.set(key, value);
  const result = toPdfCaseInputs(data);
  expect(result).toMatchObject({
    stage: 'ADOPTION',
    due_or_birth_date: null,
    adopted_or_foster_child_acceptance_date: '2026-10-09',
    adoption_type: 'FOSTER_FAMILY',
    benefit_base_amount_pln: 6500.5,
  });
  expect(result.special_circumstances.adopted_or_foster_child_age_years).toBe(2);
  expect(JSON.stringify(result)).not.toContain('Anna');
});
