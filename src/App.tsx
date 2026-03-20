import { Routes, Route, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { LandingPage } from './pages/LandingPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { PricingPage } from './pages/PricingPage';
import { StorePage } from './pages/StorePage';
import { AppBuilder } from './modules/app-builder/AppBuilder';
import { MusicForge } from './modules/music-forge/MusicForge';
import { TabForge } from './modules/tab-forge/TabForge';
import { DrumSequencer } from './modules/drum-sequencer/DrumSequencer';

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
      <Routes>
        <Route path="/builder" element={<AppBuilder />} />
        <Route path="/music" element={<MusicForge />} />
        <Route path="/tab" element={<TabForge />} />
        <Route path="/drums" element={<DrumSequencer />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/store" element={<StorePage />} />
      </Routes>
    </Layout>
  );
}
