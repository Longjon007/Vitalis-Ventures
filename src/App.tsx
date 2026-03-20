import { Routes, Route, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { LandingPage } from './pages/LandingPage';
import { AppBuilder } from './modules/app-builder/AppBuilder';
import { MusicForge } from './modules/music-forge/MusicForge';
import { TabForge } from './modules/tab-forge/TabForge';

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
      </Routes>
    </Layout>
  );
}
