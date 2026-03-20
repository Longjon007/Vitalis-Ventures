import { create } from 'zustand';
import { Project } from '../types/project';

const MAX_HISTORY = 30;

interface HistoryStore {
  past: string[];
  future: string[];
  pushSnapshot: (project: Project) => void;
  undo: () => Project | null;
  redo: () => Project | null;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clear: () => void;
}

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  past: [],
  future: [],

  pushSnapshot: (project: Project) => {
    const snapshot = JSON.stringify(project);
    set((state) => ({
      past: [...state.past, snapshot].slice(-MAX_HISTORY),
      future: [],
    }));
  },

  undo: () => {
    const { past } = get();
    if (past.length === 0) return null;
    const newPast = [...past];
    const snapshot = newPast.pop()!;
    const project = JSON.parse(snapshot) as Project;

    // Current state will be pushed to future by the caller
    set({ past: newPast });
    return project;
  },

  redo: () => {
    const { future } = get();
    if (future.length === 0) return null;
    const newFuture = [...future];
    const snapshot = newFuture.shift()!;
    const project = JSON.parse(snapshot) as Project;

    set({ future: newFuture });
    return project;
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  clear: () => set({ past: [], future: [] }),
}));

/**
 * Push current project to undo stack before a mutation.
 * Call this before any note/track-modifying action.
 */
export async function snapshotBeforeMutation() {
  const { useProjectStore } = await import('./project-store');
  const project = useProjectStore.getState().project;
  if (project) {
    useHistoryStore.getState().pushSnapshot(project);
  }
}
