import { useRef, useEffect, useCallback, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { Track, NoteEvent } from '../../../core/types/project';
import { useProjectStore } from '../../../core/state/project-store';
import { useTransportStore } from '../../../core/state/transport-store';
import { midiToNoteName, isBlackKey } from '../../../core/utils/note-utils';
import { TICKS_PER_BEAT } from '../../../core/types/music';

const NOTE_HEIGHT = 14;
const TICK_WIDTH = 0.15;
const MIN_PITCH = 36; // C2
const MAX_PITCH = 84; // C6
const PITCH_RANGE = MAX_PITCH - MIN_PITCH;
const GRID_SNAP = TICKS_PER_BEAT / 4; // sixteenth note

interface PianoRollProps {
  track: Track;
}

export function PianoRoll({ track }: PianoRollProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const addNote = useProjectStore((s) => s.addNote);
  const removeNote = useProjectStore((s) => s.removeNote);
  const updateNote = useProjectStore((s) => s.updateNote);
  const currentTick = useTransportStore((s) => s.currentTick);
  const project = useProjectStore((s) => s.project);

  const totalTicks = project
    ? project.timeSignature[0] * TICKS_PER_BEAT * 32
    : TICKS_PER_BEAT * 128;

  const canvasWidth = totalTicks * TICK_WIDTH;
  const canvasHeight = PITCH_RANGE * NOTE_HEIGHT;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw pitch rows
    for (let p = MIN_PITCH; p < MAX_PITCH; p++) {
      const y = (MAX_PITCH - p - 1) * NOTE_HEIGHT;
      ctx.fillStyle = isBlackKey(p) ? '#151525' : '#1a1a2e';
      ctx.fillRect(0, y, canvas.width, NOTE_HEIGHT);
      ctx.strokeStyle = '#222240';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw beat grid lines
    for (let tick = 0; tick < totalTicks; tick += TICKS_PER_BEAT) {
      const x = tick * TICK_WIDTH;
      const isMeasure = tick % (TICKS_PER_BEAT * (project?.timeSignature[0] ?? 4)) === 0;
      ctx.strokeStyle = isMeasure ? '#3a3a5a' : '#252545';
      ctx.lineWidth = isMeasure ? 1 : 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    // Draw notes
    for (const note of track.notes) {
      if (note.pitch < MIN_PITCH || note.pitch >= MAX_PITCH) continue;
      const x = note.startTick * TICK_WIDTH;
      const y = (MAX_PITCH - note.pitch - 1) * NOTE_HEIGHT;
      const w = note.durationTicks * TICK_WIDTH;
      const isSelected = note.id === selectedNoteId;

      ctx.fillStyle = isSelected ? '#8b7cf8' : track.instrument.color;
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

      if (w > 30) {
        ctx.fillStyle = '#fff';
        ctx.font = '9px monospace';
        ctx.fillText(midiToNoteName(note.pitch), x + 3, y + NOTE_HEIGHT - 4);
      }
    }

    // Draw playhead
    const playheadX = currentTick * TICK_WIDTH;
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, canvas.height);
    ctx.stroke();
  }, [track, selectedNoteId, currentTick, totalTicks, project]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;

      const clickedTick = Math.round(x / TICK_WIDTH / GRID_SNAP) * GRID_SNAP;
      const clickedPitch = MAX_PITCH - 1 - Math.floor(y / NOTE_HEIGHT);

      // Check if clicked on existing note
      const clickedNote = track.notes.find((n) => {
        const nx = n.startTick * TICK_WIDTH;
        const ny = (MAX_PITCH - n.pitch - 1) * NOTE_HEIGHT;
        const nw = n.durationTicks * TICK_WIDTH;
        return x >= nx && x <= nx + nw && y >= ny && y <= ny + NOTE_HEIGHT;
      });

      if (clickedNote) {
        setSelectedNoteId(clickedNote.id);
      } else {
        // Create new note
        const newNote: NoteEvent = {
          id: uuid(),
          pitch: clickedPitch,
          startTick: clickedTick,
          durationTicks: TICKS_PER_BEAT,
          velocity: 100,
        };
        addNote(track.id, newNote);
        setSelectedNoteId(newNote.id);
      }
    },
    [track, addNote]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedNoteId) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        removeNote(track.id, selectedNoteId);
        setSelectedNoteId(null);
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        updateNote(track.id, selectedNoteId, {
          pitch: Math.min(MAX_PITCH - 1,
            (track.notes.find((n) => n.id === selectedNoteId)?.pitch ?? 60) + 1
          ),
        });
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        updateNote(track.id, selectedNoteId, {
          pitch: Math.max(MIN_PITCH,
            (track.notes.find((n) => n.id === selectedNoteId)?.pitch ?? 60) - 1
          ),
        });
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const note = track.notes.find((n) => n.id === selectedNoteId);
        if (note) {
          updateNote(track.id, selectedNoteId, {
            durationTicks: note.durationTicks + GRID_SNAP,
          });
        }
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const note = track.notes.find((n) => n.id === selectedNoteId);
        if (note && note.durationTicks > GRID_SNAP) {
          updateNote(track.id, selectedNoteId, {
            durationTicks: note.durationTicks - GRID_SNAP,
          });
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNoteId, track, removeNote, updateNote]);

  // Piano key labels
  const pianoKeys = [];
  for (let p = MAX_PITCH - 1; p >= MIN_PITCH; p--) {
    pianoKeys.push(
      <div
        key={p}
        className={`flex items-center justify-end pr-1 text-[9px] border-b border-forge-border ${
          isBlackKey(p) ? 'bg-forge-bg text-forge-muted' : 'bg-forge-surface text-forge-text'
        }`}
        style={{ height: NOTE_HEIGHT }}
      >
        {p % 12 === 0 ? midiToNoteName(p) : ''}
      </div>
    );
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
          onClick={handleCanvasClick}
          className="cursor-crosshair"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>
    </div>
  );
}
