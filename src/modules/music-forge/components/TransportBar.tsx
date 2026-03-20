import { useEffect, useCallback } from 'react';
import { useProjectStore } from '../../../core/state/project-store';
import { useTransportStore } from '../../../core/state/transport-store';
import { AudioEngine } from '../../../core/audio/audio-engine';
import { formatPosition } from '../../../core/utils/timing-utils';
import { downloadMidiJson } from '../../../core/export/midi-json-exporter';
import { Button } from '../../../components/Button';

export function TransportBar() {
  const project = useProjectStore((s) => s.project);
  const setTempo = useProjectStore((s) => s.setTempo);
  const { isPlaying, currentTick, play, pause, stop, setCurrentTick } = useTransportStore();

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
    <div className="flex items-center gap-4 px-4 py-2 bg-forge-surface border-b border-forge-border shrink-0">
      <div className="flex items-center gap-1">
        <Button size="sm" variant={isPlaying ? 'primary' : 'secondary'} onClick={handlePlay}>
          {isPlaying ? 'II' : '>'  }
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

      <div className="ml-auto">
        <Button size="sm" variant="ghost" onClick={() => downloadMidiJson(project)}>
          Export JSON
        </Button>
      </div>
    </div>
  );
}
