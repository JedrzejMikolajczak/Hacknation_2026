import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import type { ApplicantRole, InsuranceTitle, MockProfileSummary } from '@shared/types';
import { apiGet } from '../../api/client';
import { DEFAULT_PARAMS } from '../../app/benefitParams';
import { useScenario } from '../../app/ScenarioContext';
import { parseSituation } from '../../app/situation';
import { formatPln, formatPolishDate } from '../plan/planScenario';
import { computeAverageIncome, resolveRightArisesDate } from '../wizard/zusMerge';
import { ContributionDebtCertificate, SickLeavePreview } from './ZusSimulationPanels';
import '../wizard/WizardPage.css';
import './LoginPage.css';

const TITLE_LABELS: Record<InsuranceTitle, string> = {
  employment: 'Umowa o pracę',
  mandateContract: 'Umowa zlecenie',
  selfEmployed: 'Działalność gospodarcza (JDG)',
  none: 'Brak tytułu ubezpieczenia',
};

export function LoginPage() {
  const {
    scenario,
    manualForm,
    authSession,
    loginWithProfile,
    logoutMockSession,
    setSimulatedIdentity,
  } = useScenario();
  const [query] = useSearchParams();
  const { state } = useLocation();
  const navigate = useNavigate();

  const [profiles, setProfiles] = useState<MockProfileSummary[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [role, setRole] = useState<ApplicantRole | ''>('');
  const [name, setName] = useState('');
  const [pesel, setPesel] = useState('');

  const situation = parseSituation(query.get('situation')) ?? scenario.situation;
  const rawReturnTo = (state as { returnTo?: unknown } | null)?.returnTo;
  const returnTo =
    typeof rawReturnTo === 'string' && /^\/(?:plan\/applications|wizard)(?:\?.*)?$/.test(rawReturnTo)
      ? rawReturnTo
      : situation
        ? `/wizard?situation=${situation}`
        : '/';

  useEffect(() => {
    let active = true;
    void apiGet<MockProfileSummary[]>('/mock/profiles')
      .then((list) => {
        if (!active) return;
        setProfiles(list);
        if (list.length > 0) {
          setSelectedProfileId((current) => current || list[0].profileId);
        }
        setProfilesLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setProfilesError(
          'Nie udało się pobrać listy profili z API. Możesz uzupełnić dane ręcznie poniżej lub przejść bez logowania.',
        );
        setProfilesLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleProfileLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProfileId || loginBusy) return;
    setLoginBusy(true);
    setLoginError(null);
    try {
      await loginWithProfile(selectedProfileId, situation);
    } catch (error) {
      setLoginError(
        error instanceof Error ? error.message : 'Nie udało się zalogować wybranym profilem.',
      );
    } finally {
      setLoginBusy(false);
    }
  }

  function connectManualIdentity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!role || !name.trim() || (pesel && !/^\d{11}$/.test(pesel))) return;
    setSimulatedIdentity(role, { name: name.trim(), pesel });
    navigate(returnTo, { replace: true });
  }

  const conflictCount = Object.keys(manualForm?.pendingConflicts ?? {}).length;
  const activeMother = authSession?.profile.mother ?? null;
  const averageIncome = authSession ? computeAverageIncome(authSession.zusData.incomes) : null;
  const rightArisesDate = resolveRightArisesDate(scenario, manualForm?.answers);

  return (
    <div className="login-page">
      <div className="login-page__demo-strip">
        <div className="wizard__shell">
          Wersja demonstracyjna · logowanie mObywatel i dane ZUS są symulowane
        </div>
      </div>

      <header className="login-page__header">
        <div className="wizard__shell">
          <Link to={returnTo} className="wizard__back-link">
            ← Wróć
          </Link>
          <h1>Logowanie przez mObywatela (symulacja)</h1>
          <p>
            Wybierz profil demonstracyjny, aby pobrać symulowane dane z ZUS (ubezpieczenie,
            miesięczne zarobki, e-ZLA z kodem „B” i stan zadłużenia). W formularzu uzupełnimy
            wyłącznie puste pola — bez nadpisywania Twoich wpisów.
          </p>
        </div>
      </header>

      <main className="wizard__shell wizard__main">
        <div className="login-page__stack">
          <section className="wizard__card" aria-labelledby="mock-login-heading">
            <h2 id="mock-login-heading">Wybierz profil mObywatela (symulacja)</h2>

            {profilesLoading && <p role="status">Ładowanie profili demonstracyjnych…</p>}
            {profilesError && (
              <p className="wizard__notice" role="status">
                {profilesError}
              </p>
            )}

            {!profilesLoading && profiles.length > 0 && (
              <form onSubmit={handleProfileLogin} className="login-page__stack">
                <fieldset className="login-page__profile-list">
                  <legend className="visually-hidden">Profile demonstracyjne mObywatel</legend>
                  {profiles.map((item) => {
                    const checked = selectedProfileId === item.profileId;
                    return (
                      <label
                        key={item.profileId}
                        className={
                          checked
                            ? 'login-page__profile-option login-page__profile-option--selected'
                            : 'login-page__profile-option'
                        }
                      >
                        <input
                          type="radio"
                          name="mockProfile"
                          value={item.profileId}
                          checked={checked}
                          onChange={() => setSelectedProfileId(item.profileId)}
                        />
                        <span>{item.label}</span>
                      </label>
                    );
                  })}
                </fieldset>

                {loginError && (
                  <p className="wizard__error" role="alert">
                    {loginError}
                  </p>
                )}

                <div className="wizard__actions">
                  <button
                    type="submit"
                    className="wizard__button wizard__button--primary"
                    disabled={!selectedProfileId || loginBusy}
                  >
                    {loginBusy ? 'Pobieranie danych z ZUS…' : 'Zaloguj przez mObywatela (symulacja)'}
                  </button>
                  <Link className="wizard__button wizard__button--secondary" to={returnTo}>
                    Kontynuuj bez logowania
                  </Link>
                </div>
              </form>
            )}
          </section>

          {authSession && activeMother && (
            <section className="wizard__card" aria-labelledby="zus-session-heading">
              <div className="login-page__session-header">
                <h2 id="zus-session-heading">
                  Pobrano dane z ZUS: {authSession.profile.firstName}{' '}
                  {authSession.profile.lastName}
                </h2>
                <button
                  type="button"
                  className="wizard__edit"
                  onClick={logoutMockSession}
                >
                  Wyloguj profil demo
                </button>
              </div>

              <dl className="login-page__session-summary">
                <div>
                  <dt>Tytuł ubezpieczenia (ZUS)</dt>
                  <dd>{TITLE_LABELS[activeMother.insuranceTitle]}</dd>
                </div>
                {activeMother.insuredSince && (
                  <div>
                    <dt>Początek ubezpieczenia (ZUS)</dt>
                    <dd>{formatPolishDate(activeMother.insuredSince)}</dd>
                  </div>
                )}
                {activeMother.employerInsuredCount !== null && (
                  <div>
                    <dt>Osoby zgłoszone u płatnika (ZUS)</dt>
                    <dd>{activeMother.employerInsuredCount}</dd>
                  </div>
                )}
                {averageIncome !== null && (
                  <div>
                    <dt>
                      Średni przychód z ostatnich {authSession.zusData.incomes.length} mies. (ZUS)
                    </dt>
                    <dd>{formatPln(averageIncome)}</dd>
                  </div>
                )}
              </dl>

              {conflictCount > 0 && (
                <p className="wizard__notice" role="status">
                  Wykryto {conflictCount === 1 ? '1 rozbieżność' : `${conflictCount} rozbieżności`}{' '}
                  z wcześniej wpisanymi odpowiedziami. Twoje wpisy nie zostały nadpisane —
                  zdecydujesz o nich w formularzu.
                </p>
              )}

              {activeMother.insuranceTitle === 'selfEmployed' && (
                <ContributionDebtCertificate
                  payerName={`${authSession.profile.firstName} ${authSession.profile.lastName}`}
                  asOfDate={rightArisesDate}
                  contributionDebt={authSession.zusData.contributionDebt}
                  params={DEFAULT_PARAMS}
                />
              )}

              <SickLeavePreview certificates={authSession.zusData.sickLeaveCertificates} />

              <div className="wizard__actions">
                <button
                  type="button"
                  className="wizard__button wizard__button--primary"
                  onClick={() => navigate(returnTo, { replace: true })}
                >
                  {returnTo.startsWith('/plan/applications')
                    ? 'Wróć do wniosków →'
                    : 'Przejdź do formularza z danymi ZUS →'}
                </button>
              </div>
            </section>
          )}

          <form
            className="wizard__card login-page__divider-card"
            onSubmit={connectManualIdentity}
            aria-labelledby="manual-identity-heading"
          >
            <h2 id="manual-identity-heading">Dane testowe wnioskodawcy do wniosków</h2>
            <p className="wizard__help">
              Możesz też ręcznie przekazać dane testowe osoby składającej wniosek (np. drugiego
              rodzica). Dane trafiają wyłącznie do podglądu wniosków w pamięci przeglądarki.
            </p>
            <div className="wizard__input-group">
              <label className="wizard__field">
                Wnioskodawca
                <select
                  required
                  value={role}
                  onChange={(event) => {
                    const selected = event.target.value;
                    setRole(selected === 'MOTHER' || selected === 'FATHER' ? selected : '');
                  }}
                >
                  <option value="">Wybierz osobę</option>
                  <option value="MOTHER">Mama</option>
                  <option value="FATHER">Tata</option>
                </select>
              </label>
              <label className="wizard__field">
                Imię i nazwisko
                <input
                  required
                  type="text"
                  autoComplete="off"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <label className="wizard__field">
                PESEL (opcjonalnie)
                <input
                  type="text"
                  autoComplete="off"
                  inputMode="numeric"
                  pattern="[0-9]{11}"
                  maxLength={11}
                  value={pesel}
                  onChange={(event) => setPesel(event.target.value)}
                />
              </label>
            </div>
            <div className="wizard__actions">
              <Link className="wizard__button wizard__button--secondary" to={returnTo}>
                Kontynuuj bez logowania
              </Link>
              <button className="wizard__button wizard__button--primary" type="submit">
                Przekaż dane testowe
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
