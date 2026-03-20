import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Session, AuthError } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from '../supabase/client';

export type AuthStatus = 'loading' | 'authenticated' | 'guest';

interface AuthState {
  status: AuthStatus;
  user: User | null;
  session: Session | null;
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<boolean>;
  signInWithEmail: (email: string, password: string) => Promise<boolean>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

function formatAuthError(err: AuthError): string {
  if (err.message.includes('Invalid login credentials')) return 'Invalid email or password.';
  if (err.message.includes('User already registered')) return 'An account with this email already exists.';
  if (err.message.includes('Email not confirmed')) return 'Please check your email to confirm your account.';
  return err.message;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      status: 'loading',
      user: null,
      session: null,
      error: null,

      initialize: async () => {
        const supabase = getSupabase();
        if (!supabase) {
          // No Supabase configured — run in guest mode
          set({ status: 'guest', user: null, session: null });
          return;
        }

        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            set({ status: 'authenticated', user: session.user, session, error: null });
          } else {
            set({ status: 'guest', user: null, session: null });
          }

          // Listen for auth state changes (token refresh, sign-in from other tabs)
          supabase.auth.onAuthStateChange((_event, session) => {
            if (session) {
              set({ status: 'authenticated', user: session.user, session, error: null });
            } else {
              set({ status: 'guest', user: null, session: null });
            }
          });
        } catch {
          set({ status: 'guest', user: null, session: null });
        }
      },

      signUpWithEmail: async (email, password) => {
        const supabase = getSupabase();
        if (!supabase) {
          set({ error: 'Backend not configured. Running in offline mode.' });
          return false;
        }

        set({ error: null });
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) {
          set({ error: formatAuthError(error) });
          return false;
        }
        return true;
      },

      signInWithEmail: async (email, password) => {
        const supabase = getSupabase();
        if (!supabase) {
          set({ error: 'Backend not configured. Running in offline mode.' });
          return false;
        }

        set({ error: null });
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          set({ error: formatAuthError(error) });
          return false;
        }
        set({ status: 'authenticated', user: data.user, session: data.session });
        return true;
      },

      signInWithGoogle: async () => {
        const supabase = getSupabase();
        if (!supabase) {
          set({ error: 'Backend not configured. Running in offline mode.' });
          return;
        }

        set({ error: null });
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin + '/builder' },
        });
        if (error) {
          set({ error: formatAuthError(error) });
        }
      },

      signOut: async () => {
        const supabase = getSupabase();
        if (supabase) {
          await supabase.auth.signOut();
        }
        set({ status: 'guest', user: null, session: null, error: null });
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'musicforge-auth',
      partialize: (state) => ({
        // Only persist status hint — actual session is managed by Supabase
        status: state.status === 'authenticated' ? 'loading' : state.status,
      }),
    }
  )
);
