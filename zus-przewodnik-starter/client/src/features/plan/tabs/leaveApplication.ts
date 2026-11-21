import type { CaseDocument, CaseInputs, CasePeriod } from '@shared/types';
import { addDaysIso, formatPolishDate } from '../planScenario';

interface ApplicationField {
  id: string;
  label: string;
  value?: string;
  type?: 'number';
  options?: { value: string; label: string }[];
}

interface LeaveApplication {
  section: string;
  fields: ApplicationField[];
  attachments: string[];
}

const birthRecord =
  'Skrócony odpis aktu urodzenia każdego dziecka, zagraniczny dokument urodzenia albo kopia jednego z tych dokumentów.';
const adoptionRecord =
  'Oświadczenie o dacie przyjęcia dziecka na wychowanie oraz kopia wniosku o przysposobienie z datą urodzenia dziecka i poświadczeniem daty złożenia przez sąd albo zaświadczenie sądu z obiema datami.';
const fosterRecord =
  'Oświadczenie o dacie przyjęcia dziecka na wychowanie oraz kopia prawomocnego orzeczenia sądu o umieszczeniu dziecka w rodzinie zastępczej albo kopia umowy rodziny zastępczej ze starostą.';
const priorMaternity: ApplicationField = {
  id: 'priorMaternity',
  label: 'Oświadczenie o okresie urlopu macierzyńskiego lub zasiłku wykorzystanym przed porodem',
};

export function leaveApplication(
  doc: CaseDocument,
  input: CaseInputs | null,
  periods: CasePeriod[],
  draft: Record<string, string>,
): LeaveApplication | null {
  if (doc.submit_to !== 'EMPLOYER') return null;
  const deceased = !!input?.special_circumstances.mother_deceased;
  const motherIsOtherParent = deceased && doc.parent_role === 'FATHER';
  const placementRecord =
    input?.adoption_type === 'FOSTER_FAMILY'
      ? fosterRecord
      : input?.adoption_type === 'ADOPTION'
        ? adoptionRecord
        : `W zależności od formy opieki: ${adoptionRecord} Dla rodziny zastępczej: ${fosterRecord}`;
  const adoptionAttachments = [
    placementRecord,
    ...(input?.school_obligation_deferred
      ? ['Kopia prawomocnej decyzji o odroczeniu obowiązku szkolnego.']
      : []),
  ];
  switch (doc.id) {
    case 'PRE_BIRTH_REQUEST':
      return {
        section: '§ 2',
        fields: [],
        attachments: ['Kopia zaświadczenia lekarskiego z przewidywaną datą porodu.'],
      };
    case 'PARENTAL_REQUEST':
      return {
        section: '§ 15',
        fields: [
          {
            id: 'priorParentalPeriod',
            label:
              'Okres dotychczas wykorzystanego urlopu rodzicielskiego lub pobierania zasiłku za ten okres',
          },
          {
            id: 'priorParentalParts',
            type: 'number',
            label:
              'Liczba wykorzystanych części urlopu rodzicielskiego lub złożonych wniosków o zasiłek za części tego urlopu',
          },
          {
            id: 'otherParentParental',
            label:
              'Oświadczenie pracownika o urlopie lub zasiłku drugiego rodzica w okresie objętym wnioskiem',
            value: motherIsOtherParent ? 'Drugi rodzic zmarł.' : undefined,
          },
        ],
        attachments: [
          ...(input?.stage === 'ADOPTION' ? adoptionAttachments : [birthRecord]),
          'Oświadczenie pracownika o braku zamiaru korzystania przez drugiego rodzica z urlopu rodzicielskiego lub zasiłku w okresie objętym wnioskiem albo o okresie, w którym drugi rodzic zamierza z nich korzystać.',
          ...(input?.special_circumstances.za_zyciem_certificate
            ? ['Kopia zaświadczenia lekarskiego „Za życiem”.']
            : []),
        ],
      };
    case 'PARENTAL_WORK_REQUEST': {
      const fraction = periods.find(
        (period) =>
          period.parent_role === doc.parent_role &&
          period.leave_type === doc.leave_type &&
          period.start_date === doc.start_date,
      )?.work_fraction;
      return {
        section: '§ 16',
        fields: [
          {
            id: 'workFraction',
            label: 'Wymiar czasu pracy',
            value: fraction
              ? `${new Intl.NumberFormat('pl-PL', { style: 'percent' }).format(fraction)} etatu`
              : undefined,
          },
          {
            id: 'workExtension',
            label:
              'Oświadczenie o zamiarze łączenia wydłużonej części urlopu z pracą i wymiarze etatu albo o braku takiego zamiaru',
          },
        ],
        attachments: [],
      };
    }
    case 'PATERNITY_REQUEST':
      return {
        section: '§ 17',
        fields: [
          {
            id: 'usedPaternity',
            label:
              'Oświadczenie ojca, czy korzystał wcześniej z urlopu ojcowskiego lub jego części',
            options: [
              { value: 'Nie korzystałem.', label: 'Nie korzystałem' },
              { value: 'Korzystałem.', label: 'Korzystałem' },
            ],
          },
        ],
        attachments: [
          birthRecord,
          ...(input?.stage === 'ADOPTION'
            ? ['Kopia prawomocnego postanowienia sądu o przysposobieniu dziecka.']
            : []),
          'Oświadczenie ojca, czy korzystał z urlopu ojcowskiego lub jego części.',
        ],
      };
    case 'SUPPLEMENTARY_REQUEST':
      return {
        section: '§ 14',
        fields: [
          {
            id: 'maternityEnd',
            label: 'Data zakończenia urlopu macierzyńskiego',
            value: doc.start_date ? formatPolishDate(addDaysIso(doc.start_date, -1)) : undefined,
          },
          {
            id: 'otherParentSupplementary',
            label:
              'Oświadczenie o braku zamiaru korzystania z urlopu uzupełniającego lub zasiłku za ten okres przez drugiego rodzica',
            value: motherIsOtherParent ? 'Drugi rodzic zmarł.' : undefined,
          },
        ],
        attachments: [
          'Zaświadczenie ze szpitala z okresem pobytu dziecka w szpitalu, tygodniem ciąży i masą urodzeniową.',
          'Oświadczenie wnioskodawcy o braku zamiaru korzystania przez drugiego rodzica z urlopu uzupełniającego lub zasiłku za ten okres.',
          ...(input?.stage === 'ADOPTION' ? [placementRecord] : []),
        ],
      };
    case 'ADOPTION_LEAVE':
      return {
        section: '§ 18',
        fields: [
          { id: 'children', label: 'Imiona, nazwiska i daty urodzenia dzieci objętych wnioskiem' },
        ],
        attachments: adoptionAttachments,
      };
    case 'TAKEOVER': {
      if (deceased)
        return {
          section:
            draft.takeoverBasis === 'insured'
              ? '§ 8'
              : draft.takeoverBasis === 'uninsured'
                ? '§ 10'
                : '§ 8 lub § 10',
          fields: [
            {
              id: 'takeoverBasis',
              label:
                'Czy w chwili zgonu mama była na urlopie macierzyńskim lub pobierała zasiłek za ten okres?',
              options: [
                { value: 'insured', label: 'Tak, korzystała z urlopu lub zasiłku' },
                { value: 'uninsured', label: 'Nie była objęta ubezpieczeniem chorobowym' },
              ],
            },
            {
              id: 'motherDeathDate',
              label: 'Oświadczenie o dacie zgonu matki dziecka',
              value: input?.father_takeover_date
                ? formatPolishDate(addDaysIso(input.father_takeover_date, -1))
                : undefined,
            },
            ...(draft.takeoverBasis === 'insured' ? [priorMaternity] : []),
          ],
          attachments: [birthRecord],
        };
      const special = input?.special_circumstances.mother_hospitalized_or_incapable;
      const mother = input?.applicant_role === 'MOTHER' ? input : input?.other_parent;
      const employee = mother?.employment_type === 'UOP';
      const hospital = draft.takeoverBasis === 'hospital';
      return {
        section: hospital
          ? employee
            ? '§ 6'
            : '§ 7'
          : special && !draft.takeoverBasis
            ? '§ 5–7'
            : '§ 5',
        fields: [
          ...(special
            ? [
                {
                  id: 'takeoverBasis',
                  label: 'Podstawa przejęcia urlopu',
                  options: [
                    {
                      value: 'resignation',
                      label: 'Rezygnacja mamy z pozostałej części urlopu lub zasiłku',
                    },
                    {
                      value: 'hospital',
                      label: 'Przerwanie urlopu lub pobierania zasiłku podczas hospitalizacji mamy',
                    },
                  ],
                },
              ]
            : []),
          ...(!special || draft.takeoverBasis === 'resignation'
            ? [
                {
                  id: 'children',
                  label: 'Imiona, nazwiska i daty urodzenia dzieci objętych wnioskiem',
                },
              ]
            : []),
          priorMaternity,
          ...(hospital
            ? [
                {
                  id: 'hospitalNotice',
                  label:
                    'Zobowiązanie do poinformowania pracodawcy o dacie opuszczenia szpitala przez mamę',
                  value:
                    'Zobowiązuję się poinformować pracodawcę o dacie opuszczenia placówki przez mamę dziecka.',
                },
              ]
            : []),
        ],
        attachments: [
          birthRecord,
          ...(hospital
            ? [
                'Oświadczenie matki o dacie przerwania urlopu macierzyńskiego lub pobierania zasiłku na czas pobytu w placówce.',
                'Zaświadczenie placówki o terminie przyjęcia matki.',
              ]
            : !special || draft.takeoverBasis === 'resignation'
              ? [
                  'Oświadczenie matki o zamiarze rezygnacji z pozostałej części urlopu macierzyńskiego lub z pobierania zasiłku za tę część.',
                ]
              : []),
        ],
      };
    }
    default:
      return null;
  }
}
