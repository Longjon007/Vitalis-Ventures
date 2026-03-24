import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { v4 as uuid } from 'uuid';
import { Track, NoteEvent } from '../../../core/types/project';
import { useProjectStore } from '../../../core/state/project-store';
import { useTransportStore } from '../../../core/state/transport-store';
import { useHistoryStore } from '../../../core/state/history-middleware';
import { useUIStore } from '../../../core/state/ui-store';
import { midiToNoteName, isBlackKey } from '../../../core/utils/note-utils';
import { TICKS_PER_BEAT } from '../../../core/types/music';
import { getScaleNotes, isInScale } from '../../../core/types/scales';
import { WaveformCanvas } from './WaveformCanvas';

const NOTE_HEIGHT = 14;
const BASE_TICK_WIDTH = 0.15;
const MIN_PITCH = 36; // C2
const MAX_PITCH = 84; // C6
const PITCH_RANGE = MAX_PITCH - MIN_PITCH;
const GRID_SNAP = TICKS_PER_BEAT / 4; // sixteenth note
const RESIZE_HANDLE_PX = 8;

type InteractionMode = 'idle' | 'creating' | 'dragging' | 'resizing' | 'selecting';

interface DragState {
  mode: InteractionMode;
  noteId?: string;
  startX: number;
  startY: number;
  originTick: number;
  originPitch: number;
  originDuration: number;
  selectedOrigin?: Record<string, { startTick: number; pitch: number }>;
  snapshotPushed: boolean;
}

// Module-level clipboard for copy/paste
let clipboard: NoteEvent[] = [];

interface PianoRollProps {
  track: Track;
}

export function PianoRoll({ track }: PianoRollProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());
  const [selectionRect, setSelectionRect] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const addNote = useProjectStore((s) => s.addNote);
  const removeNote = useProjectStore((s) => s.removeNote);
  const updateNote = useProjectStore((s) => s.updateNote);
  const currentTick = useTransportStore((s) => s.currentTick);
  const loop = useTransportStore((s) => s.loop);
  const project = useProjectStore((s) => s.project);
  const zoom = useUIStore((s) => s.pianoRollZoom);
  const setZoom = useUIStore((s) => s.setPianoRollZoom);

  const tickWidth = BASE_TICK_WIDTH * zoom;

  // Scale highlighting
  const scaleNotes = useMemo(() => {
    if (!project) return null;
    return getScaleNotes(project.key, 'major');
  }, [project?.key]);

  const totalTicks = project
    ? project.timeSignature[0] * TICKS_PER_BEAT * 32
    : TICKS_PER_BEAT * 128;

  const canvasWidth = totalTicks * tickWidth;
  const canvasHeight = PITCH_RANGE * NOTE_HEIGHT;

  // --- Helpers ---
  const canvasToTick = useCallback((x: number) => Math.round(x / tickWidth / GRID_SNAP) * GRID_SNAP, [tickWidth]);
  const canvasToPitch = useCallback((y: number) => MAX_PITCH - 1 - Math.floor(y / NOTE_HEIGHT), []);

  const hitTestNote = useCallback(
    (x: number, y: number): { note: NoteEvent; isResize: boolean } | null => {
      for (let i = track.notes.length - 1; i >= 0; i--) {
        const n = track.notes[i];
        if (n.pitch < MIN_PITCH || n.pitch >= MAX_PITCH) continue;
        const nx = n.startTick * tickWidth;
        const ny = (MAX_PITCH - n.pitch - 1) * NOTE_HEIGHT;
        const nw = Math.max(n.durationTicks * tickWidth, 4);
        if (x >= nx && x <= nx + nw && y >= ny && y <= ny + NOTE_HEIGHT) {
          const isResize = x >= nx + nw - RESIZE_HANDLE_PX;
          return { note: n, isResize };
        }
      }
      return null;
    },
    [track.notes, tickWidth]
  );

  const pushUndoSnapshot = useCallback(() => {
    const proj = useProjectStore.getState().project;
    if (proj) useHistoryStore.getState().pushSnapshot(proj);
  }, []);

  // --- Drawing ---
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw pitch rows with scale highlighting
    for (let p = MIN_PITCH; p < MAX_PITCH; p++) {
      const y = (MAX_PITCH - p - 1) * NOTE_HEIGHT;
      const inScale = scaleNotes ? isInScale(p, scaleNotes) : true;

      if (isBlackKey(p)) {
        ctx.fillStyle = inScale ? '#1a1a30' : '#111120';
      } else {
        ctx.fillStyle = inScale ? '#1e1e38' : '#161628';
      }
      ctx.fillRect(0, y, canvas.width, NOTE_HEIGHT);

      if (scaleNotes && inScale) {
        ctx.fillStyle = 'rgba(108, 92, 231, 0.08)';
        ctx.fillRect(0, y, canvas.width, NOTE_HEIGHT);
      }

      ctx.strokeStyle = '#222240';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw beat grid lines
    for (let tick = 0; tick < totalTicks; tick += TICKS_PER_BEAT) {
      const x = tick * tickWidth;
      const isMeasure = tick % (TICKS_PER_BEAT * (project?.timeSignature[0] ?? 4)) === 0;
      ctx.strokeStyle = isMeasure ? '#3a3a5a' : '#252545';
      ctx.lineWidth = isMeasure ? 1 : 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    // Draw loop region
    if (loop) {
      const loopStartX = loop.start * tickWidth;
      const loopEndX = loop.end * tickWidth;
      ctx.fillStyle = 'rgba(108, 92, 231, 0.08)';
      ctx.fillRect(loopStartX, 0, loopEndX - loopStartX, canvas.height);
      ctx.strokeStyle = 'rgba(108, 92, 231, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(loopStartX, 0);
      ctx.lineTo(loopStartX, canvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(loopEndX, 0);
      ctx.lineTo(loopEndX, canvas.height);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw notes
    for (const note of track.notes) {
      if (note.pitch < MIN_PITCH || note.pitch >= MAX_PITCH) continue;
      const x = note.startTick * tickWidth;
      const y = (MAX_PITCH - note.pitch - 1) * NOTE_HEIGHT;
      const w = note.durationTicks * tickWidth;
      const isSelected = selectedNoteIds.has(note.id);
      const noteInScale = scaleNotes ? isInScale(note.pitch, scaleNotes) : true;

      if (!noteInScale) {
        ctx.fillStyle = isSelected ? '#c06060' : '#884444';
      } else {
        ctx.fillStyle = isSelected ? '#8b7cf8' : track.instrument.color;
      }

      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.roundRect(x, y + 1, Math.max(w, 4), NOTE_HEIGHT - 2, 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      if (isSelected) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x, y + 1, Math.max(w, 4), NOTE_HEIGHT - 2, 2);
        ctx.stroke();
      }

      // Resize handle indicator for selected notes
      if (isSelected && w > 12) {
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(x + Math.max(w, 4) - 3, y + 3, 2, NOTE_HEIGHT - 6);
      }

      if (w > 30) {
        ctx.fillStyle = '#fff';
        ctx.font = '9px monospace';
        ctx.fillText(midiToNoteName(note.pitch), x + 3, y + NOTE_HEIGHT - 4);
      }
    }

    // Draw selection rectangle
    if (selectionRect) {
      const rx = Math.min(selectionRect.x1, selectionRect.x2);
      const ry = Math.min(selectionRect.y1, selectionRect.y2);
      const rw = Math.abs(selectionRect.x2 - selectionRect.x1);
      const rh = Math.abs(selectionRect.y2 - selectionRect.y1);
      ctx.fillStyle = 'rgba(108, 92, 231, 0.15)';
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeStyle = 'rgba(108, 92, 231, 0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(rx, ry, rw, rh);
    }

    // Draw playhead
    const playheadX = currentTick * tickWidth;
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, canvas.height);
    ctx.stroke();
  }, [track, selectedNoteIds, currentTick, totalTicks, project, scaleNotes, tickWidth, loop, selectionRect]);

  useEffect(() => {
    draw();
  }, [draw]);

  // --- Mouse interaction state machine ---
  const getCanvasCoords = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    },
    []
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const { x, y } = getCanvasCoords(e);
      const hit = hitTestNote(x, y);

      if (hit) {
        // Shift+click toggles selection
        if (e.shiftKey) {
          setSelectedNoteIds((prev) => {
            const next = new Set(prev);
            if (next.has(hit.note.id)) {
              next.delete(hit.note.id);
            } else {
              next.add(hit.note.id);
            }
            return next;
          });
          return;
        }

        // Select note if not already selected
        const isAlreadySelected = selectedNoteIds.has(hit.note.id);
        const activeSelection = isAlreadySelected
          ? new Set(selectedNoteIds)
          : new Set([hit.note.id]);

        if (!isAlreadySelected) {
          setSelectedNoteIds(activeSelection);
        }

        const selectedOrigin: Record<string, { startTick: number; pitch: number }> = {};
        if (!hit.isResize) {
          for (const noteId of activeSelection) {
            const note = track.notes.find((n) => n.id === noteId);
            if (note) {
              selectedOrigin[noteId] = {
                startTick: note.startTick,
                pitch: note.pitch,
              };
            }
          }
        }

        const mode: InteractionMode = hit.isResize ? 'resizing' : 'dragging';
        dragRef.current = {
          mode,
          noteId: hit.note.id,
          startX: x,
          startY: y,
          originTick: hit.note.startTick,
          originPitch: hit.note.pitch,
          originDuration: hit.note.durationTicks,
          selectedOrigin,
          snapshotPushed: false,
        };
      } else {
        // Empty area — start rubber-band selection or create note
        if (e.shiftKey) {
          // Rubber-band selection
          dragRef.current = {
            mode: 'selecting',
            startX: x,
            startY: y,
            originTick: 0,
            originPitch: 0,
            originDuration: 0,
            snapshotPushed: false,
          };
          setSelectionRect({ x1: x, y1: y, x2: x, y2: y });
        } else {
          // Clear selection and create note
          setSelectedNoteIds(new Set());
          pushUndoSnapshot();
          const clickedTick = canvasToTick(x);
          const clickedPitch = canvasToPitch(y);
          const newNote: NoteEvent = {
            id: uuid(),
            pitch: clickedPitch,
            startTick: clickedTick,
            durationTicks: TICKS_PER_BEAT,
            velocity: 100,
          };
          addNote(track.id, newNote);
          setSelectedNoteIds(new Set([newNote.id]));

          // Enter creating mode to allow drag-to-resize
          dragRef.current = {
            mode: 'creating',
            noteId: newNote.id,
            startX: x,
            startY: y,
            originTick: clickedTick,
            originPitch: clickedPitch,
            originDuration: TICKS_PER_BEAT,
            snapshotPushed: true,
            selectedOrigin: undefined, // Not used in creating mode, but included for type consistency
          };
        }
      }
    },
    [track, selectedNoteIds, getCanvasCoords, hitTestNote, addNote, canvasToTick, canvasToPitch, pushUndoSnapshot]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const drag = dragRef.current;
      if (!drag) return;

      const { x, y } = getCanvasCoords(e);

      if (drag.mode === 'selecting') {
        setSelectionRect((prev) => prev ? { ...prev, x2: x, y2: y } : null);
        return;
      }

      // Push undo snapshot once at start of drag
      if (!drag.snapshotPushed) {
        pushUndoSnapshot();
        drag.snapshotPushed = true;
      }

      if (drag.mode === 'dragging' && drag.noteId) {
        const dx = x - drag.startX;
        const dy = y - drag.startY;
        const tickDelta = Math.round(dx / tickWidth / GRID_SNAP) * GRID_SNAP;
        const pitchDelta = -Math.round(dy / NOTE_HEIGHT);

        const selectedOrigin = drag.selectedOrigin ?? {};
        const selectedIds = Object.keys(selectedOrigin);

        // Move selected notes from their drag-start positions to avoid cumulative drift.
        if (selectedIds.length > 0 && selectedOrigin[drag.noteId]) {
          for (const noteId of selectedIds) {
            const origin = selectedOrigin[noteId];
            updateNote(track.id, noteId, {
              startTick: Math.max(0, origin.startTick + tickDelta),
              pitch: Math.min(MAX_PITCH - 1, Math.max(MIN_PITCH, origin.pitch + pitchDelta)),
            });
          }
        } else {
          updateNote(track.id, drag.noteId, {
            startTick: Math.max(0, drag.originTick + tickDelta),
            pitch: Math.min(MAX_PITCH - 1, Math.max(MIN_PITCH, drag.originPitch + pitchDelta)),
          });
        }
      }

      if ((drag.mode === 'resizing' || drag.mode === 'creating') && drag.noteId) {
        const dx = x - drag.startX;
        const tickDelta = Math.round(dx / tickWidth / GRID_SNAP) * GRID_SNAP;
        const newDuration = Math.max(GRID_SNAP, drag.originDuration + tickDelta);
        updateNote(track.id, drag.noteId, { durationTicks: newDuration });
      }
    },
    [getCanvasCoords, pushUndoSnapshot, track, updateNote, tickWidth]
  );

  const handleMouseUp = useCallback(() => {
    const drag = dragRef.current;
    if (drag?.mode === 'selecting' && selectionRect) {
      // Select all notes within the rubber-band rect
      const rx1 = Math.min(selectionRect.x1, selectionRect.x2);
      const ry1 = Math.min(selectionRect.y1, selectionRect.y2);
      const rx2 = Math.max(selectionRect.x1, selectionRect.x2);
      const ry2 = Math.max(selectionRect.y1, selectionRect.y2);

      const newSelection = new Set<string>();
      for (const note of track.notes) {
        if (note.pitch < MIN_PITCH || note.pitch >= MAX_PITCH) continue;
        const nx = note.startTick * tickWidth;
        const ny = (MAX_PITCH - note.pitch - 1) * NOTE_HEIGHT;
        const nw = note.durationTicks * tickWidth;
        if (nx + nw >= rx1 && nx <= rx2 && ny + NOTE_HEIGHT >= ry1 && ny <= ry2) {
          newSelection.add(note.id);
        }
      }
      setSelectedNoteIds(newSelection);
      setSelectionRect(null);
    }

    dragRef.current = null;
  }, [selectionRect, track.notes, tickWidth]);

  // --- Zoom via Ctrl+scroll ---
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom(zoom + delta);
      }
    },
    [zoom, setZoom]
  );

  // --- Keyboard shortcuts (note-specific) ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      const ctrl = e.ctrlKey || e.metaKey;

      // Copy
      if (ctrl && e.key === 'c' && selectedNoteIds.size > 0) {
        e.preventDefault();
        const selected = track.notes.filter((n) => selectedNoteIds.has(n.id));
        if (selected.length === 0) return;
        const minTick = Math.min(...selected.map((n) => n.startTick));
        clipboard = selected.map((n) => ({
          ...n,
          startTick: n.startTick - minTick, // relative offset
        }));
        return;
      }

      // Paste
      if (ctrl && e.key === 'v' && clipboard.length > 0) {
        e.preventDefault();
        pushUndoSnapshot();
        const pasteTick = useTransportStore.getState().currentTick;
        const newIds = new Set<string>();
        for (const note of clipboard) {
          const newNote: NoteEvent = {
            ...note,
            id: uuid(),
            startTick: note.startTick + pasteTick,
          };
          addNote(track.id, newNote);
          newIds.add(newNote.id);
        }
        setSelectedNoteIds(newIds);
        return;
      }

      // Select all
      if (ctrl && e.key === 'a') {
        e.preventDefault();
        setSelectedNoteIds(new Set(track.notes.map((n) => n.id)));
        return;
      }

      if (selectedNoteIds.size === 0) return;

      // Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        pushUndoSnapshot();
        for (const noteId of selectedNoteIds) {
          removeNote(track.id, noteId);
        }
        setSelectedNoteIds(new Set());
        return;
      }

      // Arrow keys — pitch/duration
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        for (const noteId of selectedNoteIds) {
          const note = track.notes.find((n) => n.id === noteId);
          if (note) updateNote(track.id, noteId, { pitch: Math.min(MAX_PITCH - 1, note.pitch + 1) });
        }
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        for (const noteId of selectedNoteIds) {
          const note = track.notes.find((n) => n.id === noteId);
          if (note) updateNote(track.id, noteId, { pitch: Math.max(MIN_PITCH, note.pitch - 1) });
        }
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        for (const noteId of selectedNoteIds) {
          const note = track.notes.find((n) => n.id === noteId);
          if (note) updateNote(track.id, noteId, { durationTicks: note.durationTicks + GRID_SNAP });
        }
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        for (const noteId of selectedNoteIds) {
          const note = track.notes.find((n) => n.id === noteId);
          if (note && note.durationTicks > GRID_SNAP) {
            updateNote(track.id, noteId, { durationTicks: note.durationTicks - GRID_SNAP });
          }
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNoteIds, track, removeNote, updateNote, addNote, pushUndoSnapshot]);

  // Piano key labels with scale indicators
  const pianoKeys = [];
  for (let p = MAX_PITCH - 1; p >= MIN_PITCH; p--) {
    const inScale = scaleNotes ? isInScale(p, scaleNotes) : true;
    pianoKeys.push(
      <div
        key={p}
        className={`flex items-center justify-end pr-1 text-[9px] border-b border-forge-border ${
          isBlackKey(p) ? 'bg-forge-bg text-forge-muted' : 'bg-forge-surface text-forge-text'
        }`}
        style={{ height: NOTE_HEIGHT }}
      >
        {inScale && scaleNotes && (
          <span className="w-1 h-1 rounded-full bg-forge-accent mr-1 shrink-0" />
        )}
        {p % 12 === 0 ? midiToNoteName(p) : ''}
      </div>
    );
  }

  // Audio tracks show waveform display
  if (track.audioUrl) {
    return <WaveformCanvas track={track} />;
  }

  return (
    <div className="flex h-full">
      <div className="w-12 shrink-0 overflow-hidden border-r border-forge-border">
        {pianoKeys}
      </div>
      <div ref={containerRef} className="flex-1 overflow-auto">
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          className="cursor-crosshair"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>
    </div>
  );
}
