import { getErrorMessage } from '../utils/errors';
import { getSupabase } from '../supabase/client';

const PENDING_REFERRAL_KEY = 'musicforge.pending_referral_code';

type ApplyReferralResult = {
  applied: boolean;
  referralCode: string | null;
  error: string | null;
};

export type ReferralRewardPreview = {
  status: 'coming_soon';
  referrerBonusCredits: number;
  referredBonusCredits: number;
};

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export function normalizeReferralCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (!/^[a-z0-9_-]{4,32}$/.test(normalized)) return null;
  return normalized;
}

export function captureReferralCodeFromSearch(search: string): string | null {
  if (!search) return null;
  const params = new URLSearchParams(search);
  return normalizeReferralCode(params.get('ref'));
}

export function storePendingReferralCode(code: string): void {
  if (!isBrowser()) return;
  const normalized = normalizeReferralCode(code);
  if (!normalized) return;
  try {
    window.localStorage.setItem(PENDING_REFERRAL_KEY, normalized);
  } catch {
    // Ignore storage failures.
  }
}

export function getPendingReferralCode(): string | null {
  if (!isBrowser()) return null;
  try {
    return normalizeReferralCode(window.localStorage.getItem(PENDING_REFERRAL_KEY));
  } catch {
    return null;
  }
}

export function clearPendingReferralCode(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(PENDING_REFERRAL_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function buildReferralSignupLink(referralCode: string, source: string = 'account'): string {
  const normalized = normalizeReferralCode(referralCode);
  if (!normalized) return '/signup';

  const query = `ref=${encodeURIComponent(normalized)}&src=${encodeURIComponent(source)}`;
  if (!isBrowser()) {
    return `/signup?${query}`;
  }

  return `${window.location.origin}/signup?${query}`;
}

export async function getCurrentUserReferralCode(): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('referral_code')
      .eq('id', user.id)
      .maybeSingle();

    if (error) return null;
    if (!data || typeof data.referral_code !== 'string') return null;
    return normalizeReferralCode(data.referral_code);
  } catch {
    return null;
  }
}

export async function applyPendingReferralForCurrentUser(): Promise<ApplyReferralResult> {
  const referralCode = getPendingReferralCode();
  if (!referralCode) {
    return { applied: false, referralCode: null, error: null };
  }

  const supabase = getSupabase();
  if (!supabase) {
    return { applied: false, referralCode, error: 'Supabase is not configured.' };
  }

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { applied: false, referralCode, error: 'Not authenticated.' };
    }

    const { data, error } = await supabase.rpc('apply_referral_code', {
      p_code: referralCode,
    });

    if (error) {
      return { applied: false, referralCode, error: getErrorMessage(error, 'Failed to apply referral.') };
    }

    if (!data || typeof data !== 'object') {
      clearPendingReferralCode();
      return { applied: false, referralCode, error: null };
    }

    const payload = data as Record<string, unknown>;
    const applied = payload.success === true;
    const rpcError = typeof payload.error === 'string' ? payload.error : null;
    const shouldKeepPending = rpcError === 'not_authenticated';

    if (!shouldKeepPending) {
      clearPendingReferralCode();
    }

    return { applied, referralCode, error: rpcError };
  } catch (err) {
    return {
      applied: false,
      referralCode,
      error: getErrorMessage(err, 'Failed to apply referral.'),
    };
  }
}

export function getReferralRewardPreview(): ReferralRewardPreview {
  return {
    status: 'coming_soon',
    referrerBonusCredits: 25,
    referredBonusCredits: 25,
  };
}
