import { getSupabase } from './client';
import { getErrorMessage } from '../utils/errors';

export type PublicGenerationRecord = {
  id: string;
  prompt: string;
  mode: string;
  input_params: Record<string, unknown>;
  output_url: string | null;
  preview_url: string | null;
  created_at: string;
  parent_generation_id: string | null;
  parent_prompt: string | null;
  parent_creator_username: string | null;
  play_count: number;
  like_count: number;
  share_count: number;
  active_listing_id: string | null;
  active_listing_price_cents: number | null;
  active_listing_license_type: 'personal' | 'commercial' | null;
  active_listing_usage_rights: string | null;
  active_listing_creator_share_bps: number;
  viewer_has_liked: boolean;
  viewer_is_owner: boolean;
  creator_username: string | null;
  creator_display_name: string | null;
  creator_bio: string | null;
  creator_referral_code: string | null;
  creator_score: number;
};

export type PublicProfileRecord = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  referral_code: string | null;
  generation_count: number;
  total_likes: number;
  total_plays: number;
  creator_score: number;
  active_listing_count: number;
};

export type ToggleLikeResult = {
  success: boolean;
  liked: boolean;
  likeCount: number;
  error?: string;
};

export type MarketplaceListingRecord = {
  id: string;
  generation_id: string;
  user_id: string;
  price_cents: number;
  license_type: 'personal' | 'commercial';
  usage_rights: string;
  creator_share_bps: number;
  is_active: boolean;
  created_at: string;
  prompt: string;
  mode: string;
  output_url: string | null;
  preview_url: string | null;
  play_count: number;
  like_count: number;
  share_count: number;
  creator_username: string | null;
  creator_display_name: string | null;
  creator_score: number;
};

export type CreateMarketplaceListingResult = {
  success: boolean;
  listingId: string | null;
  priceCents: number | null;
  licenseType: 'personal' | 'commercial' | null;
  usageRights: string | null;
  error: string | null;
};

export type CreatorMarketplaceSummary = {
  listingCount: number;
  activeListingCount: number;
  totalSales: number;
  totalRevenue: number;
};

function requireSupabase() {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Supabase not configured');
  }
  return supabase;
}

function normalizeRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function normalizeNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function normalizeBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  return fallback;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function normalizeLicenseType(value: unknown): 'personal' | 'commercial' | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'personal' || normalized === 'commercial') {
    return normalized;
  }
  return null;
}

function normalizePublicGeneration(row: unknown): PublicGenerationRecord | null {
  if (!row || typeof row !== 'object') return null;
  const item = row as Record<string, unknown>;

  if (typeof item.id !== 'string') return null;
  if (typeof item.prompt !== 'string') return null;
  if (typeof item.mode !== 'string') return null;
  if (typeof item.created_at !== 'string') return null;

  return {
    id: item.id,
    prompt: item.prompt,
    mode: item.mode,
    input_params: normalizeRecord(item.input_params),
    output_url: normalizeString(item.output_url),
    preview_url: normalizeString(item.preview_url),
    created_at: item.created_at,
    parent_generation_id: normalizeString(item.parent_generation_id),
    parent_prompt: normalizeString(item.parent_prompt),
    parent_creator_username: normalizeString(item.parent_creator_username),
    play_count: normalizeNumber(item.play_count, 0),
    like_count: normalizeNumber(item.like_count, 0),
    share_count: normalizeNumber(item.share_count, 0),
    active_listing_id: normalizeString(item.active_listing_id),
    active_listing_price_cents:
      item.active_listing_price_cents === null || item.active_listing_price_cents === undefined
        ? null
        : normalizeNumber(item.active_listing_price_cents, 0),
    active_listing_license_type: normalizeLicenseType(item.active_listing_license_type),
    active_listing_usage_rights: normalizeString(item.active_listing_usage_rights),
    active_listing_creator_share_bps: normalizeNumber(item.active_listing_creator_share_bps, 8000),
    viewer_has_liked: normalizeBoolean(item.viewer_has_liked, false),
    viewer_is_owner: normalizeBoolean(item.viewer_is_owner, false),
    creator_username: normalizeString(item.creator_username),
    creator_display_name: normalizeString(item.creator_display_name),
    creator_bio: normalizeString(item.creator_bio),
    creator_referral_code: normalizeString(item.creator_referral_code),
    creator_score: normalizeNumber(item.creator_score, 0),
  };
}

function normalizePublicProfile(row: unknown): PublicProfileRecord | null {
  if (!row || typeof row !== 'object') return null;
  const item = row as Record<string, unknown>;

  if (typeof item.id !== 'string') return null;
  if (typeof item.username !== 'string') return null;

  return {
    id: item.id,
    username: item.username,
    display_name: normalizeString(item.display_name),
    bio: normalizeString(item.bio),
    referral_code: normalizeString(item.referral_code),
    generation_count: normalizeNumber(item.generation_count, 0),
    total_likes: normalizeNumber(item.total_likes, 0),
    total_plays: normalizeNumber(item.total_plays, 0),
    creator_score: normalizeNumber(item.creator_score, 0),
    active_listing_count: normalizeNumber(item.active_listing_count, 0),
  };
}

function normalizeMarketplaceListing(row: unknown): MarketplaceListingRecord | null {
  if (!row || typeof row !== 'object') return null;
  const item = row as Record<string, unknown>;

  if (typeof item.id !== 'string') return null;
  if (typeof item.generation_id !== 'string') return null;
  if (typeof item.user_id !== 'string') return null;
  if (typeof item.created_at !== 'string') return null;
  if (typeof item.prompt !== 'string') return null;
  if (typeof item.mode !== 'string') return null;

  return {
    id: item.id,
    generation_id: item.generation_id,
    user_id: item.user_id,
    price_cents: normalizeNumber(item.price_cents, 0),
    license_type: normalizeLicenseType(item.license_type) ?? 'personal',
    usage_rights:
      normalizeString(item.usage_rights) ??
      'Personal use license. Contact creator for commercial rights.',
    creator_share_bps: normalizeNumber(item.creator_share_bps, 8000),
    is_active: normalizeBoolean(item.is_active, true),
    created_at: item.created_at,
    prompt: item.prompt,
    mode: item.mode,
    output_url: normalizeString(item.output_url),
    preview_url: normalizeString(item.preview_url),
    play_count: normalizeNumber(item.play_count, 0),
    like_count: normalizeNumber(item.like_count, 0),
    share_count: normalizeNumber(item.share_count, 0),
    creator_username: normalizeString(item.creator_username),
    creator_display_name: normalizeString(item.creator_display_name),
    creator_score: normalizeNumber(item.creator_score, 0),
  };
}

function normalizeRpcResult(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) {
    return normalizeRecord(value[0]);
  }
  return normalizeRecord(value);
}

export async function getPublicGeneration(generationId: string): Promise<PublicGenerationRecord | null> {
  const id = generationId.trim();
  if (!id) throw new Error('Generation id is required.');

  const supabase = requireSupabase();

  try {
    const { data, error } = await supabase.rpc('get_public_generation', {
      p_generation_id: id,
    });

    if (error) throw new Error(getErrorMessage(error, 'Failed to load generation.'));
    if (!Array.isArray(data) || data.length === 0) return null;
    return normalizePublicGeneration(data[0]);
  } catch (err) {
    throw new Error(getErrorMessage(err, 'Failed to load generation.'));
  }
}

export async function listPublicGenerations(options?: {
  limit?: number;
  offset?: number;
  username?: string | null;
}): Promise<PublicGenerationRecord[]> {
  const limit = options?.limit ?? 24;
  const offset = options?.offset ?? 0;
  const username = options?.username?.trim() || null;

  const supabase = requireSupabase();

  try {
    const { data, error } = await supabase.rpc('list_public_generations', {
      p_limit: limit,
      p_offset: offset,
      p_username: username,
    });

    if (error) throw new Error(getErrorMessage(error, 'Failed to load public generations.'));
    if (!Array.isArray(data)) return [];

    return data
      .map(normalizePublicGeneration)
      .filter((row): row is PublicGenerationRecord => row !== null);
  } catch (err) {
    throw new Error(getErrorMessage(err, 'Failed to load public generations.'));
  }
}

export async function getPublicProfile(username: string): Promise<PublicProfileRecord | null> {
  const normalized = username.trim();
  if (!normalized) throw new Error('Username is required.');

  const supabase = requireSupabase();

  try {
    const { data, error } = await supabase.rpc('get_public_profile', {
      p_username: normalized,
    });

    if (error) throw new Error(getErrorMessage(error, 'Failed to load creator profile.'));
    if (!Array.isArray(data) || data.length === 0) return null;
    return normalizePublicProfile(data[0]);
  } catch (err) {
    throw new Error(getErrorMessage(err, 'Failed to load creator profile.'));
  }
}

export async function toggleGenerationLike(generationId: string): Promise<ToggleLikeResult> {
  const id = generationId.trim();
  if (!id) throw new Error('Generation id is required.');

  const supabase = requireSupabase();

  try {
    const { data, error } = await supabase.rpc('toggle_generation_like', {
      p_generation_id: id,
    });

    if (error) throw new Error(getErrorMessage(error, 'Failed to toggle like.'));

    const result = normalizeRpcResult(data);
    const success = normalizeBoolean(result.success, false);
    const liked = normalizeBoolean(result.liked, false);
    const likeCount = normalizeNumber(result.like_count, 0);
    const resultError = typeof result.error === 'string' ? result.error : undefined;

    return {
      success,
      liked,
      likeCount,
      error: resultError,
    };
  } catch (err) {
    throw new Error(getErrorMessage(err, 'Failed to toggle like.'));
  }
}

export async function incrementGenerationPlayCount(generationId: string): Promise<number> {
  const id = generationId.trim();
  if (!id) throw new Error('Generation id is required.');

  const supabase = requireSupabase();

  try {
    const { data, error } = await supabase.rpc('increment_generation_play_count', {
      p_generation_id: id,
    });

    if (error) throw new Error(getErrorMessage(error, 'Failed to update play count.'));

    const result = normalizeRpcResult(data);
    return normalizeNumber(result.play_count, 0);
  } catch (err) {
    throw new Error(getErrorMessage(err, 'Failed to update play count.'));
  }
}

export async function incrementGenerationShareCount(generationId: string): Promise<number> {
  const id = generationId.trim();
  if (!id) throw new Error('Generation id is required.');

  const supabase = requireSupabase();

  try {
    const { data, error } = await supabase.rpc('increment_generation_share_count', {
      p_generation_id: id,
    });

    if (error) throw new Error(getErrorMessage(error, 'Failed to update share count.'));

    const result = normalizeRpcResult(data);
    return normalizeNumber(result.share_count, 0);
  } catch (err) {
    throw new Error(getErrorMessage(err, 'Failed to update share count.'));
  }
}

export async function listMarketplaceListings(options?: {
  limit?: number;
  offset?: number;
}): Promise<MarketplaceListingRecord[]> {
  const limit = options?.limit ?? 24;
  const offset = options?.offset ?? 0;
  const supabase = requireSupabase();

  try {
    const { data, error } = await supabase.rpc('list_marketplace_listings', {
      p_limit: limit,
      p_offset: offset,
    });

    if (error) throw new Error(getErrorMessage(error, 'Failed to load marketplace listings.'));
    if (!Array.isArray(data)) return [];

    return data
      .map(normalizeMarketplaceListing)
      .filter((listing): listing is MarketplaceListingRecord => listing !== null);
  } catch (err) {
    throw new Error(getErrorMessage(err, 'Failed to load marketplace listings.'));
  }
}

export async function createMarketplaceListing(
  generationId: string,
  priceCents: number,
  options?: { licenseType?: 'personal' | 'commercial'; usageRights?: string | null },
): Promise<CreateMarketplaceListingResult> {
  const id = generationId.trim();
  if (!id) throw new Error('Generation id is required.');

  const supabase = requireSupabase();
  try {
    const payload = {
      p_generation_id: id,
      p_price_cents: Math.round(priceCents),
      p_license_type: options?.licenseType ?? 'personal',
      p_usage_rights: options?.usageRights ?? null,
    };

    let resultData: unknown = null;
    let resultError: { message?: string } | null = null;

    const firstTry = await supabase.rpc('create_marketplace_listing', payload);
    resultData = firstTry.data;
    resultError = firstTry.error;

    // Backward compatibility if DB migration has not run yet.
    if (resultError && /function .*create_marketplace_listing/i.test(resultError.message ?? '')) {
      const fallback = await supabase.rpc('create_marketplace_listing', {
        p_generation_id: id,
        p_price_cents: Math.round(priceCents),
      });
      resultData = fallback.data;
      resultError = fallback.error;
    }

    if (resultError) throw new Error(getErrorMessage(resultError, 'Failed to create listing.'));

    const payloadRecord = normalizeRpcResult(resultData);
    return {
      success: payloadRecord.success === true,
      listingId: normalizeString(payloadRecord.listing_id),
      priceCents:
        payloadRecord.price_cents === null || payloadRecord.price_cents === undefined
          ? null
          : normalizeNumber(payloadRecord.price_cents, 0),
      licenseType: normalizeLicenseType(payloadRecord.license_type),
      usageRights: normalizeString(payloadRecord.usage_rights),
      error: normalizeString(payloadRecord.error),
    };
  } catch (err) {
    throw new Error(getErrorMessage(err, 'Failed to create listing.'));
  }
}

export async function getCreatorMarketplaceSummary(): Promise<CreatorMarketplaceSummary> {
  const supabase = requireSupabase();
  try {
    const { data, error } = await supabase.rpc('get_creator_marketplace_summary');
    if (error) throw new Error(getErrorMessage(error, 'Failed to load marketplace summary.'));

    const payload = normalizeRpcResult(data);
    return {
      listingCount: normalizeNumber(payload.listing_count, 0),
      activeListingCount: normalizeNumber(payload.active_listing_count, 0),
      totalSales: normalizeNumber(payload.total_sales, 0),
      totalRevenue: normalizeNumber(payload.total_revenue, 0),
    };
  } catch (err) {
    throw new Error(getErrorMessage(err, 'Failed to load marketplace summary.'));
  }
}
