import { useEffect } from 'react';
import { useProjectStore } from '../state/project-store';
import { useTransportStore } from '../state/transport-store';
import { useHistoryStore } from '../state/history-middleware';
import { AudioEngine } from '../audio/audio-engine';

/**
 * Global keyboard shortcuts for MusicForge DAW.
 * Register once in MusicForge root component.
 */
export function useGlobalShortcuts() {
  const project = useProjectStore((s) => s.project);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const ctrl = e.ctrlKey || e.metaKey;

      // Ctrl+Z — Undo
      if (ctrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        const currentProject = useProjectStore.getState().project;
        const restored = useHistoryStore.getState().undo();
        if (restored && currentProject) {
          useHistoryStore.setState((s) => ({
            future: [JSON.stringify(currentProject), ...s.future],
          }));
          useProjectStore.setState({ project: restored });
        }
        return;
      }

      // Ctrl+Y or Ctrl+Shift+Z — Redo
      if ((ctrl && e.key === 'y') || (ctrl && e.shiftKey && e.key === 'Z')) {
        e.preventDefault();
        const currentProject = useProjectStore.getState().project;
        const restored = useHistoryStore.getState().redo();
        if (restored && currentProject) {
          useHistoryStore.setState((s) => ({
            past: [...s.past, JSON.stringify(currentProject)],
          }));
          useProjectStore.setState({ project: restored });
        }
        return;
      }

      // Space — Play/Pause
      if (e.key === ' ') {
        e.preventDefault();
        const proj = useProjectStore.getState().project;
        if (!proj) return;
        const { isPlaying, play, pause } = useTransportStore.getState();
        if (isPlaying) {
          AudioEngine.pause();
          pause();
        } else {
          AudioEngine.init().then(() => {
            AudioEngine.scheduleProject(proj);
            AudioEngine.play();
            play();
          });
        }
        return;
      }

      // Ctrl+S — Save (trigger updatedAt to persist)
      if (ctrl && e.key === 's') {
        e.preventDefault();
        const proj = useProjectStore.getState().project;
        if (proj) {
          useProjectStore.setState({
            project: { ...proj, updatedAt: Date.now() },
          });
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [project]);
}
