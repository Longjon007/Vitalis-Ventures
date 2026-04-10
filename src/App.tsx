import { lazy, Suspense, useEffect, useRef } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Layout } from './components/Layout';
import { useAutoSave } from './core/hooks/useAutoSave';
import { useAuthStore } from './core/state/auth-store';
import { trackEvent } from './core/analytics/tracker';

// Eager-load landing (first paint)
import { LandingPage } from './pages/LandingPage';

// Lazy-load all app routes for code splitting
const AppBuilder = lazy(() => import('./modules/app-builder/AppBuilder').then((m) => ({ default: m.AppBuilder })));
const MusicForge = lazy(() => import('./modules/music-forge/MusicForge').then((m) => ({ default: m.MusicForge })));
const TabForge = lazy(() => import('./modules/tab-forge/TabForge').then((m) => ({ default: m.TabForge })));
const DrumSequencer = lazy(() => import('./modules/drum-sequencer/DrumSequencer').then((m) => ({ default: m.DrumSequencer })));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage').then((m) => ({ default: m.ProjectsPage })));
const PricingPage = lazy(() => import('./pages/PricingPage').then((m) => ({ default: m.PricingPage })));
const StorePage = lazy(() => import('./pages/StorePage').then((m) => ({ default: m.StorePage })));
const AiForge = lazy(() => import('./modules/ai-forge/AiForge').then((m) => ({ default: m.AiForge })));
const DashboardPage = lazy(() => import('./pages/app/dashboard-page'));
const CreatePage = lazy(() => import('./pages/app/create-page'));
const AccountPage = lazy(() => import('./pages/app/account-page'));
const DiagnosticsPage = lazy(() => import('./pages/app/diagnostics-page'));
const SettingsPage = lazy(() => import('./pages/app/settings-page'));
const LoginPage = lazy(() => import('./pages/auth/login-page'));
const SignupPage = lazy(() => import('./pages/auth/signup-page'));
const ResetPasswordPage = lazy(() => import('./pages/auth/reset-password-page'));
const GenerationPage = lazy(() => import('./pages/public/generation-page'));
const ProfilePage = lazy(() => import('./pages/public/profile-page'));
const ExplorePage = lazy(() => import('./pages/public/explore-page'));
const MarketplacePage = lazy(() => import('./pages/public/marketplace-page'));
function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-forge-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-forge-muted">Loading...</p>
      </div>
    </div>
  );
}

function NotFoundPage() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <h2 className="text-4xl font-bold text-forge-muted mb-2">404</h2>
        <p className="text-forge-muted mb-4">Page not found</p>
        <a href="/builder" className="text-forge-accent hover:underline text-sm">
          Go to Builder
        </a>
      </div>
    </div>
  );
}
function ProtectedAppRoute({ children }: { children: JSX.Element }) {
  const status = useAuthStore((s) => s.status);
  const session = useAuthStore((s) => s.session);

  if (status === 'loading') {
    return <LoadingFallback />;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AppRoutes() {
  // Auto-save current project every 30s
  useAutoSave();

  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        <Route
          path="/app"
          element={
            <ProtectedAppRoute>
              <DashboardPage />
            </ProtectedAppRoute>
          }
        />
        <Route
          path="/app/create"
          element={
            <ProtectedAppRoute>
              <CreatePage />
            </ProtectedAppRoute>
          }
        />
        <Route
          path="/app/account"
          element={
            <ProtectedAppRoute>
              <AccountPage />
            </ProtectedAppRoute>
          }
        />
        <Route
          path="/app/diagnostics"
          element={
            <ProtectedAppRoute>
              <DiagnosticsPage />
            </ProtectedAppRoute>
          }
        />
        <Route
          path="/app/settings"
          element={
            <ProtectedAppRoute>
              <SettingsPage />
            </ProtectedAppRoute>
          }
        />

        <Route path="/builder" element={<AppBuilder />} />
        <Route path="/music" element={<MusicForge />} />
        <Route path="/tab" element={<TabForge />} />
        <Route path="/drums" element={<DrumSequencer />} />
        <Route path="/ai" element={<AiForge />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/store" element={<StorePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

function PublicRoutes() {
  return (
    <>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/g/:id" element={<GenerationPage />} />
          <Route path="/u/:username" element={<ProfilePage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/marketplace" element={<MarketplacePage />} />
        </Routes>
      </Suspense>
      <SpeedInsights />
    </>
  );
}

export default function App() {
  const location = useLocation();
  const lastTrackedPathRef = useRef<string | null>(null);
  const isPublicStandalone =
    location.pathname === '/' ||
    location.pathname === '/explore' ||
    location.pathname === '/marketplace' ||
    location.pathname.startsWith('/g/') ||
    location.pathname.startsWith('/u/');
  const initAuth = useAuthStore((s) => s.initialize);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  useEffect(() => {
    const routeKey = `${location.pathname}${location.search}`;
    if (lastTrackedPathRef.current === routeKey) return;

    lastTrackedPathRef.current = routeKey;
    trackEvent('page_view', {
      pathname: location.pathname,
      search: location.search || undefined,
    });
  }, [location.pathname, location.search]);

  if (isPublicStandalone) {
    return <PublicRoutes />;
  }

  return (
    <>
      <Layout>
        <AppRoutes />
      </Layout>
      <SpeedInsights />
    </>
  );
}
