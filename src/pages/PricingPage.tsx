import { useSubscriptionStore, SubscriptionTier, TIER_FEATURES } from '../core/state/subscription-store';
import { Button } from '../components/Button';

interface PlanCard {
  tier: SubscriptionTier;
  name: string;
  price: string;
  period: string;
  features: string[];
  highlighted?: boolean;
}

const PLANS: PlanCard[] = [
  {
    tier: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    features: [
      'Up to 2 projects',
      'Up to 4 tracks per project',
      'Piano, Guitar, Bass instruments',
      'Basic chord library',
      'JSON export',
      '3 templates',
    ],
  },
  {
    tier: 'pro',
    name: 'Pro',
    price: '$9',
    period: '/month',
    highlighted: true,
    features: [
      'Unlimited projects',
      'Unlimited tracks',
      'All 7 instruments',
      'MIDI & WAV export',
      'Effects chain (6 effects)',
      'Drum sequencer',
      'Full chord library',
      'All templates',
      'Sound packs',
    ],
  },
  {
    tier: 'studio',
    name: 'Studio',
    price: '$19',
    period: '/month',
    features: [
      'Everything in Pro',
      'AI composition suggestions',
      'Real-time collaboration',
      'Priority support',
      'Early access to features',
      'Custom sound packs',
    ],
  },
];

export function PricingPage() {
  const { tier: currentTier, upgradeTo } = useSubscriptionStore();

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="px-6 py-4 border-b border-forge-border bg-forge-surface shrink-0">
        <h2 className="text-lg font-semibold">Plans & Pricing</h2>
        <p className="text-xs text-forge-muted mt-1">
          Current plan: <span className="text-forge-accent font-semibold capitalize">{currentTier}</span>
        </p>
      </div>

      <div className="flex-1 p-6">
        <div className="grid gap-6 md:grid-cols-3 max-w-4xl mx-auto">
          {PLANS.map((plan) => {
            const isCurrent = currentTier === plan.tier;
            return (
              <div
                key={plan.tier}
                className={`rounded-xl border p-6 flex flex-col ${
                  plan.highlighted
                    ? 'border-forge-accent bg-forge-accent/5 ring-1 ring-forge-accent/20'
                    : 'border-forge-border bg-forge-surface'
                }`}
              >
                {plan.highlighted && (
                  <span className="text-[10px] uppercase tracking-wider text-forge-accent font-bold mb-2">
                    Most Popular
                  </span>
                )}
                <h3 className="text-xl font-bold">{plan.name}</h3>
                <div className="mt-2 mb-4">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-sm text-forge-muted">{plan.period}</span>
                </div>

                <ul className="space-y-2 flex-1 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="text-sm flex items-start gap-2">
                      <span className="text-forge-accent mt-0.5">+</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <Button variant="ghost" disabled>
                    Current Plan
                  </Button>
                ) : (
                  <Button
                    variant={plan.highlighted ? 'primary' : 'secondary'}
                    onClick={() => upgradeTo(plan.tier)}
                  >
                    {plan.tier === 'free' ? 'Downgrade' : 'Upgrade'} to {plan.name}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-forge-muted mt-8 max-w-lg mx-auto">
          Plans are stored locally for demo purposes. In production, this would integrate with Stripe for payment processing.
        </p>
      </div>
    </div>
  );
}
