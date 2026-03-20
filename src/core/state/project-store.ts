import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuid } from 'uuid';
import { Project, Track, NoteEvent } from '../types/project';
import { InstrumentDefinition } from '../types/instrument';
import { TimeSignature } from '../types/music';

interface ProjectState {
  project: Project | null;
  createProject: (config: {
    name: string;
    tempo: number;
    timeSignature: TimeSignature;
    key: string;
    tracks: { name: string; instrument: InstrumentDefinition }[];
  }) => void;
  addTrack: (name: string, instrument: InstrumentDefinition) => void;
  removeTrack: (trackId: string) => void;
  updateTrack: (trackId: string, updates: Partial<Track>) => void;
  updateTrackNotes: (trackId: string, notes: NoteEvent[]) => void;
  addNote: (trackId: string, note: NoteEvent) => void;
  removeNote: (trackId: string, noteId: string) => void;
  updateNote: (trackId: string, noteId: string, updates: Partial<NoteEvent>) => void;
  setTempo: (bpm: number) => void;
  setTimeSignature: (ts: TimeSignature) => void;
  setProjectName: (name: string) => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      project: null,

      createProject: (config) =>
        set({
          project: {
            id: uuid(),
            name: config.name,
            tempo: config.tempo,
            timeSignature: config.timeSignature,
            key: config.key,
            tracks: config.tracks.map((t) => ({
              id: uuid(),
              name: t.name,
              instrument: t.instrument,
              notes: [],
              volume: 0.8,
              pan: 0,
              muted: false,
              solo: false,
            })),
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        }),

      addTrack: (name, instrument) =>
        set((state) => {
          if (!state.project) return state;
          return {
            project: {
              ...state.project,
              updatedAt: Date.now(),
              tracks: [
                ...state.project.tracks,
                {
                  id: uuid(),
                  name,
                  instrument,
                  notes: [],
                  volume: 0.8,
                  pan: 0,
                  muted: false,
                  solo: false,
                },
              ],
            },
          };
        }),

      removeTrack: (trackId) =>
        set((state) => {
          if (!state.project) return state;
          return {
            project: {
              ...state.project,
              updatedAt: Date.now(),
              tracks: state.project.tracks.filter((t) => t.id !== trackId),
            },
          };
        }),

      updateTrack: (trackId, updates) =>
        set((state) => {
          if (!state.project) return state;
          return {
            project: {
              ...state.project,
              updatedAt: Date.now(),
              tracks: state.project.tracks.map((t) =>
                t.id === trackId ? { ...t, ...updates } : t
              ),
            },
          };
        }),

      updateTrackNotes: (trackId, notes) =>
        set((state) => {
          if (!state.project) return state;
          return {
            project: {
              ...state.project,
              updatedAt: Date.now(),
              tracks: state.project.tracks.map((t) =>
                t.id === trackId ? { ...t, notes } : t
              ),
            },
          };
        }),

      addNote: (trackId, note) =>
        set((state) => {
          if (!state.project) return state;
          return {
            project: {
              ...state.project,
              updatedAt: Date.now(),
              tracks: state.project.tracks.map((t) =>
                t.id === trackId ? { ...t, notes: [...t.notes, note] } : t
              ),
            },
          };
        }),

      removeNote: (trackId, noteId) =>
        set((state) => {
          if (!state.project) return state;
          return {
            project: {
              ...state.project,
              updatedAt: Date.now(),
              tracks: state.project.tracks.map((t) =>
                t.id === trackId
                  ? { ...t, notes: t.notes.filter((n) => n.id !== noteId) }
                  : t
              ),
            },
          };
        }),

      updateNote: (trackId, noteId, updates) =>
        set((state) => {
          if (!state.project) return state;
          return {
            project: {
              ...state.project,
              updatedAt: Date.now(),
              tracks: state.project.tracks.map((t) =>
                t.id === trackId
                  ? {
                      ...t,
                      notes: t.notes.map((n) =>
                        n.id === noteId ? { ...n, ...updates } : n
                      ),
                    }
                  : t
              ),
            },
          };
        }),

      setTempo: (bpm) =>
        set((state) => {
          if (!state.project) return state;
          return {
            project: { ...state.project, tempo: bpm, updatedAt: Date.now() },
          };
        }),

      setTimeSignature: (ts) =>
        set((state) => {
          if (!state.project) return state;
          return {
            project: { ...state.project, timeSignature: ts, updatedAt: Date.now() },
          };
        }),

      setProjectName: (name) =>
        set((state) => {
          if (!state.project) return state;
          return {
            project: { ...state.project, name, updatedAt: Date.now() },
          };
        }),
    }),
    {
      name: 'musicforge-project',
    }
  )
);
