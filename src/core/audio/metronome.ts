import * as Tone from 'tone';
import { TimeSignature } from '../types/music';

let clickHigh: Tone.MembraneSynth | null = null;
let clickLow: Tone.MembraneSynth | null = null;
let eventId: number | null = null;

function ensureSynths() {
  if (!clickHigh) {
    clickHigh = new Tone.MembraneSynth({
      pitchDecay: 0.008,
      octaves: 2,
      envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.05 },
    }).toDestination();
    clickHigh.volume.value = -6;
  }
  if (!clickLow) {
    clickLow = new Tone.MembraneSynth({
      pitchDecay: 0.008,
      octaves: 2,
      envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 },
    }).toDestination();
    clickLow.volume.value = -10;
  }
}

export const Metronome = {
  start(tempo: number, timeSignature: TimeSignature) {
    this.stop();
    ensureSynths();

    const [beatsPerMeasure] = timeSignature;
    let beatCount = 0;

    // Schedule repeating click on each beat
    eventId = Tone.getTransport().scheduleRepeat(
      (time) => {
        const isDownbeat = beatCount % beatsPerMeasure === 0;
        if (isDownbeat) {
          clickHigh?.triggerAttackRelease('G5', '32n', time);
        } else {
          clickLow?.triggerAttackRelease('C5', '32n', time);
        }
        beatCount++;
      },
      '4n', // quarter note interval
      0
    );
  },

  stop() {
    if (eventId !== null) {
      Tone.getTransport().clear(eventId);
      eventId = null;
    }
  },

  dispose() {
    this.stop();
    clickHigh?.dispose();
    clickLow?.dispose();
    clickHigh = null;
    clickLow = null;
  },
};
