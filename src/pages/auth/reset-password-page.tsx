import { useEffect, useRef, useState } from 'react';
import { getSupabase } from '../../core/supabase/client';
import { getErrorMessage } from '../../core/utils/errors';

const SUPABASE_CONFIG_ERROR =
  'Password reset is currently unavailable because Supabase is not configured.';

export default function ResetPasswordPage() {
  const isMountedRef = useRef(true);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
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
    if (!normalizedEmail) {
      setError('Email is required.');
      return;
    }

    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    const supabase = getSupabase();
    if (!supabase) {
      if (isMountedRef.current) {
        setError(SUPABASE_CONFIG_ERROR);
        setIsSubmitting(false);
      }
      return;
    }

    try {
      const { error: authError } = await supabase.auth.resetPasswordForEmail(normalizedEmail);
      if (authError) {
        throw new Error(getErrorMessage(authError, 'Unable to send reset email.'));
      }
      if (isMountedRef.current) {
        setMessage('Reset email sent. Check your inbox for the recovery link.');
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(getErrorMessage(err, 'Reset failed.'));
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
        <h1 className="text-2xl font-semibold text-white">Reset password</h1>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <input
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-white"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {error && <p className="text-sm text-red-300">{error}</p>}
          {message && <p className="text-sm text-emerald-300">{message}</p>}
          <button
            className="w-full rounded-xl bg-white px-4 py-2 font-medium text-black disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      </div>
    </div>
  );
}
