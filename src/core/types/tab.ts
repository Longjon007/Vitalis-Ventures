import { NoteDuration } from './music';
import { Track } from './project';

export interface TabPosition {
  id: string;
  tick: number;
  strings: (number | null)[];  // fret per string, null = not played
  duration: NoteDuration;
}

export interface TabTrack extends Track {
  tuning: number[];         // MIDI note per open string [E2,A2,D3,G3,B3,E4]
  positions: TabPosition[];
}

export const STANDARD_TUNING = [40, 45, 50, 55, 59, 64]; // E2 A2 D3 G3 B3 E4
export const DROP_D_TUNING = [38, 45, 50, 55, 59, 64];
export const OPEN_G_TUNING = [38, 43, 50, 55, 59, 62];

export const TUNING_PRESETS: Record<string, { name: string; tuning: number[] }> = {
  standard: { name: 'Standard (EADGBE)', tuning: STANDARD_TUNING },
  dropD: { name: 'Drop D (DADGBE)', tuning: DROP_D_TUNING },
  openG: { name: 'Open G (DGDGBD)', tuning: OPEN_G_TUNING },
};

export const STRING_LABELS = ['e', 'B', 'G', 'D', 'A', 'E']; // high to low
