import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import type { ApplicantRole } from '@shared/types';
import { useScenario } from '../../app/ScenarioContext';
import { parseSituation } from '../../app/situation';
import '../wizard/WizardPage.css';

export function LoginPage() {
  const { scenario, setSimulatedIdentity } = useScenario();
  const [query] = useSearchParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const [role, setRole] = useState<ApplicantRole | ''>('');
  const [name, setName] = useState('');
  const [pesel, setPesel] = useState('');
  const situation = parseSituation(query.get('situation')) ?? scenario.situation;
  const returnTo =
    typeof state?.returnTo === 'string' && /^\/plan\/applications(?:\?.*)?$/.test(state.returnTo)
      ? state.returnTo
      : situation
        ? `/wizard?situation=${situation}`
        : '/';

  function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!role || !name.trim() || (pesel && !/^\d{11}$/.test(pesel))) return;
    setSimulatedIdentity(role, { name: name.trim(), pesel });
    navigate(returnTo, { replace: true });
  }

  return (
    <main className="wizard__shell wizard__main">
      <form className="wizard__card" onSubmit={connect}>
        <h1>Logowanie przez mObywatela (symulacja)</h1>
        <p>
          Wpisz dane testowe osoby składającej wniosek. Dane trafiają do podglądu wniosków i są
          dostępne do odświeżenia strony.
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
    </main>
  );
}
