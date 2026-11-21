import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { BenefitParams } from '@shared/types';
import { ApiError } from '../../api/client';
import {
  cloneBenefitParams,
  DEFAULT_BENEFIT_PARAMS,
  fetchAdminParams,
  resetSessionAdminParams,
  saveAdminParams,
} from './adminApi';
import {
  computeDerivedMetrics,
  diffBenefitParams,
  percentToRate,
  rateToPercent,
} from './adminDiff';
import './AdminPage.css';

type AdminTabId = 'amounts' | 'leaves' | 'deadlines' | 'premature';

const ADMIN_TABS: { id: AdminTabId; label: string }[] = [
  { id: 'amounts', label: '1. Kwoty, składki i stawki %' },
  { id: 'leaves', label: '2. Długości urlopów (tygodnie)' },
  { id: 'deadlines', label: '3. Terminy wniosków i chorobowe' },
  { id: 'premature', label: '4. Wcześniaki i podgląd JSON' },
];

export function AdminPage() {
  const [baseline, setBaseline] = useState<BenefitParams>(() =>
    cloneBenefitParams(DEFAULT_BENEFIT_PARAMS),
  );
  const [draft, setDraft] = useState<BenefitParams>(() =>
    cloneBenefitParams(DEFAULT_BENEFIT_PARAMS),
  );
  const [activeTab, setActiveTab] = useState<AdminTabId>('amounts');
  const [adminToken, setAdminToken] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [isDemoFallback, setIsDemoFallback] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadParams() {
      setLoading(true);
      try {
        const res = await fetchAdminParams();
        if (cancelled) return;
        setBaseline(cloneBenefitParams(res.data));
        setDraft(cloneBenefitParams(res.data));
        setIsDemoFallback(res.isDemoFallback);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadParams();
    return () => {
      cancelled = true;
    };
  }, []);

  const changes = useMemo(() => diffBenefitParams(baseline, draft), [baseline, draft]);
  const derived = useMemo(() => computeDerivedMetrics(draft), [draft]);

  function handleRestoreDefaults() {
    resetSessionAdminParams();
    const fresh = cloneBenefitParams(DEFAULT_BENEFIT_PARAMS);
    setDraft(fresh);
    setStatusMessage('Przywrócono w formularzu oficjalne parametry ustawowe na 2026 rok.');
    setErrorMessage(null);
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setStatusMessage(null);
    setErrorMessage(null);

    if (!adminToken.trim()) {
      setErrorMessage(
        'Podaj klucz dostępu administratora (lub kliknij przycisk „Wypełnij hasłem demonstracyjnym”).',
      );
      return;
    }

    setSaving(true);
    try {
      const res = await saveAdminParams(draft, adminToken.trim());
      setBaseline(cloneBenefitParams(res.data));
      setDraft(cloneBenefitParams(res.data));
      setIsDemoFallback(res.isDemoFallback);
      setStatusMessage(
        res.isDemoFallback
          ? 'Zapisano nowe parametry w sesji demonstracyjnej (po wdrożeniu PUT /api/v1/admin/params zapis trafi bezpośrednio na serwer).'
          : 'Zapisano nowe parametry ustawowe na serwerze ZUS.',
      );
    } catch (error) {
      if (error instanceof ApiError && error.code === 'UNAUTHORIZED') {
        setErrorMessage('Błędny klucz dostępu administratora (401 UNAUTHORIZED).');
      } else if (error instanceof ApiError && error.code === 'VALIDATION_ERROR') {
        setErrorMessage(`Błąd walidacji parametrów: ${error.message}`);
      } else {
        setErrorMessage('Nie udało się zapisać parametrów. Sprawdź poprawność wpisanych liczb.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div className="admin-container">
          <div className="admin-header__top">
            <Link to="/" className="admin-header__back">
              ‹ Strona startowa
            </Link>
            <span className="admin-badge">Panel administracyjny ZUS – wersja demonstracyjna</span>
          </div>

          <h1 className="admin-header__title">Konfiguracja parametrów ustawowych ZUS</h1>
          <p className="admin-header__subtitle">
            Tutaj pracownik merytoryczny ZUS aktualizuje kwoty, stawki procentowe, długości urlopów
            i terminy wniosków (plik <code>shared/params.json</code>) bez udziału programistów.
          </p>
        </div>
      </header>

      <main className="admin-main">
        <div className="admin-container">
          {isDemoFallback && (
            <div className="admin-demo-notice" role="status">
              Tryb demonstracyjny – zmiany parametrów są pamiętane w bieżącej sesji przeglądarki do
              czasu uruchomienia zapisu PUT /api/v1/admin/params na serwerze.
            </div>
          )}

          <form onSubmit={(e) => void handleSave(e)}>
            {/* Sekcja autoryzacji i wersji */}
            <section className="admin-card" aria-labelledby="admin-auth-heading">
              <div className="admin-card__header">
                <div>
                  <h2 id="admin-auth-heading" className="admin-card__title">
                    Autoryzacja pracownika ZUS i wersja przepisów
                  </h2>
                  <p className="admin-card__lead">
                    Do zapisania zmian wymagany jest klucz dostępu administratora. Na potrzeby
                    pokazu kliknij przycisk poniżej, aby uzupełnić klucz automatycznie.
                  </p>
                </div>
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={handleRestoreDefaults}
                >
                  Przywróć oficjalne przepisy 2026
                </button>
              </div>

              <div className="admin-auth-grid">
                <div className="admin-field">
                  <label htmlFor="admin-token-input">Klucz dostępu administratora (token)</label>
                  <div className="admin-token-row">
                    <input
                      id="admin-token-input"
                      type="password"
                      autoComplete="off"
                      value={adminToken}
                      onChange={(e) => setAdminToken(e.target.value)}
                      placeholder="Wpisz token administratora"
                    />
                  </div>
                  <p className="admin-token-hint">
                    Token jest ustawiany tylko po stronie serwera (zmienna ADMIN_TOKEN) i nie jest
                    zapisany w aplikacji.
                  </p>
                </div>

                <label className="admin-field">
                  <span>Oznaczenie wersji przepisów</span>
                  <input
                    type="text"
                    value={draft.version}
                    onChange={(e) => setDraft({ ...draft, version: e.target.value })}
                    required
                  />
                </label>

                <label className="admin-field">
                  <span>Przepisy obowiązują od dnia</span>
                  <input
                    type="date"
                    value={draft.effectiveFrom}
                    onChange={(e) => setDraft({ ...draft, effectiveFrom: e.target.value })}
                    required
                  />
                </label>
              </div>
            </section>

            {/* Podgląd zmian Przed -> Po */}
            <section className="admin-changes-bar" aria-label="Podsumowanie zmian przed zapisem">
              <div className="admin-changes-bar__top">
                <div>
                  <strong>
                    {changes.length === 0
                      ? 'Brak niezapisanych zmian – wszystkie wartości są zgodne z aktualnymi parametrami.'
                      : `Liczba zmienionych parametrów do zapisania: ${changes.length}`}
                  </strong>
                </div>
                <button type="submit" className="button button--primary" disabled={saving}>
                  {saving ? 'Zapisywanie…' : 'Zapisz parametry w systemie'}
                </button>
              </div>

              {changes.length > 0 && (
                <ul className="admin-diff-list" aria-label="Lista zmienionych parametrów">
                  {changes.map((item) => (
                    <li key={item.id} className="admin-diff-item">
                      <span className="admin-diff-item__label">{item.label}:</span>{' '}
                      <span className="admin-diff-item__before">{item.before}</span> →{' '}
                      <strong className="admin-diff-item__after">{item.after}</strong>
                    </li>
                  ))}
                </ul>
              )}

              {errorMessage && (
                <p className="admin-alert admin-alert--error" role="alert">
                  {errorMessage}
                </p>
              )}
              {statusMessage && (
                <p className="admin-alert admin-alert--ok" role="status">
                  {statusMessage}
                </p>
              )}
            </section>

            {loading ? (
              <p className="admin-loading" role="status">
                Wczytywanie parametrów ustawowych…
              </p>
            ) : (
              <section className="admin-card" aria-label="Edycja grup parametrów">
                <div className="admin-tabs" role="tablist" aria-label="Kategorie parametrów ZUS">
                  {ADMIN_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={activeTab === tab.id}
                      className={activeTab === tab.id ? 'admin-tab admin-tab--active' : 'admin-tab'}
                      onClick={() => setActiveTab(tab.id)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {activeTab === 'amounts' && (
                  <div className="admin-tab-panel" role="tabpanel">
                    <h3 className="admin-section-title">
                      Kwoty bazowe, progi składek i stawki procentowe zasiłków
                    </h3>
                    <p className="admin-section-lead">
                      Wpisz wartości w złotych lub procentach (np. 81,5 oznacza stawkę 81,5%).
                    </p>

                    <div className="admin-derived-box" aria-live="polite">
                      <strong>Wyliczenia pochodne na żywo:</strong> przy płacy minimalnej{' '}
                      <strong>{draft.benefitBase.minimumWage} zł</strong> minimalna podstawa wymiaru
                      zasiłku po odliczeniu składek wynosi{' '}
                      <strong>{derived.minBenefitBasePln.toFixed(2).replace('.', ',')} zł</strong>,
                      a próg zadłużenia wstrzymującego zasiłek na działalności (JDG) to{' '}
                      <strong>{derived.jdgDebtThresholdPln.toFixed(2).replace('.', ',')} zł</strong>
                      .
                    </div>

                    <div className="admin-fields-grid">
                      <label className="admin-field">
                        <span>Płaca minimalna (zł brutto)</span>
                        <input
                          type="number"
                          min={1}
                          step="0.01"
                          value={draft.benefitBase.minimumWage}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              benefitBase: {
                                ...draft.benefitBase,
                                minimumWage: Number(e.target.value),
                              },
                            })
                          }
                        />
                      </label>

                      <label className="admin-field">
                        <span>Odliczenie składek społecznych (%)</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step="0.01"
                          value={rateToPercent(draft.benefitBase.socialContributionDeduction)}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              benefitBase: {
                                ...draft.benefitBase,
                                socialContributionDeduction: percentToRate(Number(e.target.value)),
                              },
                            })
                          }
                        />
                      </label>

                      <label className="admin-field">
                        <span>Stawka łączona – wniosek do 21 dni (%)</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step="0.1"
                          value={rateToPercent(draft.rates.combined)}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              rates: {
                                ...draft.rates,
                                combined: percentToRate(Number(e.target.value)),
                              },
                            })
                          }
                        />
                      </label>

                      <label className="admin-field">
                        <span>Stawka urlopu macierzyńskiego (%)</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step="0.1"
                          value={rateToPercent(draft.rates.maternity)}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              rates: {
                                ...draft.rates,
                                maternity: percentToRate(Number(e.target.value)),
                              },
                            })
                          }
                        />
                      </label>

                      <label className="admin-field">
                        <span>Stawka urlopu rodzicielskiego (%)</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step="0.1"
                          value={rateToPercent(draft.rates.parental)}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              rates: {
                                ...draft.rates,
                                parental: percentToRate(Number(e.target.value)),
                              },
                            })
                          }
                        />
                      </label>

                      <label className="admin-field">
                        <span>Stawka 9 tyg. drugiego rodzica w wariancie 81,5% (%)</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step="0.1"
                          value={rateToPercent(draft.rates.secondParentNonTransferableInCombined)}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              rates: {
                                ...draft.rates,
                                secondParentNonTransferableInCombined: percentToRate(
                                  Number(e.target.value),
                                ),
                              },
                            })
                          }
                        />
                      </label>

                      <label className="admin-field">
                        <span>Stawka urlopu ojcowskiego (%)</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step="0.1"
                          value={rateToPercent(draft.rates.paternity)}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              rates: {
                                ...draft.rates,
                                paternity: percentToRate(Number(e.target.value)),
                              },
                            })
                          }
                        />
                      </label>

                      <label className="admin-field">
                        <span>Stawka chorobowego w ciąży – kod „B” (%)</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step="0.1"
                          value={rateToPercent(draft.rates.sicknessPregnancy)}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              rates: {
                                ...draft.rates,
                                sicknessPregnancy: percentToRate(Number(e.target.value)),
                              },
                            })
                          }
                        />
                      </label>

                      <label className="admin-field">
                        <span>Maks. podstawa dobrowolnego chorobowego (zł)</span>
                        <input
                          type="number"
                          min={1}
                          step="0.01"
                          value={draft.benefitBase.maxVoluntaryContributionBase}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              benefitBase: {
                                ...draft.benefitBase,
                                maxVoluntaryContributionBase: Number(e.target.value),
                              },
                            })
                          }
                        />
                      </label>

                      <label className="admin-field">
                        <span>Maks. podstawa pozapracownicza (zł)</span>
                        <input
                          type="number"
                          min={1}
                          step="0.01"
                          value={draft.benefitBase.maxBaseNonEmployee}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              benefitBase: {
                                ...draft.benefitBase,
                                maxBaseNonEmployee: Number(e.target.value),
                              },
                            })
                          }
                        />
                      </label>

                      <label className="admin-field">
                        <span>Próg zadłużenia JDG (% płacy minimalnej)</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step="0.1"
                          value={rateToPercent(draft.selfEmployedDebtThresholdShareOfMinimumWage)}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              selfEmployedDebtThresholdShareOfMinimumWage: percentToRate(
                                Number(e.target.value),
                              ),
                            })
                          }
                        />
                      </label>

                      <label className="admin-field">
                        <span>Próg liczby ubezpieczonych u płatnika (pracodawca vs ZUS)</span>
                        <input
                          type="number"
                          min={1}
                          value={draft.payerThresholdInsuredCount}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              payerThresholdInsuredCount: Number(e.target.value),
                            })
                          }
                        />
                      </label>
                    </div>
                  </div>
                )}

                {activeTab === 'leaves' && (
                  <div className="admin-tab-panel" role="tabpanel">
                    <h3 className="admin-section-title">
                      Wymiary urlopów macierzyńskiego, rodzicielskiego, ojcowskiego i adopcji
                    </h3>
                    <p className="admin-section-lead">
                      Określ liczbę tygodni przysługującą rodzicom w poszczególnych sytuacjach.
                    </p>

                    <div className="admin-fields-grid">
                      {(['1', '2', '3', '4', '5'] as const).map((countKey) => (
                        <label key={countKey} className="admin-field">
                          <span>
                            Urlop macierzyński – {countKey === '5' ? '5 i więcej' : countKey}{' '}
                            dziecko/dzieci (tygodnie)
                          </span>
                          <input
                            type="number"
                            min={1}
                            value={draft.maternityLeave.weeksByChildrenCount[countKey]}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                maternityLeave: {
                                  ...draft.maternityLeave,
                                  weeksByChildrenCount: {
                                    ...draft.maternityLeave.weeksByChildrenCount,
                                    [countKey]: Number(e.target.value),
                                  },
                                },
                              })
                            }
                          />
                        </label>
                      ))}

                      <label className="admin-field">
                        <span>Maks. urlop macierzyński przed porodem (tygodnie)</span>
                        <input
                          type="number"
                          min={0}
                          value={draft.maternityLeave.maxWeeksBeforeBirth}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              maternityLeave: {
                                ...draft.maternityLeave,
                                maxWeeksBeforeBirth: Number(e.target.value),
                              },
                            })
                          }
                        />
                      </label>

                      <label className="admin-field">
                        <span>Obowiązkowy urlop matki po porodzie (tygodnie)</span>
                        <input
                          type="number"
                          min={1}
                          value={draft.maternityLeave.motherMandatoryWeeksAfterBirth}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              maternityLeave: {
                                ...draft.maternityLeave,
                                motherMandatoryWeeksAfterBirth: Number(e.target.value),
                              },
                            })
                          }
                        />
                      </label>

                      <label className="admin-field">
                        <span>Urlop rodzicielski – 1 dziecko (tygodnie)</span>
                        <input
                          type="number"
                          min={1}
                          value={draft.parentalLeave.weeksSingleChild}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              parentalLeave: {
                                ...draft.parentalLeave,
                                weeksSingleChild: Number(e.target.value),
                              },
                            })
                          }
                        />
                      </label>

                      <label className="admin-field">
                        <span>Urlop rodzicielski – 2+ dzieci (tygodnie)</span>
                        <input
                          type="number"
                          min={1}
                          value={draft.parentalLeave.weeksMultipleChildren}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              parentalLeave: {
                                ...draft.parentalLeave,
                                weeksMultipleChildren: Number(e.target.value),
                              },
                            })
                          }
                        />
                      </label>

                      <label className="admin-field">
                        <span>Urlop rodzicielski „Za życiem” – 1 dziecko (tygodnie)</span>
                        <input
                          type="number"
                          min={1}
                          value={draft.parentalLeave.weeksSingleChildZaZyciem}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              parentalLeave: {
                                ...draft.parentalLeave,
                                weeksSingleChildZaZyciem: Number(e.target.value),
                              },
                            })
                          }
                        />
                      </label>

                      <label className="admin-field">
                        <span>Urlop rodzicielski „Za życiem” – 2+ dzieci (tygodnie)</span>
                        <input
                          type="number"
                          min={1}
                          value={draft.parentalLeave.weeksMultipleChildrenZaZyciem}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              parentalLeave: {
                                ...draft.parentalLeave,
                                weeksMultipleChildrenZaZyciem: Number(e.target.value),
                              },
                            })
                          }
                        />
                      </label>

                      <label className="admin-field">
                        <span>Tygodnie wyłącznie dla każdego z rodziców</span>
                        <input
                          type="number"
                          min={0}
                          value={draft.parentalLeave.nonTransferableWeeksPerParent}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              parentalLeave: {
                                ...draft.parentalLeave,
                                nonTransferableWeeksPerParent: Number(e.target.value),
                              },
                            })
                          }
                        />
                      </label>

                      <label className="admin-field">
                        <span>Maksymalna liczba części urlopu rodzicielskiego</span>
                        <input
                          type="number"
                          min={1}
                          value={draft.parentalLeave.maxParts}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              parentalLeave: {
                                ...draft.parentalLeave,
                                maxParts: Number(e.target.value),
                              },
                            })
                          }
                        />
                      </label>

                      <label className="admin-field">
                        <span>Wymiar urlopu ojcowskiego (tygodnie)</span>
                        <input
                          type="number"
                          min={1}
                          value={draft.paternityLeave.weeks}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              paternityLeave: {
                                ...draft.paternityLeave,
                                weeks: Number(e.target.value),
                              },
                            })
                          }
                        />
                      </label>

                      <label className="admin-field">
                        <span>Limit wieku dziecka na urlop ojcowski (miesiące)</span>
                        <input
                          type="number"
                          min={1}
                          value={draft.paternityLeave.deadlineChildAgeMonths}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              paternityLeave: {
                                ...draft.paternityLeave,
                                deadlineChildAgeMonths: Number(e.target.value),
                              },
                            })
                          }
                        />
                      </label>

                      <label className="admin-field">
                        <span>Min. urlop na warunkach macierzyńskiego – adopcja (tygodnie)</span>
                        <input
                          type="number"
                          min={1}
                          value={draft.adoptionMaternityLeave.minWeeks}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              adoptionMaternityLeave: {
                                ...draft.adoptionMaternityLeave,
                                minWeeks: Number(e.target.value),
                              },
                            })
                          }
                        />
                      </label>
                    </div>
                  </div>
                )}

                {activeTab === 'deadlines' && (
                  <div className="admin-tab-panel" role="tabpanel">
                    <h3 className="admin-section-title">
                      Terminy składania wniosków oraz zasiłek chorobowy w ciąży
                    </h3>
                    <p className="admin-section-lead">
                      Liczba dni na złożenie wniosków oraz parametry okresu wyczekiwania i wypłaty
                      chorobowego.
                    </p>

                    <div className="admin-fields-grid">
                      <label className="admin-field">
                        <span>Termin na wniosek o równą stawkę 81,5% po porodzie (dni)</span>
                        <input
                          type="number"
                          min={1}
                          value={draft.combinedRateApplicationDeadlineDays}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              combinedRateApplicationDeadlineDays: Number(e.target.value),
                            })
                          }
                        />
                      </label>

                      <label className="admin-field">
                        <span>Termin wniosku o urlop rodzicielski przed startem (dni)</span>
                        <input
                          type="number"
                          min={1}
                          value={draft.applicationDeadlinesDays.parentalLeave}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              applicationDeadlinesDays: {
                                ...draft.applicationDeadlinesDays,
                                parentalLeave: Number(e.target.value),
                              },
                            })
                          }
                        />
                      </label>

                      <label className="admin-field">
                        <span>Termin wniosku o urlop uzupełniający (dni)</span>
                        <input
                          type="number"
                          min={1}
                          value={draft.applicationDeadlinesDays.supplementaryMaternityLeave}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              applicationDeadlinesDays: {
                                ...draft.applicationDeadlinesDays,
                                supplementaryMaternityLeave: Number(e.target.value),
                              },
                            })
                          }
                        />
                      </label>

                      <label className="admin-field">
                        <span>Termin wniosku o urlop ojcowski przed startem (dni)</span>
                        <input
                          type="number"
                          min={1}
                          value={draft.applicationDeadlinesDays.paternityLeave}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              applicationDeadlinesDays: {
                                ...draft.applicationDeadlinesDays,
                                paternityLeave: Number(e.target.value),
                              },
                            })
                          }
                        />
                      </label>

                      <label className="admin-field">
                        <span>Okres wyczekiwania – chorobowe obowiązkowe (dni)</span>
                        <input
                          type="number"
                          min={0}
                          value={draft.sickness.waitingPeriodDaysMandatory}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              sickness: {
                                ...draft.sickness,
                                waitingPeriodDaysMandatory: Number(e.target.value),
                              },
                            })
                          }
                        />
                      </label>

                      <label className="admin-field">
                        <span>Okres wyczekiwania – chorobowe dobrowolne (dni)</span>
                        <input
                          type="number"
                          min={0}
                          value={draft.sickness.waitingPeriodDaysVoluntary}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              sickness: {
                                ...draft.sickness,
                                waitingPeriodDaysVoluntary: Number(e.target.value),
                              },
                            })
                          }
                        />
                      </label>

                      <label className="admin-field">
                        <span>Wynagrodzenie chorobowe od pracodawcy – do 50. r.ż. (dni)</span>
                        <input
                          type="number"
                          min={1}
                          value={draft.sickness.employerPaidDaysUnder50}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              sickness: {
                                ...draft.sickness,
                                employerPaidDaysUnder50: Number(e.target.value),
                              },
                            })
                          }
                        />
                      </label>

                      <label className="admin-field">
                        <span>Maksymalny okres zasiłkowy w ciąży (dni)</span>
                        <input
                          type="number"
                          min={1}
                          value={draft.sickness.maxBenefitPeriodDays}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              sickness: {
                                ...draft.sickness,
                                maxBenefitPeriodDays: Number(e.target.value),
                              },
                            })
                          }
                        />
                      </label>
                    </div>
                  </div>
                )}

                {activeTab === 'premature' && (
                  <div className="admin-tab-panel" role="tabpanel">
                    <h3 className="admin-section-title">
                      Tabela uzupełniającego urlopu macierzyńskiego (wcześniaki i hospitalizacja)
                    </h3>
                    <p className="admin-section-lead">
                      Maksymalny wymiar dodatkowego urlopu (w tygodniach) dla poszczególnych progów
                      medycznych oraz podgląd pliku konfiguracyjnego JSON.
                    </p>

                    <div className="admin-cases-list">
                      {draft.supplementaryMaternityLeave.cases.map((item, idx) => (
                        <div key={item.id} className="admin-case-row">
                          <div>
                            <strong>Próg #{item.id}:</strong> {item.description}
                          </div>
                          <label className="admin-field admin-field--compact">
                            <span>Limit (tygodnie)</span>
                            <input
                              type="number"
                              min={1}
                              aria-label={`Limit tygodni dla progu ${item.id}`}
                              value={item.limitWeekAfterBirth}
                              onChange={(e) => {
                                const nextCases = draft.supplementaryMaternityLeave.cases.map(
                                  (c, cIdx) =>
                                    cIdx === idx
                                      ? { ...c, limitWeekAfterBirth: Number(e.target.value) }
                                      : c,
                                );
                                setDraft({
                                  ...draft,
                                  supplementaryMaternityLeave: {
                                    ...draft.supplementaryMaternityLeave,
                                    cases: nextCases,
                                  },
                                });
                              }}
                            />
                          </label>
                        </div>
                      ))}
                    </div>

                    <h4 className="admin-json-title">
                      Podgląd pełnego pliku <code>shared/params.json</code>
                    </h4>
                    <pre className="admin-json-preview" aria-label="Podgląd JSON parametrów">
                      {JSON.stringify(draft, null, 2)}
                    </pre>
                  </div>
                )}
              </section>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}
