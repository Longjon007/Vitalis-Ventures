import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { redirectToBillingPortal, redirectToCheckout, getBillingConfigStatus } from '../billing/stripe';
import { fetchSubscriptionSnapshot } from '../billing/subscription-sync';
import type {
  BillingActionState,
  PaidSubscriptionTier,
  SubscriptionStatus,
  SubscriptionTier as BillingTier,
} from '../types/billing';
import { getErrorMessage } from '../utils/errors';

export type SubscriptionTier = BillingTier;

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
  aiMaxDuration: number; // seconds
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
  subscriptionStatus: SubscriptionStatus | null;
  expiresAt: number | null;
  features: FeatureGate;
  billingStatus: BillingActionState;
  billingError: string | null;
  isStripeReady: boolean;
  isSyncing: boolean;
  syncError: string | null;
  lastSyncedAt: number | null;
  setTier: (tier: SubscriptionTier) => void;
  canAccess: (feature: keyof FeatureGate) => boolean;
  isExpired: () => boolean;
  upgradeTo: (tier: SubscriptionTier) => void;
  startCheckout: (tier: PaidSubscriptionTier) => Promise<boolean>;
  openBillingPortal: () => Promise<boolean>;
  clearBillingError: () => void;
  refreshFromProfile: (userId: string) => Promise<void>;
  syncFromServer: (userId: string) => Promise<void>;
}

function applyTierState(tier: SubscriptionTier, expiresAt: number | null) {
  return {
    tier,
    features: TIER_FEATURES[tier],
    expiresAt,
  };
}

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set, get) => ({
      tier: 'free' as SubscriptionTier,
      subscriptionStatus: null,
      expiresAt: null,
      features: TIER_FEATURES.free,
      billingStatus: 'idle',
      billingError: null,
      isStripeReady: getBillingConfigStatus().isBillingConfigured,
      isSyncing: false,
      syncError: null,
      lastSyncedAt: null,

      setTier: (tier) =>
        set({
          ...applyTierState(tier, tier === 'free' ? null : Date.now() + 365 * 24 * 60 * 60 * 1000),
          subscriptionStatus: tier === 'free' ? null : 'active',
          billingError: null,
          syncError: null,
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
          ...applyTierState(tier, tier === 'free' ? null : Date.now() + 365 * 24 * 60 * 60 * 1000),
          subscriptionStatus: tier === 'free' ? null : 'active',
          billingError: null,
          billingStatus: 'idle',
          syncError: null,
        });
      },

      startCheckout: async (tier) => {
        set({ billingStatus: 'pending', billingError: null });
        try {
          await redirectToCheckout(tier);
          return true;
        } catch (err) {
          set({
            billingStatus: 'error',
            billingError: getErrorMessage(err, 'Unable to start checkout.'),
            isStripeReady: getBillingConfigStatus().isBillingConfigured,
          });
          return false;
        }
      },

      openBillingPortal: async () => {
        set({ billingStatus: 'pending', billingError: null });
        try {
          await redirectToBillingPortal('/app/account');
          return true;
        } catch (err) {
          set({
            billingStatus: 'error',
            billingError: getErrorMessage(err, 'Unable to open billing portal.'),
            isStripeReady: getBillingConfigStatus().isBillingConfigured,
          });
          return false;
        }
      },

      clearBillingError: () => set({ billingError: null, billingStatus: 'idle' }),

      refreshFromProfile: async (userId) => {
        const normalizedUserId = userId.trim();
        if (!normalizedUserId) {
          set({
            ...applyTierState('free', null),
            subscriptionStatus: null,
            isSyncing: false,
            syncError: null,
            lastSyncedAt: Date.now(),
          });
          return;
        }

        set({ isSyncing: true, syncError: null });

        try {
          const snapshot = await fetchSubscriptionSnapshot(normalizedUserId);

          if (!snapshot) {
            set({
              ...applyTierState('free', null),
              subscriptionStatus: null,
              isSyncing: false,
              syncError: null,
              lastSyncedAt: Date.now(),
            });
            return;
          }

          set({
            ...applyTierState(snapshot.tier, snapshot.expiresAt),
            subscriptionStatus: snapshot.status,
            billingError: null,
            isSyncing: false,
            syncError: null,
            lastSyncedAt: Date.now(),
          });
        } catch (err) {
          set({
            ...applyTierState('free', null),
            subscriptionStatus: null,
            isSyncing: false,
            syncError: getErrorMessage(err, 'Unable to sync subscription status.'),
            lastSyncedAt: Date.now(),
          });
        }
      },

      syncFromServer: async (userId) => {
        await get().refreshFromProfile(userId);
      },
    }),
    {
      name: 'musicforge-subscription',
      partialize: (state) => ({
        tier: state.tier,
        subscriptionStatus: state.subscriptionStatus,
        expiresAt: state.expiresAt,
        features: state.features,
      }),
    }
  )
);

export { TIER_FEATURES };