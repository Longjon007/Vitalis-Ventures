import { useEffect, useRef, useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import { useUIStore } from '../state/ui-store';
import { useProjectStore } from '../state/project-store';
import { useTransportStore } from '../state/transport-store';
import { AudioEngine } from '../audio/audio-engine';
import { TICKS_PER_BEAT } from '../types/music';
import { NoteEvent } from '../types/project';
import * as Tone from 'tone';

// Computer keyboard → MIDI note mapping
// Lower row (Z-M): C3 to B3 (MIDI 48-59)
// Upper row (Q-U): C4 to B4 (MIDI 60-71)
const KEY_TO_MIDI: Record<string, number> = {
  // Bottom row: C3 chromatic
  'z': 48, // C3
  's': 49, // C#3
  'x': 50, // D3
  'd': 51, // D#3
  'c': 52, // E3
  'v': 53, // F3
  'g': 54, // F#3
  'b': 55, // G3
  'h': 56, // G#3
  'n': 57, // A3
  'j': 58, // A#3
  'm': 59, // B3
  // Top row: C4 chromatic
  'q': 60, // C4
  '2': 61, // C#4
  'w': 62, // D4
  '3': 63, // D#4
  'e': 64, // E4
  'r': 65, // F4
  '5': 66, // F#4
  't': 67, // G4
  '6': 68, // G#4
  'y': 69, // A4
  '7': 70, // A#4
  'u': 71, // B4
};

const NOTE_NAMES_MAP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function midiToToneName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES_MAP[midi % 12]}${octave}`;
}

/**
 * Hook for computer keyboard and Web MIDI input.
 * When enabled, keyboard keys trigger notes on the selected track.
 * Also listens for Web MIDI devices.
 */
export function useKeyboardMidiInput() {
  const enabled = useUIStore((s) => s.keyboardInputEnabled);
  const selectedTrackId = useUIStore((s) => s.selectedTrackId);
  const heldKeys = useRef<Set<string>>(new Set());
  const heldNoteStarts = useRef<Map<number, number>>(new Map()); // pitch → startTick
  const synthRef = useRef<Tone.PolySynth | null>(null);
  const midiAccessRef = useRef<MIDIAccess | null>(null);

  // Get a preview synth for live playback
  const getPreviewSynth = useCallback(() => {
    if (!synthRef.current) {
      synthRef.current = new Tone.PolySynth(Tone.Synth).toDestination();
      synthRef.current.volume.value = -6;
    }
    return synthRef.current;
  }, []);

  // Trigger note on
  const noteOn = useCallback((pitch: number, velocity: number = 100) => {
    if (!enabled || !selectedTrackId) return;

    // Play sound preview
    const synth = getPreviewSynth();
    synth.triggerAttack(midiToToneName(pitch), undefined, velocity / 127);

    // Record the start tick
    const currentTick = useTransportStore.getState().currentTick;
    heldNoteStarts.current.set(pitch, currentTick);
  }, [enabled, selectedTrackId, getPreviewSynth]);

  // Trigger note off — create the note event
  const noteOff = useCallback((pitch: number) => {
    if (!enabled || !selectedTrackId) return;

    // Release sound
    const synth = getPreviewSynth();
    synth.triggerRelease(midiToToneName(pitch));

    // Create note from held duration
    const startTick = heldNoteStarts.current.get(pitch);
    heldNoteStarts.current.delete(pitch);

    if (startTick === undefined) return;

    const currentTick = useTransportStore.getState().currentTick;
    const isPlaying = useTransportStore.getState().isPlaying;

    // If playing, use time-based duration; otherwise use 1 beat
    const durationTicks = isPlaying
      ? Math.max(TICKS_PER_BEAT / 4, currentTick - startTick)
      : TICKS_PER_BEAT;

    const newNote: NoteEvent = {
      id: uuid(),
      pitch,
      startTick: isPlaying ? startTick : currentTick,
      durationTicks,
      velocity: 100,
    };

    useProjectStore.getState().addNote(selectedTrackId, newNote);

    // Advance playhead if not playing (step recording)
    if (!isPlaying) {
      useTransportStore.getState().setCurrentTick(currentTick + TICKS_PER_BEAT);
    }
  }, [enabled, selectedTrackId, getPreviewSynth]);

  // Keyboard event listeners
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;

      const key = e.key.toLowerCase();
      const midi = KEY_TO_MIDI[key];
      if (midi === undefined) return;
      if (heldKeys.current.has(key)) return; // prevent key repeat

      e.preventDefault();
      heldKeys.current.add(key);
      noteOn(midi);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const midi = KEY_TO_MIDI[key];
      if (midi === undefined) return;

      heldKeys.current.delete(key);
      noteOff(midi);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      heldKeys.current.clear();
    };
  }, [enabled, noteOn, noteOff]);

  // Web MIDI API integration
  useEffect(() => {
    if (!enabled) return;
    if (!navigator.requestMIDIAccess) return;

    const setupMidi = async () => {
      try {
        const access = await navigator.requestMIDIAccess();
        midiAccessRef.current = access;

        const handleMidiMessage = (event: MIDIMessageEvent) => {
          const data = event.data;
          if (!data || data.length < 3) return;

          const status = data[0] & 0xf0;
          const pitch = data[1];
          const velocity = data[2];

          if (status === 0x90 && velocity > 0) {
            // Note on
            noteOn(pitch, velocity);
          } else if (status === 0x80 || (status === 0x90 && velocity === 0)) {
            // Note off
            noteOff(pitch);
          }
        };

        for (const input of access.inputs.values()) {
          input.onmidimessage = handleMidiMessage;
        }

        // Handle hot-plugging
        access.onstatechange = () => {
          for (const input of access.inputs.values()) {
            input.onmidimessage = handleMidiMessage;
          }
        };
      } catch {
        // MIDI access denied or not available
      }
    };

    setupMidi();

    return () => {
      if (midiAccessRef.current) {
        for (const input of midiAccessRef.current.inputs.values()) {
          input.onmidimessage = null;
        }
      }
    };
  }, [enabled, noteOn, noteOff]);

  // Cleanup synth on unmount
  useEffect(() => {
    return () => {
      if (synthRef.current) {
        synthRef.current.dispose();
        synthRef.current = null;
      }
    };
  }, []);
}
