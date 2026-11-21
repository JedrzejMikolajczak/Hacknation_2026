import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import type { ApplicantRole, AuthSession, MockProfileSummary } from '@shared/types';
import { apiGet, apiPost } from '../../api/client';
import { useScenario } from '../../app/ScenarioContext';
import { parseSituation } from '../../app/situation';
import '../wizard/WizardPage.css';

const applicantOptions = [
  { role: 'MOTHER', label: 'Mama' },
  { role: 'FATHER', label: 'Tata' },
] as const;

export function LoginPage() {
  const { scenario, setSimulatedIdentity } = useScenario();
  const [query] = useSearchParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const requestedRoles = state?.applicantRoles;
  const availableApplicants = Array.isArray(requestedRoles)
    ? applicantOptions.filter(({ role }) => requestedRoles.includes(role))
    : applicantOptions;
  const [selectedRole, setSelectedRole] = useState<ApplicantRole | null>(null);
  const role = selectedRole ?? availableApplicants[0]?.role;
  const [profiles, setProfiles] = useState<MockProfileSummary[] | null>(null);
  const [selectedProfile, setSelectedProfile] = useState('');
  const profileId = selectedProfile || profiles?.[0]?.profileId;
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const mounted = useRef(false);
  const situation = parseSituation(query.get('situation')) ?? scenario.situation;
  const returnTo =
    typeof state?.returnTo === 'string' && /^\/plan\/applications(?:\?.*)?$/.test(state.returnTo)
      ? state.returnTo
      : situation
        ? `/wizard?situation=${situation}`
        : '/';

  useEffect(() => {
    mounted.current = true;
    let active = true;
    void apiGet<MockProfileSummary[]>('/mock/profiles')
      .then((items) => {
        if (!active) return;
        setProfiles(items);
        if (!items.length) setError('Brak dostępnych profili testowych.');
      })
      .catch(() => {
        if (active) {
          setProfiles([]);
          setError('Nie udało się pobrać profili testowych.');
        }
      });
    return () => {
      active = false;
      mounted.current = false;
    };
  }, []);

  async function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!role || !profileId || submitting) return;
    setError('');
    setSubmitting(true);
    try {
      const result = await apiPost<AuthSession>('/mock/login', { profile_id: profileId });
      if (!mounted.current) return;
      setSimulatedIdentity(role, result);
      navigate(returnTo, { replace: true });
    } catch {
      if (!mounted.current) return;
      setError('Nie udało się zalogować. Spróbuj ponownie.');
      setSubmitting(false);
    }
  }

  return (
    <main className="wizard__shell wizard__main">
      <form className="wizard__card" onSubmit={connect}>
        <h1>Logowanie przez mObywatela (symulacja)</h1>
        <p>
          Wybierz gotowy profil testowy. Imię, nazwisko, PESEL i data urodzenia zostaną przeniesione
          do danych wnioskodawcy.
        </p>
        <div className="wizard__input-group">
          <label className="wizard__field">
            Wnioskodawca
            <select
              value={role ?? ''}
              disabled={submitting || availableApplicants.length < 2}
              onChange={(event) => {
                const applicant = availableApplicants.find(({ role }) => role === event.target.value);
                if (applicant) setSelectedRole(applicant.role);
              }}
            >
              {availableApplicants.map(({ role, label }) => (
                <option key={role} value={role}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="wizard__field">
            Profil testowy
            <select
              value={profileId ?? ''}
              disabled={!profileId || submitting}
              onChange={(event) => setSelectedProfile(event.target.value)}
            >
              {!profileId && (
                <option value="">{profiles === null ? 'Wczytywanie…' : 'Brak profili'}</option>
              )}
              {profiles?.map((profile) => (
                <option key={profile.profileId} value={profile.profileId}>
                  {profile.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error && <p role="alert">{error}</p>}
        <div className="wizard__actions">
          <Link className="wizard__button wizard__button--secondary" to={returnTo}>
            Kontynuuj bez logowania
          </Link>
          <button
            className="wizard__button wizard__button--primary"
            type="submit"
            disabled={!role || !profileId || submitting}
          >
            {submitting ? 'Pobieranie danych…' : 'Przekaż dane testowe'}
          </button>
        </div>
      </form>
    </main>
  );
}
