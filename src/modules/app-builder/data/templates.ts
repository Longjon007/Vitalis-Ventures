import { InstrumentDefinition, INSTRUMENTS } from '../../../core/types/instrument';
import { TimeSignature } from '../../../core/types/music';

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  tracks: { name: string; instrument: InstrumentDefinition }[];
  defaultTempo: number;
  defaultTimeSignature: TimeSignature;
  defaultKey: string;
}

export const TEMPLATES: ProjectTemplate[] = [
  {
    id: 'rock-band',
    name: 'Rock Band',
    description: 'Classic rock setup with guitar, bass, and drums',
    icon: 'R',
    tracks: [
      { name: 'Lead Guitar', instrument: INSTRUMENTS.guitar },
      { name: 'Rhythm Guitar', instrument: INSTRUMENTS.guitar },
      { name: 'Bass', instrument: INSTRUMENTS.bass },
      { name: 'Drums', instrument: INSTRUMENTS.drums },
    ],
    defaultTempo: 120,
    defaultTimeSignature: [4, 4],
    defaultKey: 'E',
  },
  {
    id: 'solo-guitar',
    name: 'Solo Guitar',
    description: 'Single guitar track for fingerstyle or solo pieces',
    icon: 'G',
    tracks: [{ name: 'Guitar', instrument: INSTRUMENTS.guitar }],
    defaultTempo: 100,
    defaultTimeSignature: [4, 4],
    defaultKey: 'C',
  },
  {
    id: 'piano-ballad',
    name: 'Piano Ballad',
    description: 'Piano with strings accompaniment',
    icon: 'P',
    tracks: [
      { name: 'Piano', instrument: INSTRUMENTS.piano },
      { name: 'Strings', instrument: INSTRUMENTS.strings },
    ],
    defaultTempo: 72,
    defaultTimeSignature: [4, 4],
    defaultKey: 'Am',
  },
  {
    id: 'electronic',
    name: 'Electronic',
    description: 'Synth-based electronic music setup',
    icon: 'E',
    tracks: [
      { name: 'Lead Synth', instrument: INSTRUMENTS.synth },
      { name: 'Pad', instrument: INSTRUMENTS.pad },
      { name: 'Bass Synth', instrument: INSTRUMENTS.bass },
      { name: 'Drums', instrument: INSTRUMENTS.drums },
    ],
    defaultTempo: 128,
    defaultTimeSignature: [4, 4],
    defaultKey: 'Am',
  },
  {
    id: 'orchestra',
    name: 'Orchestra',
    description: 'Full orchestral arrangement template',
    icon: 'O',
    tracks: [
      { name: 'Violin I', instrument: INSTRUMENTS.strings },
      { name: 'Violin II', instrument: INSTRUMENTS.strings },
      { name: 'Viola', instrument: INSTRUMENTS.strings },
      { name: 'Cello', instrument: INSTRUMENTS.strings },
      { name: 'Piano', instrument: INSTRUMENTS.piano },
    ],
    defaultTempo: 90,
    defaultTimeSignature: [4, 4],
    defaultKey: 'C',
  },
  {
    id: 'blank',
    name: 'Blank Project',
    description: 'Start from scratch with no tracks',
    icon: '+',
    tracks: [],
    defaultTempo: 120,
    defaultTimeSignature: [4, 4],
    defaultKey: 'C',
  },
];
