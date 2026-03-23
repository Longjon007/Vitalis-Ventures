import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getSupabase } from '../../core/supabase/client';
import { getErrorMessage } from '../../core/utils/errors';
import { trackEvent } from '../../core/analytics/tracker';
import {
  applyPendingReferralForCurrentUser,
  captureReferralCodeFromSearch,
  storePendingReferralCode,
} from '../../core/referrals/referral';

const SUPABASE_CONFIG_ERROR =
  'Authentication is currently unavailable because Supabase is not configured.';

export default function SignupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isMountedRef = useRef(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const code = captureReferralCodeFromSearch(location.search);
    if (!code) return;
    setReferralCode(code);
    storePendingReferralCode(code);
  }, [location.search]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;

    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) {
      setError('Email and password are required.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setError(null);
    setMessage(null);
    setIsSubmitting(true);
    trackEvent('signup_attempt', { method: 'password' });

    const supabase = getSupabase();
    if (!supabase) {
      if (isMountedRef.current) {
        setError(SUPABASE_CONFIG_ERROR);
        setIsSubmitting(false);
      }
      return;
    }

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
      });
      if (authError) {
        throw new Error(getErrorMessage(authError, 'Unable to create account.'));
      }

      if (data.session) {
        if (referralCode) {
          const referralResult = await applyPendingReferralForCurrentUser();
          trackEvent('referral_signup', {
            referralCode,
            applied: referralResult.applied,
          });
        }
        trackEvent('signup_success', {
          method: 'password',
          emailConfirmationRequired: false,
        });
        navigate('/app');
        return;
      }

      if (isMountedRef.current) {
        if (referralCode) {
          trackEvent('referral_signup', {
            referralCode,
            applied: false,
          });
        }
        trackEvent('signup_success', {
          method: 'password',
          emailConfirmationRequired: true,
        });
        setMessage('Account created. Check your email to confirm before logging in.');
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(getErrorMessage(err, 'Signup failed.'));
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
        <h1 className="text-2xl font-semibold text-white">Create account</h1>
        {referralCode && (
          <p className="mt-2 text-xs text-emerald-300">
            Referral applied: <span className="font-medium">{referralCode}</span>
          </p>
        )}
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
          {message && <p className="text-sm text-emerald-300">{message}</p>}
          <button
            className="w-full rounded-xl bg-white px-4 py-2 font-medium text-black disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating account…' : 'Sign up'}
          </button>
        </form>
        <div className="mt-4 text-sm text-zinc-400">
          Already have an account? <Link className="text-white" to="/login">Log in</Link>
        </div>
      </div>
    </div>
  );
}
