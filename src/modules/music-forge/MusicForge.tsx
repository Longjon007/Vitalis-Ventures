import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from '../../core/state/project-store';
import { useUIStore } from '../../core/state/ui-store';
import { TrackList } from './components/TrackList';
import { PianoRoll } from './components/PianoRoll';
import { TransportBar } from './components/TransportBar';
import { MixerPanel } from './components/MixerPanel';

export function MusicForge() {
  const navigate = useNavigate();
  const project = useProjectStore((s) => s.project);
  const selectedTrackId = useUIStore((s) => s.selectedTrackId);
  const setSelectedTrackId = useUIStore((s) => s.setSelectedTrackId);
  const [showMixer, setShowMixer] = useState(false);

  useEffect(() => {
    if (project && project.tracks.length > 0 && !selectedTrackId) {
      setSelectedTrackId(project.tracks[0].id);
    }
  }, [project, selectedTrackId, setSelectedTrackId]);

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">No Project Loaded</h2>
          <p className="text-forge-muted mb-4">Create a project first using the App Builder.</p>
          <button
            onClick={() => navigate('/builder')}
            className="px-4 py-2 bg-forge-accent rounded-lg text-sm"
          >
            Go to Builder
          </button>
        </div>
      </div>
    );
  }

  const selectedTrack = project.tracks.find((t) => t.id === selectedTrackId);

  return (
    <div className="flex flex-col h-full">
      <TransportBar onToggleMixer={() => setShowMixer(!showMixer)} showMixer={showMixer} />
      {showMixer && <MixerPanel />}
      <div className="flex flex-1 overflow-hidden">
        <TrackList />
        <div className="flex-1 overflow-auto">
          {selectedTrack ? (
            <PianoRoll track={selectedTrack} />
          ) : (
            <div className="flex items-center justify-center h-full text-forge-muted">
              Select a track to edit
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
