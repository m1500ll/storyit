import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';

const LandingPage = lazy(() => import('@/pages/LandingPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const CreateStoryWizardPage = lazy(() => import('@/pages/CreateStoryWizardPage'));
const SceneEditorPage = lazy(() => import('@/pages/SceneEditorPage'));
const ReviewQueuePage = lazy(() => import('@/pages/ReviewQueuePage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="min-h-screen bg-ink-950" />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/app" element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="new" element={<CreateStoryWizardPage />} />
            <Route path="review" element={<ReviewQueuePage />} />
            <Route path="stories/:storyId" element={<SceneEditorPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
