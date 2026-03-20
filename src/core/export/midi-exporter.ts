import { Midi } from '@tonejs/midi';
import { Project } from '../types/project';
import { ticksToSeconds } from '../utils/timing-utils';

export function exportToMidi(project: Project): Midi {
  const midi = new Midi();
  midi.header.setTempo(project.tempo);
  midi.header.timeSignatures.push({
    timeSignature: [project.timeSignature[0], project.timeSignature[1]],
    ticks: 0,
    measures: 0,
  });

  for (const track of project.tracks) {
    const midiTrack = midi.addTrack();
    midiTrack.name = track.name;

    for (const note of track.notes) {
      const time = ticksToSeconds(note.startTick, project.tempo);
      const duration = ticksToSeconds(note.durationTicks, project.tempo);
      midiTrack.addNote({
        midi: note.pitch,
        time,
        duration,
        velocity: note.velocity / 127,
      });
    }
  }

  return midi;
}

export function downloadMidi(project: Project) {
  const midi = exportToMidi(project);
  const arr = midi.toArray();
  const blob = new Blob([arr as unknown as ArrayBuffer], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.name.replace(/\s+/g, '_')}.mid`;
  a.click();
  URL.revokeObjectURL(url);
}
