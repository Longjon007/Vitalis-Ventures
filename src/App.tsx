import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AppBuilder } from './modules/app-builder/AppBuilder';
import { MusicForge } from './modules/music-forge/MusicForge';
import { TabForge } from './modules/tab-forge/TabForge';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<AppBuilder />} />
        <Route path="/music" element={<MusicForge />} />
        <Route path="/tab" element={<TabForge />} />
      </Routes>
    </Layout>
  );
}
