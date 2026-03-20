import * as Tone from 'tone';
import { Project } from '../types/project';
import { AudioEngine } from '../audio/audio-engine';
import { ticksToSeconds } from '../utils/timing-utils';
import { TICKS_PER_BEAT } from '../types/music';

export async function exportToWav(project: Project): Promise<Blob> {
  await Tone.start();

  const recorder = new Tone.Recorder();
  Tone.getDestination().connect(recorder);

  // Calculate total duration
  let maxTick = 0;
  for (const track of project.tracks) {
    for (const note of track.notes) {
      const endTick = note.startTick + note.durationTicks;
      if (endTick > maxTick) maxTick = endTick;
    }
  }

  const totalDuration = ticksToSeconds(maxTick + TICKS_PER_BEAT, project.tempo);

  // Schedule and play
  AudioEngine.scheduleProject(project);
  recorder.start();
  Tone.getTransport().start();

  // Wait for duration + small buffer
  await new Promise((resolve) => setTimeout(resolve, (totalDuration + 0.5) * 1000));

  Tone.getTransport().stop();
  Tone.getTransport().position = 0;

  const blob = await recorder.stop();
  Tone.getDestination().disconnect(recorder);
  recorder.dispose();

  return blob;
}

export async function downloadWav(project: Project) {
  const blob = await exportToWav(project);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.name.replace(/\s+/g, '_')}.webm`;
  a.click();
  URL.revokeObjectURL(url);
}
