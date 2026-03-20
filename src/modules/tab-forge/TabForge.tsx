import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuid } from 'uuid';
import * as Tone from 'tone';
import { useProjectStore } from '../../core/state/project-store';
import { TabPosition, STRING_LABELS, STANDARD_TUNING, TUNING_PRESETS, StrumDirection } from '../../core/types/tab';
import { NOTE_DURATION_TICKS, NoteDuration } from '../../core/types/music';
import { INSTRUMENTS } from '../../core/types/instrument';
import { NoteEvent } from '../../core/types/project';
import { tabPositionToNotes } from '../../core/utils/chord-utils';
import { midiToNoteName } from '../../core/utils/note-utils';
import { TabGrid } from './components/TabGrid';
import { ChordLibrary } from './components/ChordLibrary';
import { TabToolbar } from './components/TabToolbar';
import { Button } from '../../components/Button';

// Clipboard for copy/paste
let tabClipboard: TabPosition[] = [];

export function TabForge() {
  const navigate = useNavigate();
  const project = useProjectStore((s) => s.project);

  const [positions, setPositions] = useState<TabPosition[]>(() => {
    return Array.from({ length: 16 }, (_, i) => ({
      id: uuid(),
      tick: i * NOTE_DURATION_TICKS.quarter,
      strings: [null, null, null, null, null, null],
      duration: 'quarter' as const,
      strum: undefined,
    }));
  });

  const [tuning, setTuning] = useState<number[]>(STANDARD_TUNING);
  const [focusedCell, setFocusedCell] = useState<{ string: number; position: number }>({
    string: 0,
    position: 0,
  });
  const [showChordLibrary, setShowChordLibrary] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<NoteDuration>('quarter');
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingStep, setPlayingStep] = useState(-1);
  const playbackRef = useRef<{ stop: boolean }>({ stop: false });

  // Undo/redo history
  const [undoStack, setUndoStack] = useState<TabPosition[][]>([]);
  const [redoStack, setRedoStack] = useState<TabPosition[][]>([]);

  const pushUndo = useCallback(() => {
    setUndoStack((prev) => [...prev.slice(-30), positions.map((p) => ({ ...p, strings: [...p.strings] }))]);
    setRedoStack([]);
  }, [positions]);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack((r) => [...r, positions.map((p) => ({ ...p, strings: [...p.strings] }))]);
    setUndoStack((u) => u.slice(0, -1));
    setPositions(prev);
  }, [undoStack, positions]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((u) => [...u, positions.map((p) => ({ ...p, strings: [...p.strings] }))]);
    setRedoStack((r) => r.slice(0, -1));
    setPositions(next);
  }, [redoStack, positions]);

  const updateCell = useCallback(
    (posIndex: number, stringIndex: number, fret: number | null) => {
      pushUndo();
      setPositions((prev) => {
        const updated = [...prev];
        const pos = { ...updated[posIndex] };
        pos.strings = [...pos.strings];
        pos.strings[stringIndex] = fret;
        updated[posIndex] = pos;
        return updated;
      });
    },
    [pushUndo]
  );

  const insertChord = useCallback(
    (frets: (number | null)[]) => {
      pushUndo();
      const posIndex = focusedCell.position;
      setPositions((prev) => {
        const updated = [...prev];
        const pos = { ...updated[posIndex] };
        pos.strings = [...frets];
        updated[posIndex] = pos;
        return updated;
      });
    },
    [focusedCell.position, pushUndo]
  );

  const addMeasure = useCallback(() => {
    pushUndo();
    const beatsPerMeasure = project?.timeSignature[0] ?? 4;
    const lastTick =
      positions.length > 0
        ? positions[positions.length - 1].tick + NOTE_DURATION_TICKS[selectedDuration]
        : 0;
    const newPositions: TabPosition[] = Array.from({ length: beatsPerMeasure }, (_, i) => ({
      id: uuid(),
      tick: lastTick + i * NOTE_DURATION_TICKS[selectedDuration],
      strings: [null, null, null, null, null, null],
      duration: selectedDuration,
      strum: undefined,
    }));
    setPositions((prev) => [...prev, ...newPositions]);
  }, [positions, project, selectedDuration, pushUndo]);

  const removeMeasure = useCallback(() => {
    const beatsPerMeasure = project?.timeSignature[0] ?? 4;
    if (positions.length <= beatsPerMeasure) return;
    pushUndo();
    setPositions((prev) => prev.slice(0, prev.length - beatsPerMeasure));
  }, [positions, project, pushUndo]);

  const changeTuning = useCallback((tuningKey: string) => {
    const preset = TUNING_PRESETS[tuningKey];
    if (preset) setTuning(preset.tuning);
  }, []);

  // Duration change for focused position
  const changePositionDuration = useCallback(
    (duration: NoteDuration) => {
      setSelectedDuration(duration);
      pushUndo();
      setPositions((prev) => {
        const updated = [...prev];
        if (focusedCell.position < updated.length) {
          const pos = { ...updated[focusedCell.position] };
          pos.duration = duration;
          updated[focusedCell.position] = pos;
        }
        return updated;
      });
    },
    [focusedCell.position, pushUndo]
  );

  // Strum direction toggle
  const toggleStrum = useCallback(() => {
    pushUndo();
    setPositions((prev) => {
      const updated = [...prev];
      if (focusedCell.position < updated.length) {
        const pos = { ...updated[focusedCell.position] };
        const cycle: (StrumDirection | undefined)[] = [undefined, 'down', 'up'];
        const currentIdx = cycle.indexOf(pos.strum);
        pos.strum = cycle[(currentIdx + 1) % cycle.length];
        updated[focusedCell.position] = pos;
      }
      return updated;
    });
  }, [focusedCell.position, pushUndo]);

  // Copy/paste measures
  const copyMeasure = useCallback(() => {
    const beatsPerMeasure = project?.timeSignature[0] ?? 4;
    const measureStart = Math.floor(focusedCell.position / beatsPerMeasure) * beatsPerMeasure;
    tabClipboard = positions.slice(measureStart, measureStart + beatsPerMeasure).map((p) => ({
      ...p,
      strings: [...p.strings],
    }));
  }, [focusedCell.position, positions, project]);

  const pasteMeasure = useCallback(() => {
    if (tabClipboard.length === 0) return;
    pushUndo();
    const beatsPerMeasure = project?.timeSignature[0] ?? 4;
    const measureStart = Math.floor(focusedCell.position / beatsPerMeasure) * beatsPerMeasure;
    setPositions((prev) => {
      const updated = [...prev];
      for (let i = 0; i < tabClipboard.length && measureStart + i < updated.length; i++) {
        updated[measureStart + i] = {
          ...tabClipboard[i],
          id: uuid(),
          tick: updated[measureStart + i].tick,
        };
      }
      return updated;
    });
  }, [focusedCell.position, project, pushUndo]);

  // Duplicate measure (insert after current)
  const duplicateMeasure = useCallback(() => {
    pushUndo();
    const beatsPerMeasure = project?.timeSignature[0] ?? 4;
    const measureStart = Math.floor(focusedCell.position / beatsPerMeasure) * beatsPerMeasure;
    const measure = positions.slice(measureStart, measureStart + beatsPerMeasure);
    const lastTick = positions.length > 0
      ? positions[positions.length - 1].tick + NOTE_DURATION_TICKS[selectedDuration]
      : 0;
    const duplicated = measure.map((p, i) => ({
      ...p,
      id: uuid(),
      tick: lastTick + i * NOTE_DURATION_TICKS[p.duration],
      strings: [...p.strings],
    }));
    setPositions((prev) => [...prev, ...duplicated]);
  }, [focusedCell.position, positions, project, selectedDuration, pushUndo]);

  // Tab playback using Tone.js
  const playTab = useCallback(async () => {
    if (isPlaying) {
      playbackRef.current.stop = true;
      setIsPlaying(false);
      setPlayingStep(-1);
      return;
    }

    await Tone.start();
    setIsPlaying(true);
    playbackRef.current.stop = false;

    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.005, decay: 0.2, sustain: 0.1, release: 0.5 },
    }).toDestination();
    synth.volume.value = -6;

    const bpm = project?.tempo ?? 120;
    const reversedTuning = [...tuning].reverse();

    for (let i = 0; i < positions.length; i++) {
      if (playbackRef.current.stop) break;
      setPlayingStep(i);

      const pos = positions[i];
      const durationTicks = NOTE_DURATION_TICKS[pos.duration];
      const durationSec = (durationTicks / 480) * (60 / bpm);

      // Collect all notes at this position
      const notes: string[] = [];
      for (let s = 0; s < pos.strings.length; s++) {
        const fret = pos.strings[s];
        if (fret !== null && fret >= 0) {
          const midi = reversedTuning[s] + fret;
          notes.push(midiToNoteName(midi));
        }
      }

      if (notes.length > 0) {
        if (pos.strum === 'down' || pos.strum === 'up') {
          // Strum: arpeggiate notes with slight delay
          const orderedNotes = pos.strum === 'down' ? [...notes].reverse() : notes;
          const strumDelay = Math.min(0.02, durationSec / (orderedNotes.length * 3));
          for (let n = 0; n < orderedNotes.length; n++) {
            synth.triggerAttackRelease(orderedNotes[n], durationSec * 0.8, Tone.now() + n * strumDelay);
          }
        } else {
          synth.triggerAttackRelease(notes, durationSec * 0.8);
        }
      }

      await new Promise((resolve) => setTimeout(resolve, durationSec * 1000));
    }

    setIsPlaying(false);
    setPlayingStep(-1);
    setTimeout(() => synth.dispose(), 2000);
  }, [isPlaying, positions, tuning, project]);

  const addTrack = useProjectStore((s) => s.addTrack);
  const updateTrackNotes = useProjectStore((s) => s.updateTrackNotes);

  const syncToMusicForge = useCallback(() => {
    if (!project) return;
    const allNotes: NoteEvent[] = [];
    for (const pos of positions) {
      const notes = tabPositionToNotes(pos, tuning);
      allNotes.push(...notes);
    }
    if (allNotes.length === 0) return;

    let guitarTrack = project.tracks.find(
      (t) => t.instrument.type === 'guitar'
    );
    if (guitarTrack) {
      updateTrackNotes(guitarTrack.id, allNotes);
    } else {
      addTrack('Guitar (Tab)', INSTRUMENTS.guitar);
      const updated = useProjectStore.getState().project;
      const newTrack = updated?.tracks[updated.tracks.length - 1];
      if (newTrack) {
        updateTrackNotes(newTrack.id, allNotes);
      }
    }
    navigate('/music');
  }, [project, positions, tuning, addTrack, updateTrackNotes, navigate]);

  // Keyboard navigation with undo/redo/copy/paste
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const ctrl = e.ctrlKey || e.metaKey;

      // Undo/Redo
      if (ctrl && e.key === 'z') {
        e.preventDefault();
        undo();
        return;
      }
      if (ctrl && e.key === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      // Copy/Paste measure
      if (ctrl && e.key === 'c') {
        e.preventDefault();
        copyMeasure();
        return;
      }
      if (ctrl && e.key === 'v') {
        e.preventDefault();
        pasteMeasure();
        return;
      }
      // Duplicate measure
      if (ctrl && e.key === 'd') {
        e.preventDefault();
        duplicateMeasure();
        return;
      }

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          setFocusedCell((prev) => ({
            ...prev,
            position: Math.min(prev.position + 1, positions.length - 1),
          }));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setFocusedCell((prev) => ({
            ...prev,
            position: Math.max(prev.position - 1, 0),
          }));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setFocusedCell((prev) => ({
            ...prev,
            string: Math.min(prev.string + 1, 5),
          }));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedCell((prev) => ({
            ...prev,
            string: Math.max(prev.string - 1, 0),
          }));
          break;
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          updateCell(focusedCell.position, focusedCell.string, null);
          break;
        case ' ':
          e.preventDefault();
          playTab();
          break;
        default:
          if (/^\d$/.test(e.key)) {
            e.preventDefault();
            const currentFret = positions[focusedCell.position]?.strings[focusedCell.string];
            if (currentFret !== null && currentFret < 3) {
              const newFret = currentFret * 10 + parseInt(e.key);
              if (newFret <= 24) {
                updateCell(focusedCell.position, focusedCell.string, newFret);
                return;
              }
            }
            updateCell(focusedCell.position, focusedCell.string, parseInt(e.key));
          }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedCell, positions, updateCell, undo, redo, copyMeasure, pasteMeasure, duplicateMeasure, playTab]);

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

  return (
    <div className="flex flex-col h-full">
      <TabToolbar
        onAddMeasure={addMeasure}
        onRemoveMeasure={removeMeasure}
        onChangeTuning={changeTuning}
        onToggleChordLibrary={() => setShowChordLibrary(!showChordLibrary)}
        positions={positions}
        projectName={project.name}
        currentTuning={tuning}
        onPlay={playTab}
        isPlaying={isPlaying}
        selectedDuration={selectedDuration}
        onDurationChange={changePositionDuration}
        onUndo={undo}
        onRedo={redo}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        onToggleStrum={toggleStrum}
        onCopyMeasure={copyMeasure}
        onPasteMeasure={pasteMeasure}
        onDuplicateMeasure={duplicateMeasure}
        hasClipboard={tabClipboard.length > 0}
      />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto p-4">
          <TabGrid
            positions={positions}
            focusedCell={focusedCell}
            onCellClick={(posIndex, stringIndex) =>
              setFocusedCell({ string: stringIndex, position: posIndex })
            }
            onCellChange={updateCell}
            beatsPerMeasure={project.timeSignature[0]}
            playingStep={playingStep}
          />

          <div className="mt-4 flex items-center gap-4 flex-wrap">
            <p className="text-xs text-forge-muted">
              Arrows: Navigate | 0-9: Fret | Del: Clear | Space: Play | Ctrl+Z/Y: Undo/Redo | Ctrl+C/V: Copy/Paste measure | Ctrl+D: Duplicate
            </p>
            <Button size="sm" variant="secondary" onClick={syncToMusicForge}>
              Sync to MusicForge
            </Button>
          </div>
        </div>

        {showChordLibrary && (
          <ChordLibrary
            onSelectChord={insertChord}
            onClose={() => setShowChordLibrary(false)}
          />
        )}
      </div>
    </div>
  );
}
