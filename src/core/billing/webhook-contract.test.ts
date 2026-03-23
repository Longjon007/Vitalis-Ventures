import { describe, it, expect } from 'vitest';
import { SUPPORTED_STRIPE_WEBHOOK_EVENTS, type StripeWebhookEventType } from './webhook-contract';

describe('SUPPORTED_STRIPE_WEBHOOK_EVENTS', () => {
  it('includes checkout.session.completed', () => {
    expect(SUPPORTED_STRIPE_WEBHOOK_EVENTS).toContain('checkout.session.completed');
  });

  it('includes customer.subscription.updated', () => {
    expect(SUPPORTED_STRIPE_WEBHOOK_EVENTS).toContain('customer.subscription.updated');
  });

  it('includes customer.subscription.deleted', () => {
    expect(SUPPORTED_STRIPE_WEBHOOK_EVENTS).toContain('customer.subscription.deleted');
  });

  it('has exactly 3 supported events', () => {
    expect(SUPPORTED_STRIPE_WEBHOOK_EVENTS).toHaveLength(3);
  });

  it('only contains valid Stripe event type strings', () => {
    for (const event of SUPPORTED_STRIPE_WEBHOOK_EVENTS) {
      expect(event).toMatch(/^(checkout|customer)\./);
    }
  });
});
