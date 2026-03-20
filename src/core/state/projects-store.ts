import { create } from 'zustand';
import { get as idbGet, set as idbSet, del as idbDel, keys as idbKeys } from 'idb-keyval';
import { Project } from '../types/project';

interface ProjectMeta {
  id: string;
  name: string;
  updatedAt: number;
  trackCount: number;
  tempo: number;
}

interface ProjectsState {
  projectList: ProjectMeta[];
  loading: boolean;
  loadProjectList: () => Promise<void>;
  saveProject: (project: Project) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  loadProject: (id: string) => Promise<Project | null>;
  duplicateProject: (id: string, newName: string) => Promise<Project | null>;
}

const PROJECT_PREFIX = 'mf_project_';
const PROJECT_LIST_KEY = 'mf_project_list';

export const useProjectsStore = create<ProjectsState>((set, get) => ({
  projectList: [],
  loading: false,

  loadProjectList: async () => {
    set({ loading: true });
    try {
      const list = await idbGet<ProjectMeta[]>(PROJECT_LIST_KEY);
      set({ projectList: list ?? [], loading: false });
    } catch {
      set({ loading: false });
    }
  },

  saveProject: async (project) => {
    await idbSet(PROJECT_PREFIX + project.id, project);
    const { projectList } = get();
    const meta: ProjectMeta = {
      id: project.id,
      name: project.name,
      updatedAt: project.updatedAt,
      trackCount: project.tracks.length,
      tempo: project.tempo,
    };
    const updated = projectList.filter((p) => p.id !== project.id);
    updated.unshift(meta);
    await idbSet(PROJECT_LIST_KEY, updated);
    set({ projectList: updated });
  },

  deleteProject: async (id) => {
    await idbDel(PROJECT_PREFIX + id);
    const { projectList } = get();
    const updated = projectList.filter((p) => p.id !== id);
    await idbSet(PROJECT_LIST_KEY, updated);
    set({ projectList: updated });
  },

  loadProject: async (id) => {
    try {
      const project = await idbGet<Project>(PROJECT_PREFIX + id);
      return project ?? null;
    } catch {
      return null;
    }
  },

  duplicateProject: async (id, newName) => {
    const original = await get().loadProject(id);
    if (!original) return null;
    const { v4: uuid } = await import('uuid');
    const duplicate: Project = {
      ...original,
      id: uuid(),
      name: newName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await get().saveProject(duplicate);
    return duplicate;
  },
}));
