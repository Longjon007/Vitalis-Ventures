export interface HistoryState {
  _history: { past: string[]; future: string[] };
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

const MAX_HISTORY = 50;

export function createHistoryActions(
  set: (partial: Record<string, unknown>) => void,
  get: () => Record<string, unknown> & HistoryState
): HistoryState {
  return {
    _history: { past: [], future: [] },
    undo: () => {
      const state = get();
      if (state._history.past.length === 0) return;
      const past = [...state._history.past];
      const previous = past.pop()!;
      const parsed = JSON.parse(previous) as Record<string, unknown>;
      const currentSnapshot: Record<string, unknown> = {};
      for (const key of Object.keys(parsed)) {
        currentSnapshot[key] = state[key];
      }
      const future = [JSON.stringify(currentSnapshot), ...state._history.future];
      set({ ...parsed, _history: { past, future } });
    },
    redo: () => {
      const state = get();
      if (state._history.future.length === 0) return;
      const future = [...state._history.future];
      const next = future.shift()!;
      const parsed = JSON.parse(next) as Record<string, unknown>;
      const currentSnapshot: Record<string, unknown> = {};
      for (const key of Object.keys(parsed)) {
        currentSnapshot[key] = state[key];
      }
      const past = [...state._history.past, JSON.stringify(currentSnapshot)];
      set({ ...parsed, _history: { past, future } });
    },
    canUndo: () => {
      return get()._history.past.length > 0;
    },
    canRedo: () => {
      return get()._history.future.length > 0;
    },
  };
}

export function pushHistorySnapshot(
  set: (partial: Record<string, unknown>) => void,
  get: () => Record<string, unknown> & HistoryState,
  trackedKeys: string[]
) {
  const state = get();
  const tracked: Record<string, unknown> = {};
  for (const key of trackedKeys) {
    tracked[key] = state[key];
  }
  const snapshot = JSON.stringify(tracked);
  const past = [...state._history.past, snapshot].slice(-MAX_HISTORY);
  set({ _history: { past, future: [] } });
}
