import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { fetchProfile } from '../supabase/sync';

export type SubscriptionTier = 'free' | 'pro' | 'studio';

export interface FeatureGate {
  maxProjects: number;
  maxTracksPerProject: number;
  midiExport: boolean;
  wavExport: boolean;
  allInstruments: boolean;
  effectsChain: boolean;
  drumSequencer: boolean;
  allChordShapes: boolean;
  allTemplates: boolean;
  collaboration: boolean;
  aiSuggestions: boolean;
  soundPacks: boolean;
  aiGeneration: boolean;
  aiGenerationsPerMonth: number;
  aiMaxDuration: number;        // seconds
  aiStemSeparation: boolean;
}

const TIER_FEATURES: Record<SubscriptionTier, FeatureGate> = {
  free: {
    maxProjects: 2,
    maxTracksPerProject: 4,
    midiExport: false,
    wavExport: false,
    allInstruments: false,
    effectsChain: false,
    drumSequencer: false,
    allChordShapes: false,
    allTemplates: false,
    collaboration: false,
    aiSuggestions: false,
    soundPacks: false,
    aiGeneration: true,
    aiGenerationsPerMonth: 3,
    aiMaxDuration: 15,
    aiStemSeparation: false,
  },
  pro: {
    maxProjects: Infinity,
    maxTracksPerProject: Infinity,
    midiExport: true,
    wavExport: true,
    allInstruments: true,
    effectsChain: true,
    drumSequencer: true,
    allChordShapes: true,
    allTemplates: true,
    collaboration: false,
    aiSuggestions: false,
    soundPacks: true,
    aiGeneration: true,
    aiGenerationsPerMonth: 50,
    aiMaxDuration: 120,
    aiStemSeparation: true,
  },
  studio: {
    maxProjects: Infinity,
    maxTracksPerProject: Infinity,
    midiExport: true,
    wavExport: true,
    allInstruments: true,
    effectsChain: true,
    drumSequencer: true,
    allChordShapes: true,
    allTemplates: true,
    collaboration: true,
    aiSuggestions: true,
    soundPacks: true,
    aiGeneration: true,
    aiGenerationsPerMonth: Infinity,
    aiMaxDuration: 300,
    aiStemSeparation: true,
  },
};

interface SubscriptionState {
  tier: SubscriptionTier;
  expiresAt: number | null;
  features: FeatureGate;
  setTier: (tier: SubscriptionTier) => void;
  canAccess: (feature: keyof FeatureGate) => boolean;
  isExpired: () => boolean;
  upgradeTo: (tier: SubscriptionTier) => void;
  syncFromServer: (userId: string) => Promise<void>;
}

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set, get) => ({
      tier: 'free' as SubscriptionTier,
      expiresAt: null,
      features: TIER_FEATURES.free,

      setTier: (tier) =>
        set({
          tier,
          features: TIER_FEATURES[tier],
          expiresAt: tier === 'free' ? null : Date.now() + 365 * 24 * 60 * 60 * 1000,
        }),

      canAccess: (feature) => {
        const state = get();
        if (state.tier !== 'free' && state.expiresAt && Date.now() > state.expiresAt) {
          return TIER_FEATURES.free[feature] as boolean;
        }
        const val = state.features[feature];
        return typeof val === 'boolean' ? val : (val as number) > 0;
      },

      isExpired: () => {
        const state = get();
        if (!state.expiresAt) return false;
        return Date.now() > state.expiresAt;
      },

      upgradeTo: (tier) => {
        set({
          tier,
          features: TIER_FEATURES[tier],
          expiresAt: tier === 'free' ? null : Date.now() + 365 * 24 * 60 * 60 * 1000,
        });
      },

      syncFromServer: async (userId) => {
        const profile = await fetchProfile(userId);
        if (!profile) return;

        const tier = (profile.subscriptionTier as SubscriptionTier) || 'free';
        const expiresAt = profile.subscriptionExpiresAt
          ? new Date(profile.subscriptionExpiresAt).getTime()
          : null;

        set({
          tier,
          features: TIER_FEATURES[tier],
          expiresAt,
        });
      },
    }),
    { name: 'musicforge-subscription' }
  )
);

export { TIER_FEATURES };
