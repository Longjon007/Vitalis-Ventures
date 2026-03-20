import { useEffect } from 'react';
import { useAuthStore } from '../state/auth-store';
import { useSubscriptionStore } from '../state/subscription-store';
import { useProjectStore } from '../state/project-store';
import { syncProject } from '../supabase/sync';
import { setApiConfig, getEdgeFunctionUrl } from '../ai/api-config';

/**
 * Hook that syncs subscription tier and project data when auth state changes.
 * Should be called once in Layout or App.
 */
export function useAuthSync() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const session = useAuthStore((s) => s.session);
  const syncFromServer = useSubscriptionStore((s) => s.syncFromServer);
  const project = useProjectStore((s) => s.project);

  // Sync subscription tier when user authenticates
  useEffect(() => {
    if (status === 'authenticated' && user) {
      syncFromServer(user.id);
    }
  }, [status, user, syncFromServer]);

  // Configure AI proxy mode when authenticated
  useEffect(() => {
    if (status === 'authenticated' && session) {
      const edgeUrl = getEdgeFunctionUrl();
      if (edgeUrl) {
        setApiConfig({
          mode: 'proxy',
          baseUrl: edgeUrl,
          sessionToken: session.access_token,
        });
      }
    } else if (status === 'guest') {
      // Revert to direct mode — user provides their own key
      setApiConfig({ mode: 'direct' });
    }
  }, [status, session]);

  // Sync current project to cloud when authenticated
  useEffect(() => {
    if (status === 'authenticated' && user && project) {
      // Debounce: sync after project changes settle
      const timer = setTimeout(() => {
        syncProject(project, user.id).catch(() => {
          // Silent fail — offline-first
        });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [status, user, project]);
}
