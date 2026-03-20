import { Project } from '../types/project';
import { ticksToSeconds } from '../utils/timing-utils';
import { midiToNoteName } from '../utils/note-utils';

interface MidiJsonNote {
  midi: number;
  name: string;
  time: number;
  duration: number;
  velocity: number;
}

interface MidiJsonTrack {
  name: string;
  instrument: string;
  notes: MidiJsonNote[];
}

interface MidiJson {
  header: {
    name: string;
    tempo: number;
    timeSignature: [number, number];
    ticksPerBeat: number;
  };
  tracks: MidiJsonTrack[];
}

export function exportToMidiJson(project: Project): MidiJson {
  return {
    header: {
      name: project.name,
      tempo: project.tempo,
      timeSignature: project.timeSignature,
      ticksPerBeat: 480,
    },
    tracks: project.tracks.map((track) => ({
      name: track.name,
      instrument: track.instrument.type,
      notes: track.notes.map((note) => ({
        midi: note.pitch,
        name: midiToNoteName(note.pitch),
        time: ticksToSeconds(note.startTick, project.tempo),
        duration: ticksToSeconds(note.durationTicks, project.tempo),
        velocity: note.velocity / 127,
      })),
    })),
  };
}

export function downloadMidiJson(project: Project) {
  const json = exportToMidiJson(project);
  const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.name.replace(/\s+/g, '_')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
