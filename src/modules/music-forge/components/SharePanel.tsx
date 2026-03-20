import { useState, useCallback, useEffect } from 'react';
import { useProjectStore } from '../../../core/state/project-store';
import { useAuthStore } from '../../../core/state/auth-store';
import { isSupabaseConfigured } from '../../../core/supabase/client';
import {
  createShareLink,
  subscribeToProject,
  joinPresenceChannel,
  Collaborator,
} from '../../../core/supabase/collaboration';

interface SharePanelProps {
  onClose: () => void;
}

export function SharePanel({ onClose }: SharePanelProps) {
  const project = useProjectStore((s) => s.project);
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [accessLevel, setAccessLevel] = useState<'view' | 'edit'>('view');
  const [copying, setCopying] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [syncing, setSyncing] = useState(false);

  const configured = isSupabaseConfigured();

  // Join presence channel when panel opens
  useEffect(() => {
    if (!project || !user || !configured) return;

    const { leave } = joinPresenceChannel(
      project.id,
      user.id,
      user.email || 'Anonymous',
      setCollaborators
    );

    return () => leave();
  }, [project?.id, user?.id, configured]);

  // Subscribe to real-time project updates
  useEffect(() => {
    if (!project || !configured) return;

    const unsubscribe = subscribeToProject(project.id, (updates) => {
      setSyncing(true);
      useProjectStore.setState((state) => {
        if (!state.project) return state;
        // Only apply if remote is newer
        if (updates.updatedAt && updates.updatedAt > state.project.updatedAt) {
          return {
            project: { ...state.project, ...updates },
          };
        }
        return state;
      });
      setTimeout(() => setSyncing(false), 1000);
    });

    return unsubscribe;
  }, [project?.id, configured]);

  const handleGenerateLink = useCallback(async () => {
    if (!project || !user) return;
    setGenerating(true);
    const url = await createShareLink(project, user.id, accessLevel);
    if (url) setShareUrl(url);
    setGenerating(false);
  }, [project, user, accessLevel]);

  const handleCopy = useCallback(async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopying(true);
      setTimeout(() => setCopying(false), 2000);
    } catch {
      // Clipboard API not available
    }
  }, [shareUrl]);

  if (!configured) {
    return (
      <div className="w-72 bg-forge-surface border-l border-forge-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Share & Collaborate</h3>
          <button onClick={onClose} className="text-forge-muted hover:text-forge-text text-xs">X</button>
        </div>
        <p className="text-xs text-forge-muted">
          Collaboration requires Supabase configuration. Set VITE_SUPABASE_URL and
          VITE_SUPABASE_ANON_KEY in your environment to enable cloud sync and sharing.
        </p>
      </div>
    );
  }

  if (status !== 'authenticated' || !user) {
    return (
      <div className="w-72 bg-forge-surface border-l border-forge-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Share & Collaborate</h3>
          <button onClick={onClose} className="text-forge-muted hover:text-forge-text text-xs">X</button>
        </div>
        <p className="text-xs text-forge-muted">
          Sign in to share projects and collaborate in real-time.
        </p>
      </div>
    );
  }

  return (
    <div className="w-72 bg-forge-surface border-l border-forge-border p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Share & Collaborate</h3>
        <div className="flex items-center gap-2">
          {syncing && (
            <span className="text-[10px] text-forge-accent animate-pulse">Syncing...</span>
          )}
          <button onClick={onClose} className="text-forge-muted hover:text-forge-text text-xs">X</button>
        </div>
      </div>

      {/* Access level */}
      <div>
        <label className="text-xs text-forge-muted block mb-1">Access Level</label>
        <div className="flex gap-1">
          <button
            onClick={() => setAccessLevel('view')}
            className={`text-xs px-3 py-1 rounded ${
              accessLevel === 'view'
                ? 'bg-forge-accent text-white'
                : 'bg-forge-border text-forge-muted'
            }`}
          >
            View Only
          </button>
          <button
            onClick={() => setAccessLevel('edit')}
            className={`text-xs px-3 py-1 rounded ${
              accessLevel === 'edit'
                ? 'bg-forge-accent text-white'
                : 'bg-forge-border text-forge-muted'
            }`}
          >
            Can Edit
          </button>
        </div>
      </div>

      {/* Generate link */}
      <button
        onClick={handleGenerateLink}
        disabled={generating}
        className="text-xs px-3 py-2 rounded bg-forge-accent text-white hover:bg-forge-accent/80 disabled:opacity-50"
      >
        {generating ? 'Generating...' : 'Generate Share Link'}
      </button>

      {/* Share URL */}
      {shareUrl && (
        <div>
          <label className="text-xs text-forge-muted block mb-1">Share Link</label>
          <div className="flex gap-1">
            <input
              type="text"
              value={shareUrl}
              readOnly
              className="flex-1 bg-forge-bg border border-forge-border rounded px-2 py-1 text-[11px] text-forge-text"
            />
            <button
              onClick={handleCopy}
              className="text-[10px] px-2 py-1 rounded bg-forge-border text-forge-muted hover:text-forge-text shrink-0"
            >
              {copying ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {/* Collaborators */}
      <div>
        <label className="text-xs text-forge-muted block mb-2">
          Online ({collaborators.length + 1})
        </label>
        <div className="space-y-1.5">
          {/* Current user */}
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-forge-success" />
            <span className="text-xs">{user.email || 'You'}</span>
            <span className="text-[10px] text-forge-muted ml-auto">You</span>
          </div>

          {/* Other collaborators */}
          {collaborators.map((c) => (
            <div key={c.userId} className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: c.color }}
              />
              <span className="text-xs truncate">{c.displayName}</span>
              {c.cursorTick !== undefined && (
                <span className="text-[10px] text-forge-muted ml-auto">
                  Bar {Math.floor(c.cursorTick / (480 * 4)) + 1}
                </span>
              )}
            </div>
          ))}

          {collaborators.length === 0 && (
            <p className="text-[10px] text-forge-muted">
              Share the link to invite collaborators
            </p>
          )}
        </div>
      </div>

      {/* Cloud sync status */}
      <div className="border-t border-forge-border pt-3">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-forge-success" />
          <span className="text-[10px] text-forge-muted">Cloud sync active</span>
        </div>
      </div>
    </div>
  );
}
