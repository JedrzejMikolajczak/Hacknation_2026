import { Route, Routes } from 'react-router-dom';
import { PlaceholderPage } from '../components/PlaceholderPage';
import { LandingPage } from '../features/landing/LandingPage';
import { WizardPage } from '../features/wizard/WizardPage';

/** Routing zgodny z CONVENTIONS §7. */
export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<PlaceholderPage />} />
      <Route path="/wizard" element={<WizardPage />} />
      <Route path="/plan" element={<PlaceholderPage />} />
      <Route path="/plan/:tab" element={<PlaceholderPage />} />
      <Route path="/guide" element={<PlaceholderPage />} />
      <Route path="/guide/:slug" element={<PlaceholderPage />} />
      <Route path="/cases" element={<PlaceholderPage />} />
      <Route path="/cases/:caseId" element={<PlaceholderPage />} />
      <Route path="/admin" element={<PlaceholderPage />} />
      <Route path="*" element={<PlaceholderPage />} />
    </Routes>
  );
}
