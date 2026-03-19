'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/auth/supabase-client';

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

  // If already signed in, redirect immediately
  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/trips');
    }
  }, [user, authLoading, router]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = (emailRef.current?.value || '').trim();
    const password = passwordRef.current?.value || '';
    setError('');
    setStatus('Signing in...');
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
        return;
      }

      if (data.session) {
        setStatus('Success! Redirecting...');
        if (submitWatchdogRef.current) {
          window.clearTimeout(submitWatchdogRef.current);
          submitWatchdogRef.current = null;
        }
        router.replace('/trips');
        // Safety net in case client router is blocked by extension scripts.
        fallbackRedirectRef.current = window.setTimeout(() => {
          window.location.assign('/trips');
        }, 1500);
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
    } finally {
      if (submitWatchdogRef.current) {
        window.clearTimeout(submitWatchdogRef.current);
        submitWatchdogRef.current = null;
      }
    }
  };

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
    </div>
  );
}
