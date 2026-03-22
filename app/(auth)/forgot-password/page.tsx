'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/auth/supabase-client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (err) {
      setError('Something went wrong. Please try again.');
    } else {
      setSent(true);
    }
  };

  if (sent) {
    return (
      <>
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background: '#f0fdf4', border: '1px solid #bbf7d0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 20,
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2z" stroke="#16a34a" strokeWidth="1.7"/>
            <path d="M22 6l-10 7L2 6" stroke="#16a34a" strokeWidth="1.7" strokeLinecap="round"/>
          </svg>
        </div>
        <h1 style={{
          fontSize: 20, fontWeight: 700, color: '#1A2B4A',
          margin: '0 0 8px', letterSpacing: '-0.3px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          Check your inbox
        </h1>
        <p style={{ fontSize: 14, color: '#666', margin: '0 0 28px', lineHeight: 1.6 }}>
          We sent a reset link to <strong style={{ color: '#333' }}>{email}</strong>. Click the link in the email to set a new password.
        </p>
        <p style={{ fontSize: 13, color: '#aaa', lineHeight: 1.5 }}>
          Didn&apos;t receive it? Check your spam folder, or{' '}
          <button
            onClick={() => setSent(false)}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#2E5FA3', fontSize: 13, fontWeight: 500 }}
          >
            try again
          </button>.
        </p>
        <p style={{ marginTop: 28, textAlign: 'center', fontSize: 13, color: '#888' }}>
          <Link href="/signin" style={{ color: '#2E5FA3', fontWeight: 500, textDecoration: 'none' }}>
            Back to sign in
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
        Reset your password
      </h1>
      <p style={{ fontSize: 14, color: '#666', margin: '0 0 28px', lineHeight: 1.5 }}>
        Enter your email and we&apos;ll send you a link to set a new password.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#444', marginBottom: 6 }}>
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
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
          disabled={loading}
          style={{
            width: '100%', padding: '11px 0',
            background: loading ? '#93afd4' : '#1A2B4A',
            color: 'white', border: 'none', borderRadius: 8,
            fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            marginTop: 4,
          }}
        >
          {loading ? 'Sending...' : 'Send reset link'}
        </button>
      </form>

      <p style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: '#888' }}>
        Remembered it?{' '}
        <Link href="/signin" style={{ color: '#2E5FA3', fontWeight: 500, textDecoration: 'none' }}>
          Sign in
        </Link>
      </p>
    </>
  );
}
