import { useCallback, useMemo } from 'react';
import { v4 as uuid } from 'uuid';
import { useProjectStore } from '../../../core/state/project-store';
import { useTransportStore } from '../../../core/state/transport-store';
import { useUIStore, SNAP_GRID_TICKS } from '../../../core/state/ui-store';
import { useHistoryStore } from '../../../core/state/history-middleware';
import { TICKS_PER_BEAT, NOTE_NAMES } from '../../../core/types/music';
import { NoteEvent } from '../../../core/types/project';
import { noteNameToMidi } from '../../../core/utils/note-utils';

interface ChordDef {
  name: string;
  symbol: string;
  intervals: number[];
}

const CHORD_TYPES: ChordDef[] = [
  { name: 'Major', symbol: '', intervals: [0, 4, 7] },
  { name: 'Minor', symbol: 'm', intervals: [0, 3, 7] },
  { name: 'Dim', symbol: 'dim', intervals: [0, 3, 6] },
  { name: 'Aug', symbol: 'aug', intervals: [0, 4, 8] },
  { name: 'Sus2', symbol: 'sus2', intervals: [0, 2, 7] },
  { name: 'Sus4', symbol: 'sus4', intervals: [0, 5, 7] },
  { name: 'Maj7', symbol: 'maj7', intervals: [0, 4, 7, 11] },
  { name: 'Min7', symbol: 'm7', intervals: [0, 3, 7, 10] },
  { name: 'Dom7', symbol: '7', intervals: [0, 4, 7, 10] },
  { name: 'Dim7', symbol: 'dim7', intervals: [0, 3, 6, 9] },
];

const NOTE_TO_SEMITONE: Record<string, number> = {
  'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
  'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11,
};

// Common chord progressions
const PROGRESSIONS: { name: string; numerals: string }[] = [
  { name: 'Pop (I-V-vi-IV)', numerals: '1-5-6m-4' },
  { name: 'Blues (I-IV-V)', numerals: '1-4-5' },
  { name: 'Jazz ii-V-I', numerals: '2m7-5-7-1maj7' },
  { name: 'Canon (I-V-vi-iii-IV-I-IV-V)', numerals: '1-5-6m-3m-4-1-4-5' },
  { name: 'Sad (vi-IV-I-V)', numerals: '6m-4-1-5' },
  { name: 'Rock (I-bVII-IV)', numerals: '1-b7-4' },
];

export function ChordLibrary() {
  const project = useProjectStore((s) => s.project);
  const selectedTrackId = useUIStore((s) => s.selectedTrackId);
  const setShowChordLibrary = useUIStore((s) => s.setShowChordLibrary);
  const snapGrid = useUIStore((s) => s.snapGrid);

  const rootKey = useMemo(() => {
    if (!project) return 'C';
    let key = project.key;
    if (key.endsWith('m')) key = key.slice(0, -1);
    return key;
  }, [project?.key]);

  const rootSemitone = NOTE_TO_SEMITONE[rootKey] ?? 0;

  // Build diatonic chords for the project key
  const majorScaleIntervals = [0, 2, 4, 5, 7, 9, 11];
  const diatonicQualities = ['', 'm', 'm', '', '', 'm', 'dim'];

  const diatonicChords = useMemo(() => {
    return majorScaleIntervals.map((interval, i) => {
      const chordRootSemitone = (rootSemitone + interval) % 12;
      const noteName = NOTE_NAMES[chordRootSemitone];
      const quality = diatonicQualities[i];
      const chordType = CHORD_TYPES.find((c) => c.symbol === quality) ?? CHORD_TYPES[0];
      return {
        label: `${noteName}${quality}`,
        rootSemitone: chordRootSemitone,
        intervals: chordType.intervals,
        degree: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'][i],
      };
    });
  }, [rootSemitone]);

  const insertChord = useCallback((rootSemitone: number, intervals: number[], octave: number = 4) => {
    if (!project || !selectedTrackId) return;

    const proj = useProjectStore.getState().project;
    if (proj) useHistoryStore.getState().pushSnapshot(proj);

    const currentTick = useTransportStore.getState().currentTick;
    const gridSnap = SNAP_GRID_TICKS[snapGrid];
    const insertTick = Math.round(currentTick / gridSnap) * gridSnap;
    const baseMidi = 12 * (octave + 1) + rootSemitone;

    const notes: NoteEvent[] = intervals.map((interval) => ({
      id: uuid(),
      pitch: baseMidi + interval,
      startTick: insertTick,
      durationTicks: TICKS_PER_BEAT,
      velocity: 90,
    }));

    for (const note of notes) {
      useProjectStore.getState().addNote(selectedTrackId, note);
    }
  }, [project, selectedTrackId, snapGrid]);

  const insertProgression = useCallback((numerals: string) => {
    if (!project || !selectedTrackId) return;

    const proj = useProjectStore.getState().project;
    if (proj) useHistoryStore.getState().pushSnapshot(proj);

    const currentTick = useTransportStore.getState().currentTick;
    const gridSnap = SNAP_GRID_TICKS[snapGrid];
    let insertTick = Math.round(currentTick / gridSnap) * gridSnap;

    const steps = numerals.split('-');
    for (const step of steps) {
      let degree = parseInt(step.replace(/[^0-9]/g, ''));
      if (isNaN(degree) || degree < 1 || degree > 7) continue;
      const flat = step.startsWith('b');
      const scaleInterval = majorScaleIntervals[degree - 1];
      const chordRoot = (rootSemitone + scaleInterval + (flat ? -1 : 0) + 12) % 12;

      // Determine quality from the step string
      let quality = '';
      if (step.includes('m7')) quality = 'm7';
      else if (step.includes('maj7')) quality = 'maj7';
      else if (step.includes('m')) quality = 'm';
      else if (step.includes('7')) quality = '7';
      else if (step.includes('dim')) quality = 'dim';

      const chordType = CHORD_TYPES.find((c) => c.symbol === quality) ?? CHORD_TYPES[0];
      const baseMidi = 12 * 5 + chordRoot; // octave 4

      for (const interval of chordType.intervals) {
        const note: NoteEvent = {
          id: uuid(),
          pitch: baseMidi + interval,
          startTick: insertTick,
          durationTicks: TICKS_PER_BEAT,
          velocity: 85,
        };
        useProjectStore.getState().addNote(selectedTrackId, note);
      }

      insertTick += TICKS_PER_BEAT; // advance one beat per chord
    }
  }, [project, selectedTrackId, snapGrid, rootSemitone]);

  if (!project) return null;

  return (
    <div className="w-56 border-l border-forge-border bg-forge-surface flex flex-col shrink-0 h-full">
      <div className="p-3 border-b border-forge-border flex items-center justify-between">
        <span className="text-sm font-semibold">Chords</span>
        <button onClick={() => setShowChordLibrary(false)} className="text-forge-muted hover:text-forge-text text-sm">
          x
        </button>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-4">
        {/* Key info */}
        <div className="text-xs text-forge-muted">
          Key: <span className="text-forge-text font-semibold">{project.key}</span>
        </div>

        {/* Diatonic chords */}
        <div>
          <h4 className="text-[10px] text-forge-muted uppercase tracking-wider mb-2">Diatonic Chords</h4>
          <div className="grid grid-cols-2 gap-1">
            {diatonicChords.map((chord) => (
              <button
                key={chord.label}
                onClick={() => insertChord(chord.rootSemitone, chord.intervals)}
                disabled={!selectedTrackId}
                className="px-2 py-1.5 rounded bg-forge-bg border border-forge-border text-xs hover:border-forge-accent/50 hover:bg-forge-accent/10 transition-colors disabled:opacity-40 text-left"
                title={`Insert ${chord.label} at playhead`}
              >
                <span className="font-semibold">{chord.label}</span>
                <span className="text-forge-muted ml-1">{chord.degree}</span>
              </button>
            ))}
          </div>
        </div>

        {/* All chord types on root */}
        <div>
          <h4 className="text-[10px] text-forge-muted uppercase tracking-wider mb-2">{rootKey} Chord Types</h4>
          <div className="grid grid-cols-2 gap-1">
            {CHORD_TYPES.map((chord) => (
              <button
                key={chord.symbol}
                onClick={() => insertChord(rootSemitone, chord.intervals)}
                disabled={!selectedTrackId}
                className="px-2 py-1 rounded bg-forge-bg border border-forge-border text-[11px] hover:border-forge-accent/50 hover:bg-forge-accent/10 transition-colors disabled:opacity-40"
                title={`Insert ${rootKey}${chord.symbol} at playhead`}
              >
                {rootKey}{chord.symbol}
              </button>
            ))}
          </div>
        </div>

        {/* Progressions */}
        <div>
          <h4 className="text-[10px] text-forge-muted uppercase tracking-wider mb-2">Progressions</h4>
          <div className="space-y-1">
            {PROGRESSIONS.map((prog) => (
              <button
                key={prog.name}
                onClick={() => insertProgression(prog.numerals)}
                disabled={!selectedTrackId}
                className="w-full px-2 py-1.5 rounded bg-forge-bg border border-forge-border text-[11px] text-left hover:border-forge-accent/50 hover:bg-forge-accent/10 transition-colors disabled:opacity-40"
                title={`Insert progression at playhead`}
              >
                {prog.name}
              </button>
            ))}
          </div>
        </div>

        {!selectedTrackId && (
          <p className="text-[10px] text-forge-muted text-center">
            Select a track to insert chords
          </p>
        )}
      </div>
    </div>
  );
}
