import { getSupabase } from './client';
import { getErrorMessage } from '../utils/errors';

export type CreditWallet = {
  monthly_credits: number;
  bonus_credits: number;
  used_credits: number;
};

type ConsumeCreditsResult = {
  success: boolean;
  used: number;
  remaining: number;
};

const SUPABASE_CONFIG_ERROR = 'Supabase not configured';

function requireSupabase() {
  const supabase = getSupabase();
  if (!supabase) throw new Error(SUPABASE_CONFIG_ERROR);
  return supabase;
}

function toNumber(value: unknown): number | null {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) return null;
  return value;
}

function normalizeWallet(data: unknown): CreditWallet | null {
  if (!data || typeof data !== 'object') return null;
  const row = data as Record<string, unknown>;
  const monthlyCredits = toNumber(row.monthly_credits);
  const bonusCredits = toNumber(row.bonus_credits);
  const usedCredits = toNumber(row.used_credits);

  if (monthlyCredits === null || bonusCredits === null || usedCredits === null) {
    throw new Error('Credit wallet data is malformed.');
  }

  return {
    monthly_credits: monthlyCredits,
    bonus_credits: bonusCredits,
    used_credits: usedCredits,
  };
}

export function calculateRemainingCredits(wallet: CreditWallet | null): number {
  if (!wallet) return 0;
  return wallet.monthly_credits + wallet.bonus_credits - wallet.used_credits;
}

export async function getCreditWallet() {
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
      throw new Error('Not authenticated');
    }

    const { data, error } = await supabase
      .from('credit_wallets')
      .select('monthly_credits, bonus_credits, used_credits')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      throw new Error(getErrorMessage(error, 'Failed to load credit wallet.'));
    }

    return normalizeWallet(data);
  } catch (err) {
    throw new Error(getErrorMessage(err, 'Failed to load credit wallet.'));
  }
}

export async function canConsumeCredits(amount: number): Promise<boolean> {
  if (!Number.isFinite(amount)) {
    throw new Error('Credit amount must be a valid number.');
  }
  if (amount <= 0) return true;

  const wallet = await getCreditWallet();
  return calculateRemainingCredits(wallet) >= amount;
}

export async function consumeCredits(
  amount: number,
  reason: string,
  metadata: Record<string, unknown> = {},
): Promise<{ success: boolean; used: number; remaining: number }> {
  const supabase = requireSupabase();

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Credit amount must be greater than zero.');
  }

  const normalizedReason = reason.trim();
  if (!normalizedReason) {
    throw new Error('Credit reason is required.');
  }

  try {
    const { data, error } = await supabase.rpc('consume_credits', {
      p_amount: Math.floor(amount),
      p_reason: normalizedReason,
      p_metadata: metadata && typeof metadata === 'object' ? metadata : {},
    });

    if (error) {
      throw new Error(getErrorMessage(error, 'Credit deduction failed.'));
    }

    if (!data || typeof data !== 'object') {
      throw new Error('Malformed credit response from server.');
    }

    const payload = data as Record<string, unknown>;
    const success = payload.success === true;
    const used = toNumber(payload.used);
    const remaining = toNumber(payload.remaining);
    const rpcError = typeof payload.error === 'string' ? payload.error.trim() : '';

    if (!success) {
      throw new Error(rpcError || 'Credit deduction failed.');
    }
    if (used === null || remaining === null) {
      throw new Error('Malformed credit response from server.');
    }

    const result: ConsumeCreditsResult = { success, used, remaining };
    return result;
  } catch (err) {
    throw new Error(getErrorMessage(err, 'Credit deduction failed.'));
  }
}
