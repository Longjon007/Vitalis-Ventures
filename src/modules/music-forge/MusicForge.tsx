import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from '../../core/state/project-store';
import { useUIStore } from '../../core/state/ui-store';
import { useGlobalShortcuts } from '../../core/hooks/useGlobalShortcuts';
import { importMidiFile } from '../../core/import/midi-importer';
import { importAudioFile, isAudioFile, isMidiFile } from '../../core/import/audio-file-import';
import { TrackList } from './components/TrackList';
import { PianoRoll } from './components/PianoRoll';
import { TransportBar } from './components/TransportBar';
import { MixerPanel } from './components/MixerPanel';
import { EffectsPanel } from './components/EffectsPanel';

export function MusicForge() {
  useGlobalShortcuts();
  const navigate = useNavigate();
  const project = useProjectStore((s) => s.project);
  const selectedTrackId = useUIStore((s) => s.selectedTrackId);
  const setSelectedTrackId = useUIStore((s) => s.setSelectedTrackId);
  const [showMixer, setShowMixer] = useState(false);
  const [showEffects, setShowEffects] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (!project) {
      if (selectedTrackId !== null) {
        setSelectedTrackId(null);
      }
      return;
    }

    const selectedTrackExists =
      selectedTrackId !== null &&
      project.tracks.some((track) => track.id === selectedTrackId);

    if (!selectedTrackExists) {
      setSelectedTrackId(project.tracks[0]?.id ?? null);
    }
  }, [project, selectedTrackId, setSelectedTrackId]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    if (!project) return;
    const files = Array.from(e.dataTransfer.files);

    for (const file of files) {
      if (isMidiFile(file)) {
        try {
          const { tracks } = await importMidiFile(file);
          for (const track of tracks) {
            useProjectStore.setState((state) => {
              if (!state.project) return state;
              return {
                project: {
                  ...state.project,
                  updatedAt: Date.now(),
                  tracks: [...state.project.tracks, track],
                },
              };
            });
          }
          if (tracks.length > 0) {
            setSelectedTrackId(tracks[0].id);
          }
        } catch {
          // Invalid MIDI file — silently skip
        }
      } else if (isAudioFile(file)) {
        try {
          const track = await importAudioFile(file);
          useProjectStore.setState((state) => {
            if (!state.project) return state;
            return {
              project: {
                ...state.project,
                updatedAt: Date.now(),
                tracks: [...state.project.tracks, track],
              },
            };
          });
          setSelectedTrackId(track.id);
        } catch {
          // Invalid audio file — silently skip
        }
      }
    }
  }, [project, setSelectedTrackId]);

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
    <div
      className={`flex flex-col h-full ${dragOver ? 'ring-2 ring-forge-accent ring-inset' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <TransportBar
        onToggleMixer={() => setShowMixer(!showMixer)}
        showMixer={showMixer}
        onToggleEffects={() => setShowEffects(!showEffects)}
        showEffects={showEffects}
      />
      {showMixer && <MixerPanel />}
      <div className="flex flex-1 overflow-hidden">
        <TrackList />
        <div className="flex-1 overflow-auto">
          {dragOver ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center p-8 border-2 border-dashed border-forge-accent/40 rounded-xl">
                <p className="text-forge-accent font-medium">Drop audio or MIDI files here</p>
                <p className="text-xs text-forge-muted mt-1">.wav, .mp3, .ogg, .mid</p>
              </div>
            </div>
          ) : selectedTrack ? (
            <PianoRoll track={selectedTrack} />
          ) : (
            <div className="flex items-center justify-center h-full text-forge-muted">
              Select a track to edit
            </div>
          )}
        </div>
        {showEffects && selectedTrack && (
          <EffectsPanel
            trackId={selectedTrack.id}
            trackName={selectedTrack.name}
            onClose={() => setShowEffects(false)}
          />
        )}
      </div>
    </div>
  );
}
