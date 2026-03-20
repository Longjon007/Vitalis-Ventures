import { getSupabase } from './client';
import { Project } from '../types/project';
import { saveProjectToCloud } from './sync';

export interface ShareLink {
  id: string;
  projectId: string;
  ownerId: string;
  accessLevel: 'view' | 'edit';
  expiresAt: string | null;
  createdAt: string;
}

export interface Collaborator {
  userId: string;
  displayName: string;
  color: string;
  lastSeen: number;
  cursorTick?: number;
}

const COLLABORATOR_COLORS = [
  '#6c5ce7', '#00b894', '#e17055', '#fdcb6e',
  '#0984e3', '#d63031', '#e84393', '#00cec9',
];

/**
 * Generate a share link for a project.
 * Saves the project to cloud first, then creates a share entry.
 */
export async function createShareLink(
  project: Project,
  userId: string,
  accessLevel: 'view' | 'edit' = 'view'
): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  // Ensure project is saved to cloud
  await saveProjectToCloud(project, userId);

  const { data, error } = await supabase
    .from('project_shares')
    .upsert(
      {
        project_id: project.id,
        owner_id: userId,
        access_level: accessLevel,
        expires_at: null,
      },
      { onConflict: 'project_id,access_level' }
    )
    .select()
    .single();

  if (error || !data) {
    console.error('Failed to create share link:', error?.message);
    return null;
  }

  return `${window.location.origin}/shared/${data.id}`;
}

/**
 * Load a shared project by share link ID.
 */
export async function loadSharedProject(shareId: string): Promise<{
  project: Project;
  accessLevel: 'view' | 'edit';
} | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  // Get share link
  const { data: share, error: shareError } = await supabase
    .from('project_shares')
    .select('*')
    .eq('id', shareId)
    .single();

  if (shareError || !share) return null;

  // Check expiry
  if (share.expires_at && new Date(share.expires_at) < new Date()) return null;

  // Fetch the project
  const { data: projectData, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', share.project_id)
    .single();

  if (projectError || !projectData) return null;

  const project: Project = {
    id: projectData.id,
    name: projectData.name,
    tempo: projectData.tempo,
    timeSignature: projectData.time_signature,
    key: projectData.key,
    tracks: projectData.tracks,
    createdAt: new Date(projectData.created_at).getTime(),
    updatedAt: new Date(projectData.updated_at).getTime(),
  };

  return { project, accessLevel: share.access_level };
}

/**
 * Subscribe to real-time changes on a shared project.
 * Returns an unsubscribe function.
 */
export function subscribeToProject(
  projectId: string,
  onUpdate: (project: Partial<Project>) => void
): () => void {
  const supabase = getSupabase();
  if (!supabase) return () => {};

  const channel = supabase
    .channel(`project:${projectId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'projects',
        filter: `id=eq.${projectId}`,
      },
      (payload) => {
        const data = payload.new as Record<string, unknown>;
        onUpdate({
          name: data.name as string,
          tempo: data.tempo as number,
          timeSignature: data.time_signature as [number, number],
          key: data.key as string,
          tracks: data.tracks as Project['tracks'],
          updatedAt: new Date(data.updated_at as string).getTime(),
        });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Broadcast presence (cursor position, user info) for real-time collaboration.
 */
export function joinPresenceChannel(
  projectId: string,
  userId: string,
  displayName: string,
  onPresenceUpdate: (collaborators: Collaborator[]) => void
): { updateCursor: (tick: number) => void; leave: () => void } {
  const supabase = getSupabase();
  if (!supabase) {
    return { updateCursor: () => {}, leave: () => {} };
  }

  const colorIndex = Math.abs(hashCode(userId)) % COLLABORATOR_COLORS.length;
  const color = COLLABORATOR_COLORS[colorIndex];

  const channel = supabase.channel(`presence:${projectId}`, {
    config: { presence: { key: userId } },
  });

  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const collaborators: Collaborator[] = [];
      for (const [key, entries] of Object.entries(state)) {
        if (key === userId) continue;
        const entry = (entries as Record<string, unknown>[])[0];
        if (entry) {
          collaborators.push({
            userId: key,
            displayName: (entry.displayName as string) || 'Anonymous',
            color: (entry.color as string) || '#888',
            lastSeen: Date.now(),
            cursorTick: entry.cursorTick as number | undefined,
          });
        }
      }
      onPresenceUpdate(collaborators);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          displayName,
          color,
          cursorTick: 0,
          online_at: new Date().toISOString(),
        });
      }
    });

  return {
    updateCursor: (tick: number) => {
      channel.track({
        displayName,
        color,
        cursorTick: tick,
        online_at: new Date().toISOString(),
      });
    },
    leave: () => {
      channel.untrack();
      supabase.removeChannel(channel);
    },
  };
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash;
}
