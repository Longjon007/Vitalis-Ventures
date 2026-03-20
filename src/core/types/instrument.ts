export type InstrumentType = 'synth' | 'piano' | 'guitar' | 'bass' | 'drums' | 'strings' | 'pad';

export interface InstrumentDefinition {
  id: string;
  name: string;
  type: InstrumentType;
  icon: string;
  color: string;
}

export const INSTRUMENTS: Record<string, InstrumentDefinition> = {
  piano: { id: 'piano', name: 'Piano', type: 'piano', icon: 'piano', color: '#6c5ce7' },
  guitar: { id: 'guitar', name: 'Guitar', type: 'guitar', icon: 'guitar', color: '#00b894' },
  bass: { id: 'bass', name: 'Bass', type: 'bass', icon: 'bass', color: '#e17055' },
  drums: { id: 'drums', name: 'Drums', type: 'drums', icon: 'drums', color: '#fdcb6e' },
  synth: { id: 'synth', name: 'Synth', type: 'synth', icon: 'synth', color: '#74b9ff' },
  strings: { id: 'strings', name: 'Strings', type: 'strings', icon: 'strings', color: '#a29bfe' },
  pad: { id: 'pad', name: 'Pad', type: 'pad', icon: 'pad', color: '#fd79a8' },
};
