import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuid } from 'uuid';
import { useProjectStore } from '../../core/state/project-store';
import { TabPosition, STRING_LABELS, STANDARD_TUNING, TUNING_PRESETS } from '../../core/types/tab';
import { NOTE_DURATION_TICKS } from '../../core/types/music';
import { INSTRUMENTS } from '../../core/types/instrument';
import { NoteEvent } from '../../core/types/project';
import { tabPositionToNotes } from '../../core/utils/chord-utils';
import { TabGrid } from './components/TabGrid';
import { ChordLibrary } from './components/ChordLibrary';
import { TabToolbar } from './components/TabToolbar';
import { Button } from '../../components/Button';

export function TabForge() {
  const navigate = useNavigate();
  const project = useProjectStore((s) => s.project);

  const [positions, setPositions] = useState<TabPosition[]>(() => {
    // Initialize with 16 empty positions (4 measures of 4/4)
    return Array.from({ length: 16 }, (_, i) => ({
      id: uuid(),
      tick: i * NOTE_DURATION_TICKS.quarter,
      strings: [null, null, null, null, null, null],
      duration: 'quarter' as const,
    }));
  });

  const [tuning, setTuning] = useState<number[]>(STANDARD_TUNING);
  const [focusedCell, setFocusedCell] = useState<{ string: number; position: number }>({
    string: 0,
    position: 0,
  });
  const [showChordLibrary, setShowChordLibrary] = useState(false);

  const updateCell = useCallback(
    (posIndex: number, stringIndex: number, fret: number | null) => {
      setPositions((prev) => {
        const updated = [...prev];
        const pos = { ...updated[posIndex] };
        pos.strings = [...pos.strings];
        pos.strings[stringIndex] = fret;
        updated[posIndex] = pos;
        return updated;
      });
    },
    []
  );

  const insertChord = useCallback(
    (frets: (number | null)[]) => {
      const posIndex = focusedCell.position;
      setPositions((prev) => {
        const updated = [...prev];
        const pos = { ...updated[posIndex] };
        pos.strings = [...frets];
        updated[posIndex] = pos;
        return updated;
      });
    },
    [focusedCell.position]
  );

  const addMeasure = useCallback(() => {
    const beatsPerMeasure = project?.timeSignature[0] ?? 4;
    const lastTick =
      positions.length > 0
        ? positions[positions.length - 1].tick + NOTE_DURATION_TICKS.quarter
        : 0;
    const newPositions: TabPosition[] = Array.from({ length: beatsPerMeasure }, (_, i) => ({
      id: uuid(),
      tick: lastTick + i * NOTE_DURATION_TICKS.quarter,
      strings: [null, null, null, null, null, null],
      duration: 'quarter' as const,
    }));
    setPositions((prev) => [...prev, ...newPositions]);
  }, [positions, project]);

  const removeMeasure = useCallback(() => {
    const beatsPerMeasure = project?.timeSignature[0] ?? 4;
    if (positions.length <= beatsPerMeasure) return;
    setPositions((prev) => prev.slice(0, prev.length - beatsPerMeasure));
  }, [positions, project]);

  const changeTuning = useCallback((tuningKey: string) => {
    const preset = TUNING_PRESETS[tuningKey];
    if (preset) setTuning(preset.tuning);
  }, []);

  const addTrack = useProjectStore((s) => s.addTrack);
  const updateTrackNotes = useProjectStore((s) => s.updateTrackNotes);

  const syncToMusicForge = useCallback(() => {
    if (!project) return;
    // Convert all tab positions to NoteEvents
    const allNotes: NoteEvent[] = [];
    for (const pos of positions) {
      const notes = tabPositionToNotes(pos, tuning);
      allNotes.push(...notes);
    }
    if (allNotes.length === 0) return;

    // Find existing guitar track or create one
    let guitarTrack = project.tracks.find(
      (t) => t.instrument.type === 'guitar'
    );
    if (guitarTrack) {
      updateTrackNotes(guitarTrack.id, allNotes);
    } else {
      addTrack('Guitar (Tab)', INSTRUMENTS.guitar);
      // Get the newly added track
      const updated = useProjectStore.getState().project;
      const newTrack = updated?.tracks[updated.tracks.length - 1];
      if (newTrack) {
        updateTrackNotes(newTrack.id, allNotes);
      }
    }
    navigate('/music');
  }, [project, positions, tuning, addTrack, updateTrackNotes, navigate]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

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
        default:
          if (/^\d$/.test(e.key)) {
            e.preventDefault();
            const currentFret = positions[focusedCell.position]?.strings[focusedCell.string];
            // Allow two-digit fret numbers
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
  }, [focusedCell, positions, updateCell]);

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
          />

          <div className="mt-4 flex items-center gap-4">
            <p className="text-xs text-forge-muted">
              Arrow keys: Navigate | Number keys: Enter fret | Delete: Clear
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
