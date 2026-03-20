import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  GenerationRequest,
  GenerationResult,
  GenerationStatus,
} from '../ai/ai-types';
import { generate } from '../ai/ai-engine';
import { resultToTracks } from '../ai/audio-import';
import { hasApiKey, setApiKey as storeApiKey, clearApiKey as removeApiKey } from '../ai/replicate-client';
import { useProjectStore } from './project-store';

interface AiState {
  status: GenerationStatus;
  error: string | null;
  currentRequest: GenerationRequest | null;
  results: GenerationResult[];
  hasKey: boolean;
  generationsUsed: number;
  generationsResetAt: number; // timestamp for monthly reset

  // Actions
  startGeneration: (request: GenerationRequest, separateStems?: boolean) => Promise<GenerationResult | null>;
  cancelGeneration: () => void;
  importResult: (result: GenerationResult) => void;
  setApiKey: (key: string) => void;
  clearApiKey: () => void;
  clearHistory: () => void;
  checkMonthlyReset: () => void;
}

let abortController: AbortController | null = null;

export const useAiStore = create<AiState>()(
  persist(
    (set, get) => ({
      status: 'idle',
      error: null,
      currentRequest: null,
      results: [],
      hasKey: hasApiKey(),
      generationsUsed: 0,
      generationsResetAt: getNextMonthTimestamp(),

      startGeneration: async (request, separateStems = false) => {
        get().checkMonthlyReset();

        abortController = new AbortController();
        set({ status: 'generating', error: null, currentRequest: request });

        try {
          const result = await generate(request, {
            onStatus: (status) => {
              set({ status: status === 'processing' ? 'processing' : 'generating' });
            },
            abortSignal: abortController.signal,
            separateStems,
          });

          set((state) => ({
            status: 'complete',
            results: [result, ...state.results].slice(0, 50), // keep last 50
            generationsUsed: state.generationsUsed + 1,
          }));

          abortController = null;
          return result;
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Generation failed';
          set({ status: 'error', error: message });
          abortController = null;
          return null;
        }
      },

      cancelGeneration: () => {
        abortController?.abort();
        abortController = null;
        set({ status: 'idle', error: null, currentRequest: null });
      },

      importResult: (result) => {
        const tracks = resultToTracks(result);
        const addTrack = useProjectStore.getState().addTrack;
        const updateTrackNotes = useProjectStore.getState().updateTrackNotes;
        const project = useProjectStore.getState().project;

        if (!project) return;

        for (const track of tracks) {
          // addTrack creates a new track; we then need to set the audioUrl
          addTrack(track.name, track.instrument);
          const updated = useProjectStore.getState().project;
          const newTrack = updated?.tracks[updated.tracks.length - 1];
          if (newTrack) {
            // Update the track to include audioUrl
            useProjectStore.getState().updateTrack(newTrack.id, { audioUrl: track.audioUrl });
          }
        }
      },

      setApiKey: (key) => {
        storeApiKey(key);
        set({ hasKey: true });
      },

      clearApiKey: () => {
        removeApiKey();
        set({ hasKey: false });
      },

      clearHistory: () => {
        set({ results: [] });
      },

      checkMonthlyReset: () => {
        const state = get();
        if (Date.now() > state.generationsResetAt) {
          set({
            generationsUsed: 0,
            generationsResetAt: getNextMonthTimestamp(),
          });
        }
      },
    }),
    {
      name: 'musicforge-ai',
      partialize: (state) => ({
        results: state.results.slice(0, 20), // persist last 20
        hasKey: state.hasKey,
        generationsUsed: state.generationsUsed,
        generationsResetAt: state.generationsResetAt,
      }),
    }
  )
);

function getNextMonthTimestamp(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
}
