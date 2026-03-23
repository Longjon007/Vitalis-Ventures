import { describe, it, expect } from 'vitest';
import {
  hasStripeBillingConfig,
  hasStripeCheckoutConfig,
  hasStripePortalConfig,
  hasRunGenerationConfig,
} from './env';

describe('env config checks', () => {
  it('hasStripeCheckoutConfig returns boolean', () => {
    expect(typeof hasStripeCheckoutConfig()).toBe('boolean');
  });

  it('hasStripePortalConfig returns boolean', () => {
    expect(typeof hasStripePortalConfig()).toBe('boolean');
  });

  it('hasStripeBillingConfig requires both checkout and portal', () => {
    // Without env vars set, both should be false and billing should be false
    if (!hasStripeCheckoutConfig() || !hasStripePortalConfig()) {
      expect(hasStripeBillingConfig()).toBe(false);
    }
  });

  it('hasRunGenerationConfig returns boolean', () => {
    expect(typeof hasRunGenerationConfig()).toBe('boolean');
  });
});
