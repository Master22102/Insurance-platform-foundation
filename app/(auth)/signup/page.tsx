'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';

export default function SignUpPage() {
  const { signUp } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    const { error } = await signUp(email, password, name);
    setLoading(false);
    if (error) {
      if (error.message?.includes('already')) {
        setError('An account with that email already exists. Try signing in instead.');
      } else {
        setError('Something went wrong creating your account. Please try again.');
      }
    } else {
      setSent(true);
    }
  };

  if (sent) {
    return (
      <>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: '#f0fdf4', border: '1px solid #bbf7d0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 0 20px',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M20 6L9 17l-5-5" stroke="#16a34a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1 style={{
          fontSize: 20, fontWeight: 700, color: '#1A2B4A',
          margin: '0 0 10px', letterSpacing: '-0.3px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          Check your email
        </h1>
        <p style={{ fontSize: 14, color: '#555', margin: '0 0 8px', lineHeight: 1.6 }}>
          We sent a confirmation link to <strong>{email}</strong>.
        </p>
        <p style={{ fontSize: 13, color: '#888', margin: '0 0 24px', lineHeight: 1.6 }}>
          Click the link in the email to activate your account. Check your spam folder if you don't see it within a minute.
        </p>
        <p style={{ fontSize: 13, color: '#888', margin: 0 }}>
          Already confirmed?{' '}
          <Link href="/signin" style={{ color: '#2E5FA3', fontWeight: 500, textDecoration: 'none' }}>
            Sign in
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
        Create your account
      </h1>
      <p style={{ fontSize: 14, color: '#666', margin: '0 0 28px', lineHeight: 1.5 }}>
        Free to start. No credit card required.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#444', marginBottom: 6 }}>
            Your name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Alex"
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

        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#444', marginBottom: 6 }}>
            Password
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              required
              minLength={8}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '10px 40px 10px 12px', fontSize: 14,
                border: '1px solid #ddd', borderRadius: 8,
                outline: 'none', color: '#111',
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute', right: 10, top: '50%',
                transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                padding: 4, color: '#aaa', display: 'flex', alignItems: 'center',
              }}
            >
              {showPassword ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div style={{
            padding: '10px 14px',
            background: '#fef9f0', border: '1px solid #fde68a',
            borderRadius: 8, fontSize: 13, color: '#92400e', lineHeight: 1.5,
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
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: '#888' }}>
        Already have an account?{' '}
        <Link href="/signin" style={{ color: '#2E5FA3', fontWeight: 500, textDecoration: 'none' }}>
          Sign in
        </Link>
      </p>
    </>
  );
}
