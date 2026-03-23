import { describe, it, expect } from 'vitest';
import { calculateRemainingCredits, type CreditWallet } from './credits';

describe('calculateRemainingCredits', () => {
  it('returns 0 for null wallet', () => {
    expect(calculateRemainingCredits(null)).toBe(0);
  });

  it('calculates remaining from monthly + bonus - used', () => {
    const wallet: CreditWallet = {
      monthly_credits: 50,
      bonus_credits: 10,
      used_credits: 20,
    };
    expect(calculateRemainingCredits(wallet)).toBe(40);
  });

  it('returns 0 when all credits are used', () => {
    const wallet: CreditWallet = {
      monthly_credits: 50,
      bonus_credits: 0,
      used_credits: 50,
    };
    expect(calculateRemainingCredits(wallet)).toBe(0);
  });

  it('returns negative when over-consumed', () => {
    const wallet: CreditWallet = {
      monthly_credits: 50,
      bonus_credits: 0,
      used_credits: 60,
    };
    expect(calculateRemainingCredits(wallet)).toBe(-10);
  });

  it('includes bonus credits in calculation', () => {
    const wallet: CreditWallet = {
      monthly_credits: 50,
      bonus_credits: 100,
      used_credits: 0,
    };
    expect(calculateRemainingCredits(wallet)).toBe(150);
  });
});
