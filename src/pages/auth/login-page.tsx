import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getSupabase } from '../../core/supabase/client';
import { getErrorMessage } from '../../core/utils/errors';
import { trackEvent } from '../../core/analytics/tracker';

const SUPABASE_CONFIG_ERROR =
  'Authentication is currently unavailable because Supabase is not configured.';

export default function LoginPage() {
  const navigate = useNavigate();
  const isMountedRef = useRef(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;

    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) {
      setError('Email and password are required.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    trackEvent('login_attempt', { method: 'password' });

    const supabase = getSupabase();
    if (!supabase) {
      if (isMountedRef.current) {
        setError(SUPABASE_CONFIG_ERROR);
        setIsSubmitting(false);
      }
      return;
    }

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (authError) {
        throw new Error(getErrorMessage(authError, 'Unable to log in.'));
      }
      if (!data.session) {
        throw new Error('Login succeeded but no active session was returned. Please try again.');
      }
      trackEvent('login_success', { method: 'password' });
      navigate('/app');
    } catch (err) {
      if (isMountedRef.current) {
        setError(getErrorMessage(err, 'Login failed.'));
      }
    } finally {
      if (isMountedRef.current) {
        setIsSubmitting(false);
      }
    }
  }

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <h1 className="text-2xl font-semibold text-white">Log in</h1>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <input
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-white"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-white"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-sm text-red-300">{error}</p>}
          <button
            className="w-full rounded-xl bg-white px-4 py-2 font-medium text-black disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Logging in…' : 'Log in'}
          </button>
        </form>
        <div className="mt-4 flex items-center justify-between text-sm text-zinc-400">
          <span>No account? <Link className="text-white" to="/signup">Sign up</Link></span>
          <Link className="text-zinc-400 hover:text-white" to="/reset-password">Forgot password?</Link>
        </div>
      </div>
    </div>
  );
}
