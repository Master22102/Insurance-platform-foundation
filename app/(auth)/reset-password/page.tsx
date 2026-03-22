'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/auth/supabase-client';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [sessionReady, setSessionReady] = useState(false);
  const [linkExpired, setLinkExpired] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLinkExpired(true);
    }, 8000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        clearTimeout(timeout);
        setSessionReady(true);
      }
    });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } else {
      setDone(true);
      setTimeout(() => router.push('/trips'), 2500);
    }
  };

  if (done) {
    return (
      <>
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background: '#f0fdf4', border: '1px solid #bbf7d0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 20,
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M9 12l2 2 4-4" stroke="#16a34a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="12" cy="12" r="9" stroke="#16a34a" strokeWidth="1.7"/>
          </svg>
        </div>
        <h1 style={{
          fontSize: 20, fontWeight: 700, color: '#1A2B4A',
          margin: '0 0 8px', letterSpacing: '-0.3px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          Password updated
        </h1>
        <p style={{ fontSize: 14, color: '#666', margin: 0, lineHeight: 1.6 }}>
          Your new password is set. Taking you to your trips...
        </p>
      </>
    );
  }

  if (!sessionReady) {
    if (linkExpired) {
      return (
        <>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: '#fef2f2', border: '1px solid #fecaca',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 20,
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="#dc2626" strokeWidth="1.7"/>
              <path d="M12 8v4" stroke="#dc2626" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="12" cy="16" r="1" fill="#dc2626"/>
            </svg>
          </div>
          <h1 style={{
            fontSize: 20, fontWeight: 700, color: '#1A2B4A',
            margin: '0 0 8px', letterSpacing: '-0.3px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}>
            Link expired or invalid
          </h1>
          <p style={{ fontSize: 14, color: '#666', margin: '0 0 24px', lineHeight: 1.6 }}>
            This password reset link has expired or has already been used. Request a new one to continue.
          </p>
          <Link
            href="/forgot-password"
            style={{
              display: 'block', width: '100%', boxSizing: 'border-box',
              padding: '11px 0', textAlign: 'center',
              background: '#1A2B4A', color: 'white',
              borderRadius: 8, fontSize: 14, fontWeight: 600,
              textDecoration: 'none', fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            Request a new link
          </Link>
        </>
      );
    }

    return (
      <>
        <h1 style={{
          fontSize: 20, fontWeight: 700, color: '#1A2B4A',
          margin: '0 0 8px', letterSpacing: '-0.3px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          Set a new password
        </h1>
        <p style={{ fontSize: 14, color: '#888', margin: '0 0 24px', lineHeight: 1.5 }}>
          Verifying your reset link...
        </p>
        <div style={{
          width: 28, height: 28, border: '2.5px solid #e5e5e5',
          borderTopColor: '#1A2B4A', borderRadius: '50%',
          margin: '0 auto', animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ marginTop: 28, textAlign: 'center', fontSize: 13, color: '#888' }}>
          Didn&apos;t get a link?{' '}
          <Link href="/forgot-password" style={{ color: '#2E5FA3', fontWeight: 500, textDecoration: 'none' }}>
            Request one
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <h1 style={{
        fontSize: 20, fontWeight: 700, color: '#1A2B4A',
        margin: '0 0 6px', letterSpacing: '-0.3px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        Set a new password
      </h1>
      <p style={{ fontSize: 14, color: '#666', margin: '0 0 28px', lineHeight: 1.5 }}>
        Choose a strong password for your account.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#444', marginBottom: 6 }}>
            New password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            required
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '10px 12px', fontSize: 14,
              border: '1px solid #ddd', borderRadius: 8,
              outline: 'none', color: '#111',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#444', marginBottom: 6 }}>
            Confirm password
          </label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            required
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '10px 12px', fontSize: 14,
              border: `1px solid ${confirm && confirm !== password ? '#fca5a5' : '#ddd'}`,
              borderRadius: 8,
              outline: 'none', color: '#111',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          />
          {confirm && confirm !== password && (
            <p style={{ fontSize: 12, color: '#dc2626', margin: '5px 0 0' }}>Passwords don&apos;t match</p>
          )}
        </div>

        {error && (
          <div style={{
            padding: '10px 14px',
            background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: 8, fontSize: 13, color: '#dc2626', lineHeight: 1.5,
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || (!!confirm && confirm !== password)}
          style={{
            width: '100%', padding: '11px 0',
            background: loading ? '#93afd4' : '#1A2B4A',
            color: 'white', border: 'none', borderRadius: 8,
            fontSize: 14, fontWeight: 600,
            cursor: (loading || (!!confirm && confirm !== password)) ? 'not-allowed' : 'pointer',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            marginTop: 4,
            opacity: (!!confirm && confirm !== password) ? 0.6 : 1,
          }}
        >
          {loading ? 'Updating...' : 'Update password'}
        </button>
      </form>
    </>
  );
}
