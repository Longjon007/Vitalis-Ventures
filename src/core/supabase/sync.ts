import { getSupabase } from './client';
import { Project } from '../types/project';

import { TimeSignature } from '../types/music';

interface CloudProject {
  id: string;
  user_id: string;
  name: string;
  tempo: number;
  time_signature: [number, number]; // stored as JSON array
  key: string;
  tracks: Project['tracks'];
  created_at: string;
  updated_at: string;
}

function cloudToLocal(cp: CloudProject): Project {
  return {
    id: cp.id,
    name: cp.name,
    tempo: cp.tempo,
    timeSignature: cp.time_signature as TimeSignature,
    key: cp.key,
    tracks: cp.tracks,
    createdAt: new Date(cp.created_at).getTime(),
    updatedAt: new Date(cp.updated_at).getTime(),
  };
}

function localToCloud(p: Project, userId: string): Omit<CloudProject, 'created_at' | 'updated_at'> {
  return {
    id: p.id,
    user_id: userId,
    name: p.name,
    tempo: p.tempo,
    time_signature: p.timeSignature,
    key: p.key,
    tracks: p.tracks,
  };
}

export async function fetchCloudProjects(): Promise<Project[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch cloud projects:', error.message);
    return [];
  }

  return (data as CloudProject[]).map(cloudToLocal);
}

export async function saveProjectToCloud(project: Project, userId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  const row = localToCloud(project, userId);

  const { error } = await supabase
    .from('projects')
    .upsert(row, { onConflict: 'id' });

  if (error) {
    console.error('Failed to save project to cloud:', error.message);
    return false;
  }

  return true;
}

export async function deleteCloudProject(projectId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId);

  if (error) {
    console.error('Failed to delete cloud project:', error.message);
    return false;
  }

  return true;
}

/**
 * Sync a local project to the cloud. Uses last-write-wins strategy:
 * - Compares local updatedAt with cloud updated_at
 * - Whichever is newer wins
 * Returns the resolved project (may be cloud version if it was newer).
 */
export async function syncProject(project: Project, userId: string): Promise<Project> {
  const supabase = getSupabase();
  if (!supabase) return project;

  // Check if cloud version exists
  const { data } = await supabase
    .from('projects')
    .select('*')
    .eq('id', project.id)
    .single();

  if (!data) {
    // No cloud version — push local
    await saveProjectToCloud(project, userId);
    return project;
  }

  const cloudProject = cloudToLocal(data as CloudProject);

  if (project.updatedAt >= cloudProject.updatedAt) {
    // Local is newer — push to cloud
    await saveProjectToCloud(project, userId);
    return project;
  }

  // Cloud is newer — return cloud version
  return cloudProject;
}

/**
 * Fetch user profile data including subscription tier.
 */
export async function fetchProfile(userId: string): Promise<{
  subscriptionTier: string;
  subscriptionExpiresAt: string | null;
  aiGenerationsUsed: number;
  displayName: string | null;
} | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('subscription_tier, subscription_expires_at, ai_generations_used, display_name')
    .eq('id', userId)
    .single();

  if (error || !data) return null;

  return {
    subscriptionTier: data.subscription_tier,
    subscriptionExpiresAt: data.subscription_expires_at,
    aiGenerationsUsed: data.ai_generations_used,
    displayName: data.display_name,
  };
}
