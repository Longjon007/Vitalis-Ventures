import { InstrumentDefinition } from './instrument';
import { TimeSignature } from './music';

export interface NoteEvent {
  id: string;
  pitch: number;        // MIDI 0-127
  startTick: number;
  durationTicks: number;
  velocity: number;     // 0-127
}

export type AutomationParam = 'volume' | 'pan' | 'filterCutoff';

export interface AutomationPoint {
  tick: number;
  value: number; // normalized 0-1
}

export interface AutomationLane {
  param: AutomationParam;
  points: AutomationPoint[];
}

export interface Track {
  id: string;
  name: string;
  instrument: InstrumentDefinition;
  notes: NoteEvent[];
  volume: number;  // 0-1
  pan: number;     // -1 to 1
  muted: boolean;
  solo: boolean;
  audioUrl?: string; // AI-generated audio track URL
  automation?: AutomationLane[];
}

export interface Project {
  id: string;
  name: string;
  tempo: number;
  timeSignature: TimeSignature;
  key: string;
  tracks: Track[];
  createdAt: number;
  updatedAt: number;
}
