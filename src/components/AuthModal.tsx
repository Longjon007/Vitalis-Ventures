import { useState } from 'react';
import { useAuthStore } from '../core/state/auth-store';
import { isSupabaseConfigured } from '../core/supabase/client';
import { Button } from './Button';

type AuthTab = 'signin' | 'signup';

interface AuthModalProps {
  onClose: () => void;
}

export function AuthModal({ onClose }: AuthModalProps) {
  const [tab, setTab] = useState<AuthTab>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const { signInWithEmail, signUpWithEmail, signInWithGoogle, error, clearError } = useAuthStore();

  if (!isSupabaseConfigured()) {
    return (
      <ModalWrapper onClose={onClose}>
        <h2 className="text-lg font-semibold mb-2">Sign In</h2>
        <p className="text-sm text-forge-muted mb-4">
          Backend is not configured. The app is running in offline/guest mode.
          All data is stored locally in your browser.
        </p>
        <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
      </ModalWrapper>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setSuccessMsg('');
    clearError();

    if (tab === 'signin') {
      const ok = await signInWithEmail(email, password);
      if (ok) onClose();
    } else {
      const ok = await signUpWithEmail(email, password);
      if (ok) {
        setSuccessMsg('Account created! Check your email to confirm, then sign in.');
        setTab('signin');
      }
    }
    setLoading(false);
  };

  return (
    <ModalWrapper onClose={onClose}>
      <h2 className="text-lg font-semibold mb-4">
        {tab === 'signin' ? 'Sign In' : 'Create Account'}
      </h2>

      {/* Google OAuth */}
      <button
        onClick={signInWithGoogle}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-gray-800 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors mb-4"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Continue with Google
      </button>

      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-forge-border" />
        <span className="text-xs text-forge-muted">or</span>
        <div className="flex-1 h-px bg-forge-border" />
      </div>

      {/* Email/Password */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full bg-forge-bg border border-forge-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-forge-accent"
          autoComplete="email"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full bg-forge-bg border border-forge-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-forge-accent"
          autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
        />

        {error && (
          <p className="text-xs text-forge-danger">{error}</p>
        )}
        {successMsg && (
          <p className="text-xs text-green-400">{successMsg}</p>
        )}

        <Button type="submit" size="md" variant="primary" className="w-full" disabled={loading}>
          {loading ? 'Please wait...' : tab === 'signin' ? 'Sign In' : 'Create Account'}
        </Button>
      </form>

      <p className="text-xs text-forge-muted mt-4 text-center">
        {tab === 'signin' ? (
          <>
            Don't have an account?{' '}
            <button onClick={() => { setTab('signup'); clearError(); setSuccessMsg(''); }} className="text-forge-accent hover:underline">
              Sign up
            </button>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <button onClick={() => { setTab('signin'); clearError(); setSuccessMsg(''); }} className="text-forge-accent hover:underline">
              Sign in
            </button>
          </>
        )}
      </p>
    </ModalWrapper>
  );
}

function ModalWrapper({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-forge-surface border border-forge-border rounded-xl p-6 w-full max-w-sm mx-4 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-forge-muted hover:text-forge-text text-lg leading-none"
        >
          x
        </button>
        {children}
      </div>
    </div>
  );
}
