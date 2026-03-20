import { create } from 'zustand';

interface TransportState {
  isPlaying: boolean;
  currentTick: number;
  loop: { start: number; end: number } | null;
  play: () => void;
  pause: () => void;
  stop: () => void;
  seekTo: (tick: number) => void;
  setCurrentTick: (tick: number) => void;
  setLoop: (start: number, end: number) => void;
  clearLoop: () => void;
}

export const useTransportStore = create<TransportState>((set) => ({
  isPlaying: false,
  currentTick: 0,
  loop: null,

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  stop: () => set({ isPlaying: false, currentTick: 0 }),
  seekTo: (tick) => set({ currentTick: tick }),
  setCurrentTick: (tick) => set({ currentTick: tick }),
  setLoop: (start, end) => set({ loop: { start, end } }),
  clearLoop: () => set({ loop: null }),
}));
