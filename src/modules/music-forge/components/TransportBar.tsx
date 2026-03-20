import { useEffect, useCallback, useState, useRef, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from '../../../core/state/project-store';
import { useTransportStore } from '../../../core/state/transport-store';
import { useSubscriptionStore } from '../../../core/state/subscription-store';
import { AudioEngine } from '../../../core/audio/audio-engine';
import { useHistoryStore } from '../../../core/state/history-middleware';
import { useUIStore, SNAP_GRID_TICKS, SnapGridSize } from '../../../core/state/ui-store';
import { formatPosition, ticksPerMeasure } from '../../../core/utils/timing-utils';
import { downloadMidiJson } from '../../../core/export/midi-json-exporter';
import { downloadMidi } from '../../../core/export/midi-exporter';
import { downloadWav } from '../../../core/export/wav-exporter';
import { Metronome } from '../../../core/audio/metronome';
import { importMidiFile } from '../../../core/import/midi-importer';
import { importAudioFile, isAudioFile, isMidiFile } from '../../../core/import/audio-file-import';
import { Button } from '../../../components/Button';
import { Modal } from '../../../components/Modal';

interface TransportBarProps {
  onToggleMixer: () => void;
  showMixer: boolean;
  onToggleEffects?: () => void;
  showEffects?: boolean;
  onToggleNotation?: () => void;
  showNotation?: boolean;
}

export function TransportBar({ onToggleMixer, showMixer, onToggleEffects, showEffects, onToggleNotation, showNotation }: TransportBarProps) {
  const navigate = useNavigate();
  const project = useProjectStore((s) => s.project);
  const setTempo = useProjectStore((s) => s.setTempo);
  const { isPlaying, currentTick, loop, play, pause, stop, setCurrentTick, setLoop, clearLoop } = useTransportStore();
  const canAccess = useSubscriptionStore((s) => s.canAccess);
  const snapGrid = useUIStore((s) => s.snapGrid);
  const setSnapGrid = useUIStore((s) => s.setSnapGrid);
  const showVelocityEditor = useUIStore((s) => s.showVelocityEditor);
  const setShowVelocityEditor = useUIStore((s) => s.setShowVelocityEditor);
  const selectedTrackId = useUIStore((s) => s.selectedTrackId);
  const [showHelp, setShowHelp] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [metronomeOn, setMetronomeOn] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const showChordLibrary = useUIStore((s) => s.showChordLibrary);
  const setShowChordLibrary = useUIStore((s) => s.setShowChordLibrary);

  useEffect(() => {
    AudioEngine.onPosition((tick) => {
      setCurrentTick(tick);
    });
  }, [setCurrentTick]);

  useEffect(() => {
    if (!showExport) return;
    const handleClick = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExport(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showExport]);

  const handlePlay = useCallback(async () => {
    if (!project) return;
    await AudioEngine.init();
    if (isPlaying) {
      AudioEngine.pause();
      Metronome.stop();
      pause();
    } else {
      // Apply loop if set
      const currentLoop = useTransportStore.getState().loop;
      if (currentLoop) {
        AudioEngine.setLoop(currentLoop.start, currentLoop.end, project.tempo);
      } else {
        AudioEngine.clearLoop();
      }
      AudioEngine.scheduleProject(project);
      AudioEngine.play();
      if (metronomeOn) {
        Metronome.start(project.tempo, project.timeSignature);
      }
      play();
    }
  }, [project, isPlaying, play, pause, metronomeOn]);

  const handleStop = useCallback(() => {
    AudioEngine.stop();
    Metronome.stop();
    stop();
  }, [stop]);

  const handleTempoChange = useCallback(
    (bpm: number) => {
      setTempo(bpm);
      AudioEngine.setTempo(bpm);
    },
    [setTempo]
  );

  const handleToggleLoop = useCallback(() => {
    if (!project) return;
    if (loop) {
      clearLoop();
      AudioEngine.clearLoop();
    } else {
      // Default: loop first 4 measures
      const tpm = ticksPerMeasure(project.timeSignature);
      const loopEnd = tpm * 4;
      setLoop(0, loopEnd);
      AudioEngine.setLoop(0, loopEnd, project.tempo);
    }
  }, [project, loop, setLoop, clearLoop]);

  const handleToggleMetronome = useCallback(async () => {
    if (!project) return;
    const next = !metronomeOn;
    setMetronomeOn(next);
    if (next && isPlaying) {
      await AudioEngine.init();
      Metronome.start(project.tempo, project.timeSignature);
    } else {
      Metronome.stop();
    }
  }, [metronomeOn, isPlaying, project]);

  const handleQuantize = useCallback(() => {
    if (!project || !selectedTrackId) return;
    const track = project.tracks.find((t) => t.id === selectedTrackId);
    if (!track || track.notes.length === 0) return;

    const snapTicks = SNAP_GRID_TICKS[snapGrid];
    const currentProject = useProjectStore.getState().project;
    if (currentProject) useHistoryStore.getState().pushSnapshot(currentProject);

    const quantizedNotes = track.notes.map((n) => ({
      ...n,
      startTick: Math.round(n.startTick / snapTicks) * snapTicks,
      durationTicks: Math.max(snapTicks, Math.round(n.durationTicks / snapTicks) * snapTicks),
    }));
    useProjectStore.getState().updateTrackNotes(selectedTrackId, quantizedNotes);
  }, [project, selectedTrackId, snapGrid]);

  const handleExportJson = useCallback(() => {
    if (!project) return;
    downloadMidiJson(project);
    setShowExport(false);
  }, [project]);

  const handleExportMidi = useCallback(() => {
    if (!project) return;
    downloadMidi(project);
    setShowExport(false);
  }, [project]);

  const handleExportWav = useCallback(async () => {
    if (!project) return;
    setExporting(true);
    try {
      await downloadWav(project);
    } finally {
      setExporting(false);
      setShowExport(false);
    }
  }, [project]);

  const handleFileImport = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !project) return;

    try {
      if (isMidiFile(file)) {
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
      } else if (isAudioFile(file)) {
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
      }
    } catch {
      // Failed to import
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [project]);

  if (!project) return null;

  const canMidi = canAccess('midiExport');
  const canWav = canAccess('wavExport');
  const canEffects = canAccess('effectsChain');

  const canUndoVal = useHistoryStore((s) => s.past.length > 0);
  const canRedoVal = useHistoryStore((s) => s.future.length > 0);

  const handleUndo = useCallback(() => {
    const currentProject = useProjectStore.getState().project;
    const restored = useHistoryStore.getState().undo();
    if (restored && currentProject) {
      useHistoryStore.setState((s) => ({
        future: [JSON.stringify(currentProject), ...s.future],
      }));
      useProjectStore.setState({ project: restored });
    }
  }, []);

  const handleRedo = useCallback(() => {
    const currentProject = useProjectStore.getState().project;
    const restored = useHistoryStore.getState().redo();
    if (restored && currentProject) {
      useHistoryStore.setState((s) => ({
        past: [...s.past, JSON.stringify(currentProject)],
      }));
      useProjectStore.setState({ project: restored });
    }
  }, []);

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-2 bg-forge-surface border-b border-forge-border shrink-0 flex-wrap">
        <div className="flex items-center gap-1">
          <Button size="sm" variant={isPlaying ? 'primary' : 'secondary'} onClick={handlePlay}>
            {isPlaying ? 'II' : '\u25B6'}
          </Button>
          <Button size="sm" variant="secondary" onClick={handleStop}>
            []
          </Button>
          <Button size="sm" variant="ghost" onClick={handleUndo} disabled={!canUndoVal} title="Undo (Ctrl+Z)">
            {'<'}
          </Button>
          <Button size="sm" variant="ghost" onClick={handleRedo} disabled={!canRedoVal} title="Redo (Ctrl+Y)">
            {'>'}
          </Button>
          <Button
            size="sm"
            variant={loop ? 'primary' : 'ghost'}
            onClick={handleToggleLoop}
            title={loop ? 'Disable loop' : 'Loop first 4 bars'}
          >
            Loop
          </Button>
          <Button
            size="sm"
            variant={metronomeOn ? 'primary' : 'ghost'}
            onClick={handleToggleMetronome}
            title={metronomeOn ? 'Metronome off' : 'Metronome on'}
          >
            Met
          </Button>
        </div>

        <div className="text-sm font-mono bg-forge-bg px-3 py-1 rounded">
          {formatPosition(currentTick, project.timeSignature)}
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-forge-muted">BPM</label>
          <input
            type="number"
            value={project.tempo}
            onChange={(e) => handleTempoChange(Number(e.target.value))}
            min={20}
            max={300}
            className="w-16 bg-forge-bg border border-forge-border rounded px-2 py-1 text-sm text-center"
          />
        </div>

        <div className="text-xs text-forge-muted">
          {project.timeSignature[0]}/{project.timeSignature[1]} | Key: {project.key}
        </div>

        {/* Snap Grid */}
        <div className="flex items-center gap-1">
          <label className="text-xs text-forge-muted">Snap</label>
          <select
            value={snapGrid}
            onChange={(e) => setSnapGrid(e.target.value as SnapGridSize)}
            className="bg-forge-bg border border-forge-border rounded px-1.5 py-0.5 text-xs"
          >
            <option value="1/4">1/4</option>
            <option value="1/8">1/8</option>
            <option value="1/16">1/16</option>
            <option value="1/32">1/32</option>
            <option value="off">Off</option>
          </select>
        </div>

        {/* Quantize */}
        <Button size="sm" variant="ghost" onClick={handleQuantize} title="Quantize selected track to grid">
          Q
        </Button>

        {/* Velocity Editor */}
        <Button
          size="sm"
          variant={showVelocityEditor ? 'primary' : 'ghost'}
          onClick={() => setShowVelocityEditor(!showVelocityEditor)}
          title="Toggle velocity editor"
        >
          Vel
        </Button>

        {/* Import file */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".mid,.midi,.wav,.mp3,.ogg"
          onChange={handleFileImport}
          className="hidden"
        />
        <Button size="sm" variant="ghost" onClick={() => fileInputRef.current?.click()} title="Import MIDI/Audio file">
          Import
        </Button>

        {/* Chord Library */}
        <Button
          size="sm"
          variant={showChordLibrary ? 'primary' : 'ghost'}
          onClick={() => setShowChordLibrary(!showChordLibrary)}
          title="Chord Library"
        >
          Chords
        </Button>

        {/* Notation toggle */}
        {onToggleNotation && (
          <Button
            size="sm"
            variant={showNotation ? 'primary' : 'ghost'}
            onClick={onToggleNotation}
            title="Toggle notation view"
          >
            Notes
          </Button>
        )}

        <div className="ml-auto flex items-center gap-1">
          <Button
            size="sm"
            variant={showMixer ? 'primary' : 'ghost'}
            onClick={onToggleMixer}
          >
            Mixer
          </Button>
          {onToggleEffects && (
            <Button
              size="sm"
              variant={showEffects ? 'primary' : 'ghost'}
              onClick={canEffects ? onToggleEffects : undefined}
              disabled={!canEffects}
              title={!canEffects ? 'Effects require Pro plan' : undefined}
            >
              FX
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate('/ai')}
            title="AI Music Generation"
          >
            AI
          </Button>

          {/* Export dropdown */}
          <div className="relative" ref={exportRef}>
            <Button size="sm" variant="ghost" onClick={() => setShowExport(!showExport)}>
              {exporting ? 'Exporting...' : 'Export'}
            </Button>
            {showExport && (
              <div className="absolute right-0 top-full mt-1 bg-forge-surface border border-forge-border rounded-lg shadow-lg py-1 z-50 min-w-[180px]">
                <button
                  onClick={handleExportJson}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-white/5 transition-colors"
                >
                  JSON (Project)
                </button>
                <button
                  onClick={canMidi ? handleExportMidi : undefined}
                  disabled={!canMidi}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-white/5 transition-colors disabled:opacity-40"
                >
                  MIDI File {!canMidi && <span className="text-[10px] text-forge-accent ml-1">Pro</span>}
                </button>
                <button
                  onClick={canWav ? handleExportWav : undefined}
                  disabled={!canWav || exporting}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-white/5 transition-colors disabled:opacity-40"
                >
                  Audio (WebM) {!canWav && <span className="text-[10px] text-forge-accent ml-1">Pro</span>}
                </button>
              </div>
            )}
          </div>

          <Button size="sm" variant="ghost" onClick={() => setShowHelp(true)}>
            ?
          </Button>
        </div>
      </div>

      <Modal open={showHelp} onClose={() => setShowHelp(false)} title="Keyboard Shortcuts">
        <div className="space-y-3 text-sm">
          <h3 className="font-semibold text-forge-accent">Global</h3>
          <div className="grid grid-cols-2 gap-y-1 text-xs">
            <span className="text-forge-muted">Space</span><span>Play / Pause</span>
            <span className="text-forge-muted">Ctrl+Z</span><span>Undo</span>
            <span className="text-forge-muted">Ctrl+Y</span><span>Redo</span>
            <span className="text-forge-muted">Ctrl+S</span><span>Save</span>
          </div>
          <h3 className="font-semibold text-forge-accent mt-4">Piano Roll</h3>
          <div className="grid grid-cols-2 gap-y-1 text-xs">
            <span className="text-forge-muted">Click empty area</span><span>Create note</span>
            <span className="text-forge-muted">Click note</span><span>Select note</span>
            <span className="text-forge-muted">Shift+Click</span><span>Toggle selection</span>
            <span className="text-forge-muted">Shift+Drag empty</span><span>Rubber-band select</span>
            <span className="text-forge-muted">Drag note</span><span>Move note</span>
            <span className="text-forge-muted">Drag note edge</span><span>Resize note</span>
            <span className="text-forge-muted">Ctrl+Scroll</span><span>Zoom in/out</span>
            <span className="text-forge-muted">Ctrl+C / Ctrl+V</span><span>Copy / Paste</span>
            <span className="text-forge-muted">Ctrl+A</span><span>Select all</span>
            <span className="text-forge-muted">Arrow Up/Down</span><span>Change pitch</span>
            <span className="text-forge-muted">Arrow Left/Right</span><span>Change duration</span>
            <span className="text-forge-muted">Delete / Backspace</span><span>Remove note(s)</span>
          </div>
          <h3 className="font-semibold text-forge-accent mt-4">TabForge</h3>
          <div className="grid grid-cols-2 gap-y-1 text-xs">
            <span className="text-forge-muted">Arrow keys</span><span>Navigate grid</span>
            <span className="text-forge-muted">0-9</span><span>Enter fret number</span>
            <span className="text-forge-muted">Delete / Backspace</span><span>Clear cell</span>
          </div>
          <h3 className="font-semibold text-forge-accent mt-4">Scale Highlighting</h3>
          <div className="text-xs text-forge-muted">
            <p>Piano roll rows are highlighted based on your project key. Brighter rows = in scale. Notes outside the scale appear reddish.</p>
          </div>
        </div>
      </Modal>
    </>
  );
}
