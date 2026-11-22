/// <reference types="node" />

import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import params from '@shared/params.json';
import { calculateCasePlan } from '@shared/engine/casePlan';
import { birthInput } from '@shared/engine/__tests__/auditFixtures';
import { ScenarioProvider, useScenario } from '../../../app/ScenarioContext';
import { CaseDocuments } from '../tabs/CasePaperwork';
import { buildCalendarMilestones } from '../../leavePlan/leavePlanValidation';
import { extractCaseFields } from '../../cases/pdfCaseFields';
import { ContributionDebtCertificate, SickLeavePreview } from '../../login/ZusSimulationPanels';
import { buildAssistantContext } from '../../support/assistantApi';


function renderDocuments() {
  const input = birthInput();
  const plan = calculateCasePlan(input, params);
  render(
    <MemoryRouter initialEntries={['/plan/documents']}>
      <ScenarioProvider>
        <CaseDocuments
          documents={plan.documents}
          effectiveDate="2026-10-24"
          input={input}
          plan={plan}
        />
      </ScenarioProvider>
    </MemoryRouter>,
  );
}

function PlanAddressProbe() {
  const { updatePlanInputs } = useScenario();
  const { search } = useLocation();
  return (
    <>
      <button
        type="button"
        onClick={() =>
          updatePlanInputs(
            birthInput(
              {
                employment_type: 'B2B',
                voluntary_sickness_insured: true,
                debt_amount_pln: 912.34,
              },
              { za_zyciem_certificate: true },
            ),
          )
        }
      >
        Zmień plan na dane syntetyczne
      </button>
      <output aria-label="Adres aktualnego planu">{search}</output>
    </>
  );
}

describe('Wiarygodność prezentacji', () => {
  it('UI-01 kalendarz pokazuje ten sam dzień graniczny co dokument', () => {
    const input = birthInput({
      parental_leave_parts: [{ start_date: '2026-11-18', end_date: '2026-11-24' }],
    });
    const plan = calculateCasePlan(input, params);
    const milestones = buildCalendarMilestones(input, plan, { MOTHER: '2026-11-25', FATHER: null });
    expect(milestones).toContainEqual(
      expect.objectContaining({
        kind: 'deadline',
        date: '2026-10-28',
        parentRole: 'MOTHER',
        isPast: true,
      }),
    );
    expect(milestones).toContainEqual(
      expect.objectContaining({
        kind: 'event',
        date: '2026-11-25',
        label: 'Powrót do pracy (Mama)',
      }),
    );
  });

  it('UI-02 zaświadczenie i e-ZLA mają widoczne oznaczenia symulacji', () => {
    render(
      <>
        <ContributionDebtCertificate asOfDate="2026-07-01" contributionDebt={48.06} />
        <SickLeavePreview
          certificates={[
            {
              id: 'SYNTHETIC-L4',
              startDate: '2026-05-15',
              endDate: '2026-05-15',
              pregnancyCode: true,
            },
          ]}
        />
      </>,
    );
    expect(screen.getByText(/Symulacja danych ZUS/)).toBeVisible();
    expect(screen.getByRole('heading', { name: /e-ZLA \(symulacja ZUS\)/ })).toBeVisible();
    expect(screen.getByText('W progu ustawowym')).toBeVisible();
  });

  it('UI-03 extractor nie wybiera losowo jednej z dwóch sprzecznych dat', () => {
    const fields = extractCaseFields(
      'Data porodu: 01.07.2026\nData porodu: 02.07.2026\nPodstawa wymiaru zasiłku: 6000,00 zł',
    );
    expect(fields.birthDate).toBeUndefined();
    expect(fields.base).toBe('6000');
  });

  it('UI-04 zwykły kontekst AI pomija daty i kwotę podstawy', () => {
    const input = birthInput({ benefit_base_amount_pln: 6137.22 });
    const payload = buildAssistantContext(input, calculateCasePlan(input, params), false);
    expect(payload).toMatchObject({ stage: 'POST_BIRTH', employment_type: 'UOP' });
    expect(JSON.stringify(payload)).not.toContain('2026-07-01');
    expect(JSON.stringify(payload)).not.toContain('6137.22');
  });

  it('AUD-22 import nie zamienia ujemnej podstawy z dokumentu na dodatnią', () => {
    const fields = extractCaseFields('Podstawa wymiaru zasiłku -500,00 zł');
    expect(fields.base).toBeUndefined();
  });

  it(
    'AUD-23 informacja o formularzach uwzględnia wyjątek eZUS od 20 listopada 2026',
    () => {
      renderDocuments();
      const section = screen.getByText(/Zmiany w formularzach ZUS/).closest('details');
      expect(section).toHaveTextContent(/pełnomocni/i);
      expect(section).toHaveTextContent(/20[.\s]+11|20 listopada/i);
    },
  );

  it(
    'AUD-24 edycja planu nie umieszcza stanu zdrowia ani zadłużenia w standardowym URL',
    () => {
      render(
        <MemoryRouter initialEntries={['/plan/calculator']}>
          <ScenarioProvider>
            <PlanAddressProbe />
          </ScenarioProvider>
        </MemoryRouter>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Zmień plan na dane syntetyczne' }));
      const address = screen.getByLabelText('Adres aktualnego planu').textContent ?? '';
      const rawInput = new URLSearchParams(address).get('inputs') ?? '';
      expect(rawInput).not.toMatch(/za_zyciem_certificate|912\.34/);
    },
  );
});
