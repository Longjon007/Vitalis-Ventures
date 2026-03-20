import { useEffect, useCallback, useState } from 'react';
import { useProjectStore } from '../../../core/state/project-store';
import { useTransportStore } from '../../../core/state/transport-store';
import { AudioEngine } from '../../../core/audio/audio-engine';
import { formatPosition } from '../../../core/utils/timing-utils';
import { downloadMidiJson } from '../../../core/export/midi-json-exporter';
import { Button } from '../../../components/Button';
import { Modal } from '../../../components/Modal';

interface TransportBarProps {
  onToggleMixer: () => void;
  showMixer: boolean;
}

export function TransportBar({ onToggleMixer, showMixer }: TransportBarProps) {
  const project = useProjectStore((s) => s.project);
  const setTempo = useProjectStore((s) => s.setTempo);
  const { isPlaying, currentTick, play, pause, stop, setCurrentTick } = useTransportStore();
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    AudioEngine.onPosition((tick) => {
      setCurrentTick(tick);
    });
  }, [setCurrentTick]);

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

  if (!project) return null;

  return (
    <>
      <div className="flex items-center gap-4 px-4 py-2 bg-forge-surface border-b border-forge-border shrink-0 flex-wrap">
        <div className="flex items-center gap-1">
          <Button size="sm" variant={isPlaying ? 'primary' : 'secondary'} onClick={handlePlay}>
            {isPlaying ? 'II' : '>'}
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
          <Button size="sm" variant="ghost" onClick={() => downloadMidiJson(project)}>
            Export
          </Button>
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
        </div>
      </Modal>
    </>
  );
}
