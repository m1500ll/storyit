import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { RequireAuth } from '@/components/layout/RequireAuth';
import { ToastProvider } from '@/components/ui';
import { AuthProvider } from '@/lib/auth';
import { ThemeProvider } from '@/lib/theme';

const LandingPage = lazy(() => import('@/pages/LandingPage'));
const AuthPage = lazy(() => import('@/pages/AuthPage'));
const PrivacyPage = lazy(() => import('@/pages/PrivacyPage'));
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const CreateStoryWizardPage = lazy(() => import('@/pages/CreateStoryWizardPage'));
const SceneEditorPage = lazy(() => import('@/pages/SceneEditorPage'));
const PublishPage = lazy(() => import('@/pages/PublishPage'));
const ReviewQueuePage = lazy(() => import('@/pages/ReviewQueuePage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const EpisodesPage = lazy(() => import('@/pages/EpisodesPage'));
const CharactersPage = lazy(() => import('@/pages/CharactersPage'));
const BillingPage = lazy(() => import('@/pages/BillingPage'));
const MonetisationPage = lazy(() => import('@/pages/MonetisationPage'));
const GuidePage = lazy(() => import('@/pages/GuidePage'));
const HelpPage = lazy(() => import('@/pages/HelpPage'));

export default function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <ToastProvider>
      <BrowserRouter>
        <Suspense fallback={<div className="min-h-screen bg-ink-950" />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<AuthPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/app" element={<RequireAuth><AppShell /></RequireAuth>}>
              <Route index element={<DashboardPage />} />
              <Route path="new" element={<CreateStoryWizardPage />} />
              <Route path="review" element={<ReviewQueuePage />} />
              <Route path="stories/:storyId" element={<SceneEditorPage />} />
              <Route path="stories/:storyId/publish" element={<PublishPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="episodes" element={<EpisodesPage />} />
              <Route path="characters" element={<CharactersPage />} />
              <Route path="billing" element={<BillingPage />} />
              <Route path="monetisation" element={<MonetisationPage />} />
              <Route path="guide" element={<GuidePage />} />
              <Route path="help" element={<HelpPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
    </ThemeProvider>
  );
}
