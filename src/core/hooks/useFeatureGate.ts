import { useSubscriptionStore, FeatureGate } from '../state/subscription-store';

/**
 * Hook for checking feature access based on subscription tier.
 * Returns { allowed, tier, gate } for a given feature key.
 */
export function useFeatureGate(feature: keyof FeatureGate) {
  const tier = useSubscriptionStore((s) => s.tier);
  const canAccess = useSubscriptionStore((s) => s.canAccess);
  const features = useSubscriptionStore((s) => s.features);

  return {
    allowed: canAccess(feature),
    tier,
    limit: features[feature],
  };
}

/**
 * Check numeric limits (maxProjects, maxTracksPerProject).
 */
export function useNumericGate(feature: 'maxProjects' | 'maxTracksPerProject') {
  const features = useSubscriptionStore((s) => s.features);
  return features[feature];
}
