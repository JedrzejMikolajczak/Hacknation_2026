import { AdminPage } from '../features/admin/AdminPage';
import { Route, Routes, useLocation } from 'react-router-dom';
import { useGlobalReveal, useScrollToTopOnNavigate } from '../components/motion';
import { NotFoundPage } from '../components/NotFoundPage';
import { LandingPage } from '../features/landing/LandingPage';
import { CasesPage } from '../features/cases/CasesPage';
import { PlanPage } from '../features/plan/PlanPage';
import { WizardPage } from '../features/wizard/WizardPage';
import { GuidePage } from '../features/guide/GuidePage';
import { LoginPage } from '../features/login/LoginPage';

/** Pierwszy segment ścieżki – kroki planu (/plan/…) to jedna „strona”, więc nie odtwarzają jej wejścia. */
function routeGroup(pathname: string): string {
  const [, first] = pathname.split('/');
  return first ? `/${first}` : '/';
}

/** Routing zgodny z CONVENTIONS §7. */
export function App() {
  const { pathname } = useLocation();
  useGlobalReveal();
  useScrollToTopOnNavigate();

  return (
    <>
      <a
        className="skip-link"
        href="#main"
        onClick={(event) => {
          const main = document.getElementById('main');
          if (!main) return;
          event.preventDefault();
          main.focus();
        }}
      >
        Przejdź do treści
      </a>
      <div key={routeGroup(pathname)} className="ui-page">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/wizard" element={<WizardPage />} />
          <Route path="/plan" element={<PlanPage />} />
          <Route path="/plan/:tab" element={<PlanPage />} />
          <Route path="/guide/:slug?" element={<GuidePage />} />
          <Route path="/cases/:caseId?" element={<CasesPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </div>
    </>
  );
}
