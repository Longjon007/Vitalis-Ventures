import { lazy, Suspense } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { useAutoSave } from './core/hooks/useAutoSave';

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

function AppRoutes() {
  // Auto-save current project every 30s
  useAutoSave();

  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/builder" element={<AppBuilder />} />
        <Route path="/music" element={<MusicForge />} />
        <Route path="/tab" element={<TabForge />} />
        <Route path="/drums" element={<DrumSequencer />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/store" element={<StorePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  const location = useLocation();
  const isLanding = location.pathname === '/';

  if (isLanding) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <AppRoutes />
    </Layout>
  );
}
