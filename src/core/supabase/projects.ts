import { getSupabase } from './client';
import { getErrorMessage } from '../utils/errors';

export type ProjectRecord = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  bpm: number | null;
  genre: string | null;
  mood: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  is_owner?: boolean;
};

export type ProjectCollaboratorRecord = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  role: string;
  is_owner: boolean;
};

export type ProjectInviteResult = {
  success: boolean;
  projectId: string | null;
  inviteCode: string | null;
  error: string | null;
};

export type CreateProjectInput = {
  title: string;
  description?: string;
  bpm?: number;
  genre?: string;
  mood?: string;
  status?: string;
};

const SUPABASE_CONFIG_ERROR = 'Supabase not configured';

function requireSupabase() {
  const supabase = getSupabase();
  if (!supabase) throw new Error(SUPABASE_CONFIG_ERROR);
  return supabase;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeBpm(value: unknown): number | null {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) return null;
  if (value <= 0) return null;
  return Math.round(value);
}

function normalizeProject(row: unknown): ProjectRecord | null {
  if (!row || typeof row !== 'object') return null;
  const item = row as Record<string, unknown>;

  if (typeof item.id !== 'string') return null;
  if (typeof item.user_id !== 'string') return null;
  if (typeof item.title !== 'string') return null;
  if (typeof item.status !== 'string') return null;
  if (typeof item.created_at !== 'string') return null;
  if (typeof item.updated_at !== 'string') return null;

  return {
    id: item.id,
    user_id: item.user_id,
    title: item.title,
    description: typeof item.description === 'string' ? item.description : null,
    bpm: typeof item.bpm === 'number' ? item.bpm : null,
    genre: typeof item.genre === 'string' ? item.genre : null,
    mood: typeof item.mood === 'string' ? item.mood : null,
    status: item.status,
    created_at: item.created_at,
    updated_at: item.updated_at,
    is_owner: typeof item.is_owner === 'boolean' ? item.is_owner : true,
  };
}

function normalizeCollaborator(row: unknown): ProjectCollaboratorRecord | null {
  if (!row || typeof row !== 'object') return null;
  const item = row as Record<string, unknown>;

  if (typeof item.user_id !== 'string') return null;
  if (typeof item.role !== 'string') return null;
  if (typeof item.is_owner !== 'boolean') return null;

  return {
    user_id: item.user_id,
    display_name: typeof item.display_name === 'string' ? item.display_name : null,
    username: typeof item.username === 'string' ? item.username : null,
    role: item.role,
    is_owner: item.is_owner,
  };
}

function normalizeRpcObject(data: unknown): Record<string, unknown> {
  if (Array.isArray(data)) {
    if (data.length === 0) return {};
    const first = data[0];
    if (first && typeof first === 'object' && !Array.isArray(first)) {
      return first as Record<string, unknown>;
    }
    return {};
  }
  if (data && typeof data === 'object') {
    return data as Record<string, unknown>;
  }
  return {};
}

export async function listProjects(): Promise<ProjectRecord[]> {
  const supabase = requireSupabase();

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      throw new Error(getErrorMessage(authError, 'Failed to verify authentication.'));
    }
    if (!user) {
      throw new Error('You must be signed in to view projects.');
    }

    const rpcResult = await supabase.rpc('list_accessible_projects');
    if (!rpcResult.error && Array.isArray(rpcResult.data)) {
      return rpcResult.data
        .map(normalizeProject)
        .filter((project): project is ProjectRecord => project !== null);
    }

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      throw new Error(getErrorMessage(error, 'Failed to load projects.'));
    }

    return (Array.isArray(data) ? data : [])
      .map(normalizeProject)
      .filter((project): project is ProjectRecord => project !== null);
  } catch (err) {
    throw new Error(getErrorMessage(err, 'Failed to load projects.'));
  }
}

export async function createProject(input: CreateProjectInput): Promise<ProjectRecord> {
  const supabase = requireSupabase();
  const title = normalizeString(input.title);

  if (!title) {
    throw new Error('Project title is required.');
  }

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      throw new Error(getErrorMessage(authError, 'Failed to verify authentication.'));
    }
    if (!user) {
      throw new Error('You must be signed in to create a project.');
    }

    const payload = {
      user_id: user.id,
      title,
      description: normalizeString(input.description),
      bpm: normalizeBpm(input.bpm),
      genre: normalizeString(input.genre),
      mood: normalizeString(input.mood),
      status: normalizeString(input.status) ?? 'draft',
    };

    const { data, error } = await supabase
      .from('projects')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      throw new Error(getErrorMessage(error, 'Failed to create project.'));
    }
    if (!data) {
      throw new Error('Project could not be created.');
    }

    const project = normalizeProject(data);
    if (!project) {
      throw new Error('Project could not be parsed.');
    }
    return project;
  } catch (err) {
    throw new Error(getErrorMessage(err, 'Failed to create project.'));
  }
}

export async function getProjectCollaborators(projectId: string): Promise<ProjectCollaboratorRecord[]> {
  const id = projectId.trim();
  if (!id) {
    throw new Error('Project id is required.');
  }

  const supabase = requireSupabase();
  try {
    const { data, error } = await supabase.rpc('get_project_collaborators', {
      p_project_id: id,
    });

    if (error) {
      throw new Error(getErrorMessage(error, 'Failed to load collaborators.'));
    }

    return (Array.isArray(data) ? data : [])
      .map(normalizeCollaborator)
      .filter((collaborator): collaborator is ProjectCollaboratorRecord => collaborator !== null);
  } catch (err) {
    throw new Error(getErrorMessage(err, 'Failed to load collaborators.'));
  }
}

export async function createProjectInvite(projectId: string): Promise<ProjectInviteResult> {
  const id = projectId.trim();
  if (!id) {
    throw new Error('Project id is required.');
  }

  const supabase = requireSupabase();
  try {
    const { data, error } = await supabase.rpc('create_project_invite', {
      p_project_id: id,
    });

    if (error) {
      throw new Error(getErrorMessage(error, 'Failed to create invite.'));
    }

    const payload = normalizeRpcObject(data);
    return {
      success: payload.success === true,
      projectId: typeof payload.project_id === 'string' ? payload.project_id : null,
      inviteCode: typeof payload.invite_code === 'string' ? payload.invite_code : null,
      error: typeof payload.error === 'string' ? payload.error : null,
    };
  } catch (err) {
    throw new Error(getErrorMessage(err, 'Failed to create invite.'));
  }
}

export async function joinProjectInvite(inviteCode: string): Promise<ProjectInviteResult> {
  const code = inviteCode.trim();
  if (!code) {
    throw new Error('Invite code is required.');
  }

  const supabase = requireSupabase();
  try {
    const { data, error } = await supabase.rpc('join_project_invite', {
      p_invite_code: code,
    });

    if (error) {
      throw new Error(getErrorMessage(error, 'Failed to join invite.'));
    }

    const payload = normalizeRpcObject(data);
    return {
      success: payload.success === true,
      projectId: typeof payload.project_id === 'string' ? payload.project_id : null,
      inviteCode: null,
      error: typeof payload.error === 'string' ? payload.error : null,
    };
  } catch (err) {
    throw new Error(getErrorMessage(err, 'Failed to join invite.'));
  }
}
