'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/auth/supabase-client';
import { MFAChallenge } from '@/components/auth/MFAChallenge';

export default function SignInPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const fallbackRedirectRef = useRef<number | null>(null);
  const submitWatchdogRef = useRef<number | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const [phase, setPhase] = useState<'password' | 'mfa'>('password');
  const [mfaBlocked, setMfaBlocked] = useState(false);
  const TERMS_KEY = 'wayfarer_terms_consent_v1';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const accepted = window.localStorage.getItem(TERMS_KEY) === '1';
    if (!accepted) {
      router.replace('/terms-consent?next=/signin');
    }
  }, [router]);

  useEffect(() => {
    if (!authLoading && user && phase === 'password') {
      router.replace('/trips');
    }
  }, [user, authLoading, router, phase]);

  useEffect(() => {
    return () => {
      if (fallbackRedirectRef.current) {
        window.clearTimeout(fallbackRedirectRef.current);
      }
      if (submitWatchdogRef.current) {
        window.clearTimeout(submitWatchdogRef.current);
      }
    };
  }, []);

  const recordLoginAttempt = async (success: boolean, email?: string) => {
    try {
      await fetch('/api/auth/login-attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'record',
          success,
          email: email || undefined,
        }),
      });
    } catch {
      /* non-fatal */
    }
  };

  const completeSignInRedirect = () => {
    setStatus('Success! Redirecting...');
    if (submitWatchdogRef.current) {
      window.clearTimeout(submitWatchdogRef.current);
      submitWatchdogRef.current = null;
    }
    void recordLoginAttempt(true);
    router.replace('/trips');
    fallbackRedirectRef.current = window.setTimeout(() => {
      window.location.assign('/trips');
    }, 1500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = (emailRef.current?.value || '').trim();
    const password = (passwordRef.current?.value || '');
    setError('');
    setStatus('');
    setLoading(true);
    if (submitWatchdogRef.current) window.clearTimeout(submitWatchdogRef.current);
    submitWatchdogRef.current = window.setTimeout(() => {
      setLoading(false);
      setStatus('');
      setError(
        'Sign-in is taking longer than expected. If this works in Incognito, a browser extension may be interfering with auth cookies. Try disabling extensions for this site and retry.',
      );
    }, 25_000);

    try {
      const pre = await fetch('/api/auth/login-attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'precheck' }),
      });
      if (pre.status === 429) {
        const j = (await pre.json().catch(() => ({}))) as { error?: string };
        setError(j.error || 'Too many login attempts. Please try again later.');
        setStatus('');
        setLoading(false);
        return;
      }

      const signInResult = await Promise.race([
        supabase.auth.signInWithPassword({ email, password }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Sign-in timed out. Please check your connection and try again.')), 15_000),
        ),
      ]);
      const { data, error: err } = signInResult;

      if (err) {
        const msg = /invalid login credentials/i.test(err.message)
          ? 'Incorrect email or password. Please try again.'
          : err.message;
        setError(msg);
        setStatus('');
        setLoading(false);
        void recordLoginAttempt(false, email);
        return;
      }

      if (data.session) {
        if (submitWatchdogRef.current) {
          window.clearTimeout(submitWatchdogRef.current);
          submitWatchdogRef.current = null;
        }
        const { data: factors, error: lfErr } = await supabase.auth.mfa.listFactors();
        if (lfErr) {
          setError(lfErr.message);
          setLoading(false);
          return;
        }
        const hasTOTP = (factors?.totp?.length ?? 0) > 0;
        if (hasTOTP) {
          setPhase('mfa');
          setLoading(false);
          return;
        }
        completeSignInRedirect();
        setLoading(false);
        return;
      }

      setError('No session returned. Try again.');
      setStatus('');
      setLoading(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(msg);
      setStatus('');
      setLoading(false);
    }
  };

  if (phase === 'mfa') {
    if (mfaBlocked) {
      return (
        <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 400, margin: '80px auto', padding: '0 24px' }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A2B4A' }}>Too many attempts</h1>
          <p style={{ fontSize: 14, color: '#666', marginTop: 12 }}>
            Please wait before trying again or contact support if you are locked out.
          </p>
          <Link href="/signin" style={{ display: 'inline-block', marginTop: 20, color: '#2E5FA3', fontWeight: 600 }}>
            Start over
          </Link>
        </div>
      );
    }
    return (
      <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 440, margin: '60px auto', padding: '0 24px' }}>
        <MFAChallenge
          onVerified={() => completeSignInRedirect()}
          onExhaustedTries={() => setMfaBlocked(true)}
        />
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 400, margin: '80px auto', padding: '0 24px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A2B4A', marginBottom: 8 }}>Sign in</h1>
      <p style={{ fontSize: 14, color: '#666', marginBottom: 28 }}>Good to have you back.</p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#444', marginBottom: 6 }}>Email</label>
          <input
            ref={emailRef}
            type="email"
            required
            placeholder="you@example.com"
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: 14, border: '1px solid #ddd', borderRadius: 8, outline: 'none' }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: '#444' }}>Password</label>
            <Link href="/forgot-password" style={{ fontSize: 12, color: '#2E5FA3', textDecoration: 'none' }}>Forgot password?</Link>
          </div>
          <div style={{ position: 'relative' }}>
            <input
              ref={passwordRef}
              type={show ? 'text' : 'password'}
              required
              placeholder="••••••••"
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 40px 10px 12px', fontSize: 14, border: '1px solid #ddd', borderRadius: 8, outline: 'none' }}
            />
            <button type="button" onClick={() => setShow(s => !s)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: 12 }}>
              {show ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {status && <p style={{ fontSize: 13, color: '#2E5FA3', margin: 0 }}>{status}</p>}
        {error && <p style={{ fontSize: 13, color: '#dc2626', margin: 0 }}>{error}</p>}

        <button
          type="submit"
          disabled={loading}
          style={{ padding: '11px 0', background: loading ? '#93afd4' : '#1A2B4A', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <p style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: '#888' }}>
        No account?{' '}
        <Link href="/signup" style={{ color: '#2E5FA3', fontWeight: 500, textDecoration: 'none' }}>Start free</Link>
      </p>
      <p style={{ marginTop: 10, textAlign: 'center', fontSize: 12, color: '#9ca3af', lineHeight: 1.5 }}>
        If Chrome with extensions hangs but Incognito works, disable extensions for this site and allow cookies/storage.
      </p>
      <p style={{ marginTop: 8, textAlign: 'center', fontSize: 12, color: '#9ca3af', lineHeight: 1.5 }}>
        By continuing, you agree to our Terms and Privacy Policy.
      </p>
    </div>
  );
}
