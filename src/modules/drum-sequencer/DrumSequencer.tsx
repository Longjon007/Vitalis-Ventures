import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuid } from 'uuid';
import * as Tone from 'tone';
import { useProjectStore } from '../../core/state/project-store';
import { DrumEngine, DrumPattern, DrumSound, ALL_DRUM_SOUNDS, createEmptyPattern, PRESET_PATTERNS } from '../../core/audio/drum-engine';
import { Button } from '../../components/Button';

const SOUND_LABELS: Record<DrumSound, string> = {
  kick: 'Kick',
  snare: 'Snare',
  hihat: 'Hi-Hat',
  openhat: 'Open HH',
  clap: 'Clap',
  tom1: 'Tom 1',
  tom2: 'Tom 2',
  crash: 'Crash',
  ride: 'Ride',
};

const SOUND_COLORS: Record<DrumSound, string> = {
  kick: '#e17055',
  snare: '#fdcb6e',
  hihat: '#00b894',
  openhat: '#00cec9',
  clap: '#fd79a8',
  tom1: '#6c5ce7',
  tom2: '#a29bfe',
  crash: '#74b9ff',
  ride: '#55efc4',
};

export function DrumSequencer() {
  const navigate = useNavigate();
  const project = useProjectStore((s) => s.project);
  const [pattern, setPattern] = useState<DrumPattern>(() => ({
    ...createEmptyPattern(16, project?.tempo ?? 120),
    id: uuid(),
  }));
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);

  const toggleStep = useCallback((trackIndex: number, stepIndex: number) => {
    setPattern((prev) => {
      const tracks = [...prev.tracks];
      const track = { ...tracks[trackIndex] };
      track.pattern = [...track.pattern];
      track.pattern[stepIndex] = !track.pattern[stepIndex];
      tracks[trackIndex] = track;
      return { ...prev, tracks };
    });
  }, []);

  const toggleMute = useCallback((trackIndex: number) => {
    setPattern((prev) => {
      const tracks = [...prev.tracks];
      tracks[trackIndex] = { ...tracks[trackIndex], muted: !tracks[trackIndex].muted };
      return { ...prev, tracks };
    });
  }, []);

  const handlePlay = useCallback(async () => {
    await Tone.start();
    if (isPlaying) {
      Tone.getTransport().stop();
      Tone.getTransport().position = 0;
      DrumEngine.clearSchedule();
      setIsPlaying(false);
      setCurrentStep(-1);
    } else {
      Tone.getTransport().bpm.value = pattern.bpm;
      DrumEngine.schedulePattern(pattern);
      // Step tracking
      const stepDuration = (60 / pattern.bpm) / 4;
      let step = 0;
      const interval = setInterval(() => {
        if (!Tone.getTransport().state || Tone.getTransport().state !== 'started') {
          clearInterval(interval);
          return;
        }
        setCurrentStep(step % pattern.steps);
        step++;
      }, stepDuration * 1000);
      Tone.getTransport().start();
      setIsPlaying(true);
    }
  }, [isPlaying, pattern]);

  const loadPreset = useCallback((presetKey: string) => {
    const preset = PRESET_PATTERNS[presetKey];
    if (!preset) return;
    setPattern((prev) => {
      const tracks = prev.tracks.map((t) => {
        const presetTrack = preset.tracks?.find((pt) => pt.sound === t.sound);
        return presetTrack ? { ...t, ...presetTrack } : { ...t, pattern: Array(prev.steps).fill(false) };
      });
      return { ...prev, tracks, name: preset.name ?? prev.name };
    });
  }, []);

  const previewSound = useCallback(async (sound: DrumSound) => {
    await Tone.start();
    DrumEngine.previewSound(sound);
  }, []);

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">No Project Loaded</h2>
          <button onClick={() => navigate('/builder')} className="px-4 py-2 bg-forge-accent rounded-lg text-sm">
            Go to Builder
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-forge-surface border-b border-forge-border shrink-0 flex-wrap">
        <h2 className="text-sm font-semibold mr-2">Drum Sequencer</h2>
        <Button size="sm" variant={isPlaying ? 'primary' : 'secondary'} onClick={handlePlay}>
          {isPlaying ? 'Stop' : 'Play'}
        </Button>

        <div className="flex items-center gap-2">
          <label className="text-xs text-forge-muted">BPM</label>
          <input
            type="number"
            value={pattern.bpm}
            onChange={(e) => setPattern((p) => ({ ...p, bpm: Number(e.target.value) }))}
            min={40}
            max={240}
            className="w-16 bg-forge-bg border border-forge-border rounded px-2 py-1 text-sm text-center"
          />
        </div>

        <div className="h-4 w-px bg-forge-border" />

        <select
          onChange={(e) => loadPreset(e.target.value)}
          defaultValue=""
          className="bg-forge-bg border border-forge-border rounded px-2 py-1 text-xs"
        >
          <option value="" disabled>Load Preset...</option>
          {Object.entries(PRESET_PATTERNS).map(([key, p]) => (
            <option key={key} value={key}>{p.name}</option>
          ))}
        </select>

        <Button
          size="sm"
          variant="ghost"
          onClick={() => setPattern((p) => ({
            ...p,
            tracks: p.tracks.map((t) => ({ ...t, pattern: Array(p.steps).fill(false) })),
          }))}
        >
          Clear All
        </Button>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto p-4">
        <div className="min-w-max">
          {/* Step numbers */}
          <div className="flex mb-1">
            <div className="w-28 shrink-0" />
            {Array.from({ length: pattern.steps }).map((_, i) => (
              <div
                key={i}
                className={`w-9 text-center text-[10px] ${
                  i % 4 === 0 ? 'text-forge-text font-semibold' : 'text-forge-muted'
                }`}
              >
                {i + 1}
              </div>
            ))}
          </div>

          {pattern.tracks.map((track, trackIdx) => (
            <div key={track.sound} className="flex items-center mb-1">
              <div className="w-28 shrink-0 flex items-center gap-2 pr-2">
                <button
                  onClick={() => previewSound(track.sound)}
                  className="text-[10px] px-1 py-0.5 rounded bg-forge-border text-forge-muted hover:text-forge-text"
                >
                  {'|>'}
                </button>
                <span className="text-xs font-medium truncate flex-1">{SOUND_LABELS[track.sound]}</span>
                <button
                  onClick={() => toggleMute(trackIdx)}
                  className={`text-[10px] px-1 py-0.5 rounded ${
                    track.muted ? 'bg-forge-danger/20 text-forge-danger' : 'bg-forge-border text-forge-muted'
                  }`}
                >
                  M
                </button>
              </div>

              {track.pattern.map((active, stepIdx) => {
                const isBeat = stepIdx % 4 === 0;
                const isCurrent = stepIdx === currentStep;
                return (
                  <button
                    key={stepIdx}
                    onClick={() => toggleStep(trackIdx, stepIdx)}
                    className={`w-8 h-8 mx-0.5 rounded transition-all ${
                      isCurrent ? 'ring-1 ring-white/50' : ''
                    } ${
                      active
                        ? 'scale-95'
                        : isBeat
                        ? 'bg-forge-surface border border-forge-border hover:border-forge-accent/50'
                        : 'bg-forge-bg border border-forge-border/50 hover:border-forge-border'
                    }`}
                    style={active ? { backgroundColor: SOUND_COLORS[track.sound] } : undefined}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
