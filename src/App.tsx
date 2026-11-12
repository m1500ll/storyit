import { SocialPause } from '@/components/layout/SocialPause';
import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { SubscriberGate } from '@/components/layout/SubscriberGate';
// Eager: it is the first page most visitors see, so it ships with the main bundle (no extra round trip before the hero paints).
import LandingPage from '@/pages/LandingPage';
import { AppShell } from '@/components/layout/AppShell';
import { RequireAuth } from '@/components/layout/RequireAuth';
import { ToastProvider } from '@/components/ui';
import { AuthProvider } from '@/lib/auth';
import { ThemeProvider } from '@/lib/theme';
import { SEO_PAGES } from '@/data/seoPages';

const AuthPage = lazy(() => import('@/pages/AuthPage'));
const SeoPage = lazy(() => import('@/pages/SeoPage'));
const PrivacyPage = lazy(() => import('@/pages/PrivacyPage'));
const TermsPage = lazy(() => import('@/pages/TermsPage'));
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const PromptStudioPage = lazy(() => import('@/pages/PromptStudioPage'));
const AnimatedStudioPage = lazy(() => import('@/pages/AnimatedStudioPage'));
const TranslatePage = lazy(() => import('@/pages/TranslatePage'));
const PartnerPage = lazy(() => import('@/pages/PartnerPage'));
const PartnersAdminPage = lazy(() => import('@/pages/PartnersAdminPage'));
const TrendsAdminPage = lazy(() => import('@/pages/TrendsAdminPage'));
const AccountsPage = lazy(() => import('@/pages/AccountsPage'));
const LibraryPage = lazy(() => import('@/pages/LibraryPage'));
const DistributePage = lazy(() => import('@/pages/DistributePage'));
const PublicationsPage = lazy(() => import('@/pages/PublicationsPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
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
            {SEO_PAGES.map((p) => <Route key={p.path} path={p.path} element={<SeoPage page={p} />} />)}
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/partner/:secret" element={<PartnerPage />} />
            <Route path="/app" element={<RequireAuth><AppShell /></RequireAuth>}>
              <Route index element={<DashboardPage />} />
              <Route path="accounts" element={<SocialPause><SubscriberGate><AccountsPage /></SubscriberGate></SocialPause>} />
              <Route path="studio" element={<AnimatedStudioPage />} />
              <Route path="translate" element={<TranslatePage />} />
              <Route path="partners" element={<PartnersAdminPage />} />
              <Route path="trends" element={<TrendsAdminPage />} />
              <Route path="studio/:projectId" element={<AnimatedStudioPage />} />
              {/* the old Gemini/Veo episode studio was replaced by the Animated Studio */}
              {['new', 'review', 'episodes', 'characters', 'stories/*'].map((p) => <Route key={p} path={p} element={<Navigate to="/app/studio" replace />} />)}
              <Route path="prompts" element={<PromptStudioPage />} />
              <Route path="prompts/:projectId" element={<PromptStudioPage />} />
              <Route path="library" element={<SubscriberGate><LibraryPage /></SubscriberGate>} />
              <Route path="distribute" element={<SubscriberGate><DistributePage /></SubscriberGate>} />
              <Route path="calendar" element={<SubscriberGate><PublicationsPage /></SubscriberGate>} />
              <Route path="history" element={<SubscriberGate><PublicationsPage history /></SubscriberGate>} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="billing" element={<BillingPage />} />
              <Route path="referrals" element={<Navigate to="/app" replace />} />
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
