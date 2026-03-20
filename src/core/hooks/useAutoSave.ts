import { useEffect, useRef } from 'react';
import { useProjectStore } from '../state/project-store';
import { useProjectsStore } from '../state/projects-store';

const AUTO_SAVE_INTERVAL = 30_000; // 30 seconds

/**
 * Auto-saves the current project to IndexedDB periodically.
 */
export function useAutoSave() {
  const project = useProjectStore((s) => s.project);
  const saveProject = useProjectsStore((s) => s.saveProject);
  const lastSavedRef = useRef<number>(0);

  useEffect(() => {
    if (!project) return;

    const interval = setInterval(() => {
      if (project.updatedAt > lastSavedRef.current) {
        saveProject(project);
        lastSavedRef.current = project.updatedAt;
      }
    }, AUTO_SAVE_INTERVAL);

    return () => clearInterval(interval);
  }, [project, saveProject]);

  // Also save on unmount / page leave
  useEffect(() => {
    const handleBeforeUnload = () => {
      const currentProject = useProjectStore.getState().project;
      if (currentProject) {
        // Use sync localStorage fallback for beforeunload
        try {
          useProjectsStore.getState().saveProject(currentProject);
        } catch {
          // IndexedDB may not complete in beforeunload, best effort
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);
}
