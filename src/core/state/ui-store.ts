import { create } from 'zustand';

export type ActiveModule = 'builder' | 'music-forge' | 'tab-forge';

interface UIState {
  activeModule: ActiveModule;
  selectedTrackId: string | null;
  pianoRollZoom: number;
  showChordLibrary: boolean;
  setActiveModule: (module: ActiveModule) => void;
  setSelectedTrackId: (id: string | null) => void;
  setPianoRollZoom: (zoom: number) => void;
  setShowChordLibrary: (show: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeModule: 'builder',
  selectedTrackId: null,
  pianoRollZoom: 1,
  showChordLibrary: false,

  setActiveModule: (module) => set({ activeModule: module }),
  setSelectedTrackId: (id) => set({ selectedTrackId: id }),
  setPianoRollZoom: (zoom) => set({ pianoRollZoom: Math.max(0.25, Math.min(4, zoom)) }),
  setShowChordLibrary: (show) => set({ showChordLibrary: show }),
}));
