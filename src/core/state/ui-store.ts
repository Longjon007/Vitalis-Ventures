import { create } from 'zustand';
import { TICKS_PER_BEAT } from '../types/music';

export type ActiveModule = 'builder' | 'music-forge' | 'tab-forge';

export type SnapGridSize = '1/4' | '1/8' | '1/16' | '1/32' | 'off';

export const SNAP_GRID_TICKS: Record<SnapGridSize, number> = {
  '1/4': TICKS_PER_BEAT,
  '1/8': TICKS_PER_BEAT / 2,
  '1/16': TICKS_PER_BEAT / 4,
  '1/32': TICKS_PER_BEAT / 8,
  'off': 1,
};

interface UIState {
  activeModule: ActiveModule;
  selectedTrackId: string | null;
  pianoRollZoom: number;
  showChordLibrary: boolean;
  snapGrid: SnapGridSize;
  showVelocityEditor: boolean;
  setActiveModule: (module: ActiveModule) => void;
  setSelectedTrackId: (id: string | null) => void;
  setPianoRollZoom: (zoom: number) => void;
  setShowChordLibrary: (show: boolean) => void;
  setSnapGrid: (snap: SnapGridSize) => void;
  setShowVelocityEditor: (show: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeModule: 'builder',
  selectedTrackId: null,
  pianoRollZoom: 1,
  showChordLibrary: false,
  snapGrid: '1/16',
  showVelocityEditor: false,

  setActiveModule: (module) => set({ activeModule: module }),
  setSelectedTrackId: (id) => set({ selectedTrackId: id }),
  setPianoRollZoom: (zoom) => set({ pianoRollZoom: Math.max(0.25, Math.min(4, zoom)) }),
  setShowChordLibrary: (show) => set({ showChordLibrary: show }),
  setSnapGrid: (snap) => set({ snapGrid: snap }),
  setShowVelocityEditor: (show) => set({ showVelocityEditor: show }),
}));
