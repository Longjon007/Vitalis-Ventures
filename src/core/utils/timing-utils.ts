import { TICKS_PER_BEAT, TimeSignature } from '../types/music';

export function ticksToSeconds(ticks: number, bpm: number): number {
  const secondsPerBeat = 60 / bpm;
  return (ticks / TICKS_PER_BEAT) * secondsPerBeat;
}

export function secondsToTicks(seconds: number, bpm: number): number {
  const secondsPerBeat = 60 / bpm;
  return Math.round((seconds / secondsPerBeat) * TICKS_PER_BEAT);
}

export function ticksToBeats(ticks: number): number {
  return ticks / TICKS_PER_BEAT;
}

export function beatsToTicks(beats: number): number {
  return Math.round(beats * TICKS_PER_BEAT);
}

export function ticksPerMeasure(timeSignature: TimeSignature): number {
  const [beats, beatValue] = timeSignature;
  return TICKS_PER_BEAT * beats * (4 / beatValue);
}

export function tickToMeasureBeat(tick: number, timeSignature: TimeSignature): { measure: number; beat: number } {
  const tpm = ticksPerMeasure(timeSignature);
  const measure = Math.floor(tick / tpm);
  const remainingTicks = tick - measure * tpm;
  const beat = remainingTicks / TICKS_PER_BEAT;
  return { measure: measure + 1, beat: beat + 1 };
}

export function formatPosition(tick: number, timeSignature: TimeSignature): string {
  const { measure, beat } = tickToMeasureBeat(tick, timeSignature);
  return `${measure}:${beat.toFixed(1)}`;
}
