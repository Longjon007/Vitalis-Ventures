import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuid } from 'uuid';
import * as Tone from 'tone';
import { useProjectStore } from '../../core/state/project-store';
import { useSubscriptionStore } from '../../core/state/subscription-store';
import { DrumEngine, DrumPattern, DrumSound, ALL_DRUM_SOUNDS, createEmptyPattern, PRESET_PATTERNS, DRUM_MIDI_MAP } from '../../core/audio/drum-engine';
import { INSTRUMENTS } from '../../core/types/instrument';
import { TICKS_PER_BEAT } from '../../core/types/music';
import { NoteEvent } from '../../core/types/project';
import { Button } from '../../components/Button';
import { UpgradePrompt } from '../../components/UpgradePrompt';

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

const DEFAULT_VELOCITY = 100;

export function DrumSequencer() {
  const navigate = useNavigate();
  const project = useProjectStore((s) => s.project);
  const canAccess = useSubscriptionStore((s) => s.canAccess);
  const [pattern, setPattern] = useState<DrumPattern>(() => ({
    ...createEmptyPattern(16, project?.tempo ?? 120),
    id: uuid(),
  }));
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [velocityEditTrack, setVelocityEditTrack] = useState<number | null>(null);

  const toggleStep = useCallback((trackIndex: number, stepIndex: number) => {
    setPattern((prev) => {
      const tracks = [...prev.tracks];
      const track = { ...tracks[trackIndex] };
      track.pattern = [...track.pattern];
      track.pattern[stepIndex] = track.pattern[stepIndex] ? 0 : DEFAULT_VELOCITY;
      tracks[trackIndex] = track;
      return { ...prev, tracks };
    });
  }, []);

  const setStepVelocity = useCallback((trackIndex: number, stepIndex: number, velocity: number) => {
    setPattern((prev) => {
      const tracks = [...prev.tracks];
      const track = { ...tracks[trackIndex] };
      track.pattern = [...track.pattern];
      track.pattern[stepIndex] = Math.max(0, Math.min(127, velocity));
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
        return presetTrack ? { ...t, ...presetTrack } : { ...t, pattern: Array(prev.steps).fill(0) };
      });
      return { ...prev, tracks, name: preset.name ?? prev.name };
    });
  }, []);

  const previewSound = useCallback(async (sound: DrumSound) => {
    await Tone.start();
    DrumEngine.previewSound(sound);
  }, []);

  const changeStepCount = useCallback((newSteps: number) => {
    setPattern((prev) => {
      const tracks = prev.tracks.map((t) => {
        const newPattern = Array(newSteps).fill(0);
        for (let i = 0; i < Math.min(t.pattern.length, newSteps); i++) {
          newPattern[i] = t.pattern[i];
        }
        return { ...t, pattern: newPattern };
      });
      return { ...prev, steps: newSteps, tracks };
    });
  }, []);

  const exportToProject = useCallback(() => {
    if (!project) return;
    // Convert drum pattern steps to MIDI NoteEvents on a single track
    const ticksPerStep = TICKS_PER_BEAT / 4; // 16th note = 120 ticks
    const notes: NoteEvent[] = [];

    for (const track of pattern.tracks) {
      if (track.muted) continue;
      const midiNote = DRUM_MIDI_MAP[track.sound];
      for (let step = 0; step < pattern.steps; step++) {
        const vel = track.pattern[step];
        if (!vel) continue;
        notes.push({
          id: uuid(),
          pitch: midiNote,
          startTick: step * ticksPerStep,
          durationTicks: ticksPerStep,
          velocity: vel,
        });
      }
    }

    useProjectStore.getState().addTrack(
      pattern.name || 'Drum Pattern',
      INSTRUMENTS.drums
    );

    // Get the newly added track and set its notes
    const updatedProject = useProjectStore.getState().project;
    if (updatedProject) {
      const newTrack = updatedProject.tracks[updatedProject.tracks.length - 1];
      useProjectStore.getState().updateTrackNotes(newTrack.id, notes);
    }

    navigate('/music');
  }, [project, pattern, navigate]);

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

  if (!canAccess('drumSequencer')) {
    return <UpgradePrompt feature="Drum Sequencer" />;
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

        {/* Step count */}
        <div className="flex items-center gap-1">
          <label className="text-xs text-forge-muted">Steps</label>
          <select
            value={pattern.steps}
            onChange={(e) => changeStepCount(Number(e.target.value))}
            className="bg-forge-bg border border-forge-border rounded px-1.5 py-0.5 text-xs"
          >
            <option value={8}>8</option>
            <option value={16}>16</option>
            <option value={32}>32</option>
            <option value={64}>64</option>
          </select>
        </div>

        {/* Swing */}
        <div className="flex items-center gap-1">
          <label className="text-xs text-forge-muted">Swing</label>
          <input
            type="range"
            min={0}
            max={100}
            value={pattern.swing}
            onChange={(e) => setPattern((p) => ({ ...p, swing: Number(e.target.value) }))}
            className="w-16 h-1 accent-forge-accent"
          />
          <span className="text-[10px] text-forge-muted w-7">{pattern.swing}%</span>
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
            tracks: p.tracks.map((t) => ({ ...t, pattern: Array(p.steps).fill(0) })),
          }))}
        >
          Clear All
        </Button>

        <div className="ml-auto">
          <Button size="sm" variant="secondary" onClick={exportToProject} title="Export drum pattern as a track in MusicForge">
            Export to Project
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto p-4">
        <div className="min-w-[540px]">
          {/* Step numbers */}
          <div className="flex mb-1">
            <div className="w-24 sm:w-28 shrink-0" />
            {Array.from({ length: pattern.steps }).map((_, i) => (
              <div
                key={i}
                className={`w-7 sm:w-9 text-center text-[10px] ${
                  i % 4 === 0 ? 'text-forge-text font-semibold' : 'text-forge-muted'
                }`}
              >
                {i + 1}
              </div>
            ))}
          </div>

          {pattern.tracks.map((track, trackIdx) => (
            <div key={track.sound}>
              <div className="flex items-center mb-1">
                <div className="w-24 sm:w-28 shrink-0 flex items-center gap-1 sm:gap-2 pr-2">
                  <button
                    onClick={() => previewSound(track.sound)}
                    className="text-[10px] px-1 py-0.5 rounded bg-forge-border text-forge-muted hover:text-forge-text"
                  >
                    {'|>'}
                  </button>
                  <span className="text-xs font-medium truncate flex-1">{SOUND_LABELS[track.sound]}</span>
                  <button
                    onClick={() => setVelocityEditTrack(velocityEditTrack === trackIdx ? null : trackIdx)}
                    className={`text-[10px] px-1 py-0.5 rounded ${
                      velocityEditTrack === trackIdx ? 'bg-forge-accent/20 text-forge-accent' : 'bg-forge-border text-forge-muted'
                    }`}
                    title="Edit velocity"
                  >
                    V
                  </button>
                  <button
                    onClick={() => toggleMute(trackIdx)}
                    className={`text-[10px] px-1 py-0.5 rounded ${
                      track.muted ? 'bg-forge-danger/20 text-forge-danger' : 'bg-forge-border text-forge-muted'
                    }`}
                  >
                    M
                  </button>
                </div>

                {track.pattern.map((vel, stepIdx) => {
                  const isBeat = stepIdx % 4 === 0;
                  const isCurrent = stepIdx === currentStep;
                  const isActive = vel > 0;
                  // Scale opacity by velocity
                  const opacity = isActive ? 0.4 + (vel / 127) * 0.6 : 1;
                  return (
                    <button
                      key={stepIdx}
                      onClick={() => toggleStep(trackIdx, stepIdx)}
                      className={`w-6 h-6 sm:w-8 sm:h-8 mx-0.5 rounded transition-all ${
                        isCurrent ? 'ring-1 ring-white/50' : ''
                      } ${
                        isActive
                          ? 'scale-95'
                          : isBeat
                          ? 'bg-forge-surface border border-forge-border hover:border-forge-accent/50'
                          : 'bg-forge-bg border border-forge-border/50 hover:border-forge-border'
                      }`}
                      style={isActive ? { backgroundColor: SOUND_COLORS[track.sound], opacity } : undefined}
                      title={isActive ? `Velocity: ${vel}` : undefined}
                    />
                  );
                })}
              </div>

              {/* Velocity edit row */}
              {velocityEditTrack === trackIdx && (
                <div className="flex items-end mb-2">
                  <div className="w-24 sm:w-28 shrink-0 pr-2 text-right">
                    <span className="text-[9px] text-forge-muted">vel</span>
                  </div>
                  {track.pattern.map((vel, stepIdx) => (
                    <div key={stepIdx} className="w-6 sm:w-8 mx-0.5 flex flex-col items-center">
                      <input
                        type="range"
                        min={0}
                        max={127}
                        value={vel}
                        onChange={(e) => setStepVelocity(trackIdx, stepIdx, Number(e.target.value))}
                        className="w-6 sm:w-8 h-12 accent-forge-accent"
                        style={{
                          writingMode: 'vertical-lr',
                          direction: 'rtl',
                          appearance: 'slider-vertical',
                          WebkitAppearance: 'slider-vertical',
                        } as React.CSSProperties}
                      />
                      <span className="text-[8px] text-forge-muted mt-0.5">{vel || '-'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
