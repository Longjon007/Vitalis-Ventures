import { useRef, useEffect, useCallback } from 'react';
import { Track, NoteEvent } from '../../../core/types/project';
import { useProjectStore } from '../../../core/state/project-store';
import { useTransportStore } from '../../../core/state/transport-store';
import { TICKS_PER_BEAT } from '../../../core/types/music';
import { midiToNoteName } from '../../../core/utils/note-utils';

interface NotationViewProps {
  track: Track;
}

const STAFF_LINE_GAP = 10;
const STAFF_TOP = 30;
const STAFF_HEIGHT = STAFF_LINE_GAP * 4;
const SYSTEM_HEIGHT = 120;
const NOTE_HEAD_RX = 5;
const NOTE_HEAD_RY = 4;
const BEATS_PER_SYSTEM = 16;
const LEFT_MARGIN = 50;
const BEAT_WIDTH = 40;

// Map MIDI pitch to staff position (0 = middle C on ledger line below treble staff)
// Treble staff lines from bottom: E4, G4, B4, D5, F5
// Staff position: 0 = C4, 1 = D4, 2 = E4, ...
function midiToStaffPos(midi: number): number {
  const noteInOctave = midi % 12;
  const octave = Math.floor(midi / 12) - 1;
  // C=0, D=1, E=2, F=3, G=4, A=5, B=6
  const diatonicMap: Record<number, number> = {
    0: 0, 1: 0, 2: 1, 3: 1, 4: 2, 5: 3, 6: 3, 7: 4, 8: 4, 9: 5, 10: 5, 11: 6,
  };
  const diatonic = diatonicMap[noteInOctave];
  return (octave - 4) * 7 + diatonic; // 0 = C4
}

function staffPosToY(pos: number, systemY: number): number {
  // pos 0 = C4 (one ledger line below treble staff)
  // treble staff bottom line (E4) = pos 2
  // Each diatonic step = half a staff line gap
  const bottomLineY = systemY + STAFF_TOP + STAFF_HEIGHT;
  const e4Pos = 2;
  return bottomLineY - (pos - e4Pos) * (STAFF_LINE_GAP / 2);
}

function isSharp(midi: number): boolean {
  return [1, 3, 6, 8, 10].includes(midi % 12);
}

function durationToType(ticks: number): 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth' {
  if (ticks >= TICKS_PER_BEAT * 4) return 'whole';
  if (ticks >= TICKS_PER_BEAT * 2) return 'half';
  if (ticks >= TICKS_PER_BEAT) return 'quarter';
  if (ticks >= TICKS_PER_BEAT / 2) return 'eighth';
  return 'sixteenth';
}

export function NotationView({ track }: NotationViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const project = useProjectStore((s) => s.project);
  const currentTick = useTransportStore((s) => s.currentTick);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !project) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Sort notes by startTick
    const sortedNotes = [...track.notes].sort((a, b) => a.startTick - b.startTick);

    // Calculate how many systems we need
    const maxTick = sortedNotes.length > 0
      ? Math.max(...sortedNotes.map((n) => n.startTick + n.durationTicks))
      : TICKS_PER_BEAT * BEATS_PER_SYSTEM;
    const totalBeats = Math.ceil(maxTick / TICKS_PER_BEAT);
    const totalSystems = Math.max(1, Math.ceil(totalBeats / BEATS_PER_SYSTEM));

    const width = LEFT_MARGIN + BEATS_PER_SYSTEM * BEAT_WIDTH + 20;
    const height = totalSystems * SYSTEM_HEIGHT + 40;

    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#14142a';
    ctx.fillRect(0, 0, width, height);

    // Draw systems
    for (let sys = 0; sys < totalSystems; sys++) {
      const sysY = sys * SYSTEM_HEIGHT;
      const startBeat = sys * BEATS_PER_SYSTEM;

      // Treble clef symbol
      ctx.fillStyle = '#888';
      ctx.font = '28px serif';
      ctx.fillText('\u{1D11E}', 8, sysY + STAFF_TOP + STAFF_HEIGHT - 5);

      // Staff lines
      ctx.strokeStyle = '#444466';
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const y = sysY + STAFF_TOP + i * STAFF_LINE_GAP;
        ctx.beginPath();
        ctx.moveTo(LEFT_MARGIN - 10, y);
        ctx.lineTo(width - 10, y);
        ctx.stroke();
      }

      // Bar lines
      const beatsPerMeasure = project.timeSignature[0];
      for (let beat = 0; beat <= BEATS_PER_SYSTEM; beat += beatsPerMeasure) {
        const x = LEFT_MARGIN + beat * BEAT_WIDTH;
        ctx.strokeStyle = beat === 0 ? '#666688' : '#444466';
        ctx.lineWidth = beat === 0 ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(x, sysY + STAFF_TOP);
        ctx.lineTo(x, sysY + STAFF_TOP + STAFF_HEIGHT);
        ctx.stroke();
      }

      // Playhead
      const playheadBeat = currentTick / TICKS_PER_BEAT;
      if (playheadBeat >= startBeat && playheadBeat < startBeat + BEATS_PER_SYSTEM) {
        const px = LEFT_MARGIN + (playheadBeat - startBeat) * BEAT_WIDTH;
        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(px, sysY + STAFF_TOP - 5);
        ctx.lineTo(px, sysY + STAFF_TOP + STAFF_HEIGHT + 15);
        ctx.stroke();
      }

      // Draw notes in this system
      const startTick = startBeat * TICKS_PER_BEAT;
      const endTick = (startBeat + BEATS_PER_SYSTEM) * TICKS_PER_BEAT;

      const systemNotes = sortedNotes.filter(
        (n) => n.startTick >= startTick && n.startTick < endTick
      );

      for (const note of systemNotes) {
        const beatOffset = (note.startTick - startTick) / TICKS_PER_BEAT;
        const x = LEFT_MARGIN + beatOffset * BEAT_WIDTH;
        const staffPos = midiToStaffPos(note.pitch);
        const y = staffPosToY(staffPos, sysY);
        const durType = durationToType(note.durationTicks);
        const sharp = isSharp(note.pitch);

        // Ledger lines
        const bottomStaffY = sysY + STAFF_TOP + STAFF_HEIGHT;
        const topStaffY = sysY + STAFF_TOP;
        if (y > bottomStaffY) {
          ctx.strokeStyle = '#444466';
          ctx.lineWidth = 1;
          for (let ly = bottomStaffY + STAFF_LINE_GAP; ly <= y + 2; ly += STAFF_LINE_GAP) {
            ctx.beginPath();
            ctx.moveTo(x - 8, ly);
            ctx.lineTo(x + 8, ly);
            ctx.stroke();
          }
        }
        if (y < topStaffY) {
          ctx.strokeStyle = '#444466';
          ctx.lineWidth = 1;
          for (let ly = topStaffY - STAFF_LINE_GAP; ly >= y - 2; ly -= STAFF_LINE_GAP) {
            ctx.beginPath();
            ctx.moveTo(x - 8, ly);
            ctx.lineTo(x + 8, ly);
            ctx.stroke();
          }
        }

        // Sharp/flat indicator
        if (sharp) {
          ctx.fillStyle = '#aaaacc';
          ctx.font = '11px serif';
          ctx.fillText('#', x - 12, y + 4);
        }

        // Note head
        const filled = durType !== 'whole' && durType !== 'half';
        ctx.beginPath();
        ctx.ellipse(x, y, NOTE_HEAD_RX, NOTE_HEAD_RY, -0.2, 0, Math.PI * 2);
        if (filled) {
          ctx.fillStyle = track.instrument.color;
          ctx.fill();
        } else {
          ctx.strokeStyle = track.instrument.color;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // Stem (for non-whole notes)
        if (durType !== 'whole') {
          const stemUp = staffPos < 4; // below B4 → stem up
          ctx.strokeStyle = track.instrument.color;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          if (stemUp) {
            ctx.moveTo(x + NOTE_HEAD_RX - 1, y);
            ctx.lineTo(x + NOTE_HEAD_RX - 1, y - 28);
          } else {
            ctx.moveTo(x - NOTE_HEAD_RX + 1, y);
            ctx.lineTo(x - NOTE_HEAD_RX + 1, y + 28);
          }
          ctx.stroke();

          // Flag for eighth/sixteenth
          if (durType === 'eighth' || durType === 'sixteenth') {
            ctx.strokeStyle = track.instrument.color;
            ctx.lineWidth = 1.2;
            const flagX = stemUp ? x + NOTE_HEAD_RX - 1 : x - NOTE_HEAD_RX + 1;
            const flagTopY = stemUp ? y - 28 : y + 28;
            const flagDir = stemUp ? 1 : -1;
            ctx.beginPath();
            ctx.moveTo(flagX, flagTopY);
            ctx.quadraticCurveTo(flagX + 8, flagTopY + 8 * flagDir, flagX + 2, flagTopY + 16 * flagDir);
            ctx.stroke();

            if (durType === 'sixteenth') {
              ctx.beginPath();
              ctx.moveTo(flagX, flagTopY + 6 * flagDir);
              ctx.quadraticCurveTo(flagX + 8, flagTopY + 14 * flagDir, flagX + 2, flagTopY + 22 * flagDir);
              ctx.stroke();
            }
          }
        }

        // Note name tooltip below staff on hover area (simplified: always show for low density)
        if (systemNotes.length < 32) {
          ctx.fillStyle = '#666688';
          ctx.font = '8px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(midiToNoteName(note.pitch), x, sysY + STAFF_TOP + STAFF_HEIGHT + 14);
          ctx.textAlign = 'left';
        }
      }
    }
  }, [track, project, currentTick]);

  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <div ref={containerRef} className="flex-1 overflow-auto bg-[#14142a]">
      <canvas
        ref={canvasRef}
        style={{ imageRendering: 'auto' }}
      />
    </div>
  );
}
