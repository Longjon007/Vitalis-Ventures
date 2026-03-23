import { getSupabase } from './client';
import { getErrorMessage } from '../utils/errors';

export type GenerationRecord = {
  id: string;
  user_id: string;
  project_id: string | null;
  parent_generation_id: string | null;
  prompt: string;
  mode: string;
  provider: string | null;
  model: string | null;
  input_params: Record<string, unknown>;
  output_url: string | null;
  preview_url: string | null;
  error_message: string | null;
  credits_used: number;
  is_favorite: boolean;
  is_public: boolean;
  is_featured: boolean;
  play_count: number;
  like_count: number;
  share_count: number;
  status: string;
  created_at: string;
  updated_at: string;
};

export type CreateGenerationInput = {
  projectId?: string | null;
  parentGenerationId?: string | null;
  prompt: string;
  mode?: string;
  provider?: string;
  model?: string;
  inputParams?: Record<string, unknown>;
  creditsUsed?: number;
  status?: string;
  outputUrl?: string | null;
  previewUrl?: string | null;
  errorMessage?: string | null;
  isPublic?: boolean;
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

function normalizeNullableString(value: unknown): string | null {
  const normalized = normalizeString(value);
  return normalized ?? null;
}

function normalizeRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function normalizeNonNegativeNumber(value: unknown, fallback = 0): number {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) return fallback;
  return value < 0 ? fallback : value;
}

export function normalizeGenerationError(err: unknown): string {
  return getErrorMessage(err, 'Generation request failed.');
}

export async function listGenerations(): Promise<GenerationRecord[]> {
  const supabase = requireSupabase();

  try {
    const { data, error } = await supabase
      .from('ai_generations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(normalizeGenerationError(error));
    return (Array.isArray(data) ? data : []) as GenerationRecord[];
  } catch (err) {
    throw new Error(normalizeGenerationError(err));
  }
}

export async function createGeneration(input: CreateGenerationInput): Promise<GenerationRecord> {
  const supabase = requireSupabase();

  const prompt = normalizeString(input.prompt);
  if (!prompt) {
    throw new Error('Prompt is required to create a generation.');
  }

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) throw new Error(normalizeGenerationError(authError));
    if (!user) throw new Error('Not authenticated');

    const payload = {
      user_id: user.id,
      project_id: normalizeNullableString(input.projectId),
      parent_generation_id: normalizeNullableString(input.parentGenerationId),
      prompt,
      mode: normalizeString(input.mode) ?? 'standard',
      provider: normalizeString(input.provider) ?? 'replicate',
      model: normalizeNullableString(input.model),
      input_params: normalizeRecord(input.inputParams),
      output_url: normalizeNullableString(input.outputUrl),
      preview_url: normalizeNullableString(input.previewUrl),
      error_message: normalizeNullableString(input.errorMessage),
      credits_used: normalizeNonNegativeNumber(input.creditsUsed, 0),
      is_public: input.isPublic ?? true,
      status: normalizeString(input.status) ?? 'queued',
    };

    const { data, error } = await supabase
      .from('ai_generations')
      .insert(payload)
      .select('*')
      .single();

    if (error) throw new Error(normalizeGenerationError(error));
    if (!data) throw new Error('Generation could not be created.');

    return data as GenerationRecord;
  } catch (err) {
    throw new Error(normalizeGenerationError(err));
  }
}

export async function getGeneration(id: string): Promise<GenerationRecord | null> {
  const supabase = requireSupabase();
  const generationId = normalizeString(id);
  if (!generationId) {
    throw new Error('Generation id is required.');
  }

  try {
    const { data, error } = await supabase
      .from('ai_generations')
      .select('*')
      .eq('id', generationId)
      .maybeSingle();

    if (error) throw new Error(normalizeGenerationError(error));
    return (data as GenerationRecord | null) ?? null;
  } catch (err) {
    throw new Error(normalizeGenerationError(err));
  }
}

export async function updateGenerationStatus(
  id: string,
  patch: Partial<
    Pick<
      GenerationRecord,
      'status' | 'output_url' | 'preview_url' | 'error_message' | 'is_favorite' | 'project_id'
    >
  >,
): Promise<GenerationRecord> {
  const supabase = requireSupabase();
  const generationId = normalizeString(id);
  if (!generationId) {
    throw new Error('Generation id is required.');
  }

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (patch.status !== undefined) {
    const status = normalizeString(patch.status);
    if (status) updatePayload.status = status;
  }
  if (patch.output_url !== undefined) {
    updatePayload.output_url = normalizeNullableString(patch.output_url);
  }
  if (patch.preview_url !== undefined) {
    updatePayload.preview_url = normalizeNullableString(patch.preview_url);
  }
  if (patch.error_message !== undefined) {
    updatePayload.error_message = normalizeNullableString(patch.error_message);
  }
  if (patch.project_id !== undefined) {
    updatePayload.project_id = normalizeNullableString(patch.project_id);
  }
  if (patch.is_favorite !== undefined) {
    updatePayload.is_favorite = Boolean(patch.is_favorite);
  }

  try {
    const { data, error } = await supabase
      .from('ai_generations')
      .update(updatePayload)
      .eq('id', generationId)
      .select('*')
      .single();

    if (error) throw new Error(normalizeGenerationError(error));
    if (!data) throw new Error('Generation status could not be updated.');

    return data as GenerationRecord;
  } catch (err) {
    throw new Error(normalizeGenerationError(err));
  }
}

export function isGenerationPending(status: string): boolean {
  return status === 'queued' || status === 'processing';
}

export async function claimQueuedGeneration(id: string): Promise<GenerationRecord | null> {
  const supabase = requireSupabase();
  const generationId = normalizeString(id);
  if (!generationId) {
    throw new Error('Generation id is required.');
  }

  try {
    const { data, error } = await supabase
      .from('ai_generations')
      .update({
        status: 'processing',
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', generationId)
      .eq('status', 'queued')
      .select('*')
      .maybeSingle();

    if (error) throw new Error(normalizeGenerationError(error));
    return (data as GenerationRecord | null) ?? null;
  } catch (err) {
    throw new Error(normalizeGenerationError(err));
  }
}
