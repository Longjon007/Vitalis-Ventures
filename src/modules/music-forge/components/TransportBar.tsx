import { useEffect, useCallback, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from '../../../core/state/project-store';
import { useTransportStore } from '../../../core/state/transport-store';
import { useSubscriptionStore } from '../../../core/state/subscription-store';
import { AudioEngine } from '../../../core/audio/audio-engine';
import { formatPosition } from '../../../core/utils/timing-utils';
import { downloadMidiJson } from '../../../core/export/midi-json-exporter';
import { downloadMidi } from '../../../core/export/midi-exporter';
import { downloadWav } from '../../../core/export/wav-exporter';
import { Button } from '../../../components/Button';
import { Modal } from '../../../components/Modal';

interface TransportBarProps {
  onToggleMixer: () => void;
  showMixer: boolean;
  onToggleEffects?: () => void;
  showEffects?: boolean;
}

export function TransportBar({ onToggleMixer, showMixer, onToggleEffects, showEffects }: TransportBarProps) {
  const navigate = useNavigate();
  const project = useProjectStore((s) => s.project);
  const setTempo = useProjectStore((s) => s.setTempo);
  const { isPlaying, currentTick, play, pause, stop, setCurrentTick } = useTransportStore();
  const canAccess = useSubscriptionStore((s) => s.canAccess);
  const [showHelp, setShowHelp] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

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
      pause();
    } else {
      AudioEngine.scheduleProject(project);
      AudioEngine.play();
      play();
    }
  }, [project, isPlaying, play, pause]);

  const handleStop = useCallback(() => {
    AudioEngine.stop();
    stop();
  }, [stop]);

  const handleTempoChange = useCallback(
    (bpm: number) => {
      setTempo(bpm);
      AudioEngine.setTempo(bpm);
    },
    [setTempo]
  );

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

  if (!project) return null;

  const canMidi = canAccess('midiExport');
  const canWav = canAccess('wavExport');
  const canEffects = canAccess('effectsChain');

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
          <h3 className="font-semibold text-forge-accent">Piano Roll</h3>
          <div className="grid grid-cols-2 gap-y-1 text-xs">
            <span className="text-forge-muted">Click empty area</span><span>Create note</span>
            <span className="text-forge-muted">Click note</span><span>Select note</span>
            <span className="text-forge-muted">Arrow Up/Down</span><span>Change pitch</span>
            <span className="text-forge-muted">Arrow Left/Right</span><span>Change duration</span>
            <span className="text-forge-muted">Delete / Backspace</span><span>Remove note</span>
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
