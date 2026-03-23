import { describe, it, expect } from 'vitest';
import { PLAN_CREDITS, getPlanCredits } from './plan-credits';

describe('PLAN_CREDITS', () => {
  it('defines free, pro, and studio tiers', () => {
    expect(PLAN_CREDITS.free).toBeDefined();
    expect(PLAN_CREDITS.pro).toBeDefined();
    expect(PLAN_CREDITS.studio).toBeDefined();
  });

  it('free tier has 50 monthly credits', () => {
    expect(PLAN_CREDITS.free.monthlyCredits).toBe(50);
  });

  it('pro tier has more credits than free', () => {
    expect(PLAN_CREDITS.pro.monthlyCredits).toBeGreaterThan(PLAN_CREDITS.free.monthlyCredits);
  });

  it('studio tier has more credits than pro', () => {
    expect(PLAN_CREDITS.studio.monthlyCredits).toBeGreaterThan(PLAN_CREDITS.pro.monthlyCredits);
  });

  it('AI max duration increases with tier', () => {
    expect(PLAN_CREDITS.free.aiMaxDurationSeconds).toBeLessThan(PLAN_CREDITS.pro.aiMaxDurationSeconds);
    expect(PLAN_CREDITS.pro.aiMaxDurationSeconds).toBeLessThan(PLAN_CREDITS.studio.aiMaxDurationSeconds);
  });
});

describe('getPlanCredits', () => {
  it('returns correct plan for known tiers', () => {
    expect(getPlanCredits('free')).toEqual(PLAN_CREDITS.free);
    expect(getPlanCredits('pro')).toEqual(PLAN_CREDITS.pro);
    expect(getPlanCredits('studio')).toEqual(PLAN_CREDITS.studio);
  });

  it('falls back to free for unknown tiers', () => {
    expect(getPlanCredits('enterprise')).toEqual(PLAN_CREDITS.free);
    expect(getPlanCredits('')).toEqual(PLAN_CREDITS.free);
    expect(getPlanCredits('invalid')).toEqual(PLAN_CREDITS.free);
  });
});
