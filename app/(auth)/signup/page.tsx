'use client';

// TODO: Enable Supabase leaked password protection when upgrading to Pro plan
// Dashboard → Authentication → Settings → Leaked password protection

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';

export default function SignUpPage() {
  const { signUp } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordRules, setShowPasswordRules] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const TERMS_KEY = 'wayfarer_terms_consent_v1';
  const EXPOSED_PASSWORDS = new Set([
    'password',
    'password123',
    '12345678',
    'qwerty123',
    'letmein',
    'admin123',
    'welcome123',
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const accepted = window.localStorage.getItem(TERMS_KEY) === '1';
    if (!accepted) {
      router.replace('/terms-consent?next=/signup');
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const lowered = password.trim().toLowerCase();
    if (EXPOSED_PASSWORDS.has(lowered)) {
      setError("That password has appeared in known data exposures and can't be used here.");
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords must match.');
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
          Click the link in the email to activate your account. Check your spam folder if you don&apos;t see it within a minute.
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
      <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 18px', lineHeight: 1.5 }}>
        Some purchases may require a guardian if you&apos;re under 18.
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
          <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 8px', lineHeight: 1.5 }}>
            Use at least 8 characters, mix letters/numbers/symbols when you can, and avoid commonly exposed passwords.
          </p>
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
          {EXPOSED_PASSWORDS.has(password.trim().toLowerCase()) && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#b45309', lineHeight: 1.5 }}>
              That password has appeared in known data exposures and can&apos;t be used here.
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setPassword('')}
                  style={{ border: '1px solid #fcd34d', background: '#fffbeb', color: '#92400e', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  Try another password
                </button>
                <button
                  type="button"
                  onClick={() => setShowPasswordRules((s) => !s)}
                  style={{ border: '1px solid #e5e7eb', background: 'white', color: '#475569', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  Show password rules
                </button>
              </div>
            </div>
          )}
          {showPasswordRules && (
            <div
              style={{
                margin: '8px 0 0',
                padding: '10px 12px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                fontSize: 12,
                color: '#475569',
                lineHeight: 1.55,
              }}
            >
              <p style={{ margin: '0 0 6px', fontWeight: 700, color: '#334155' }}>Password rules</p>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li>Minimum 8 characters (longer is better).</li>
                <li>Mix letters, numbers, and symbols when you can.</li>
                <li>Don&apos;t reuse passwords from other sites.</li>
                <li>We block a short list of passwords known from public data breaches.</li>
              </ul>
            </div>
          )}
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#444', marginBottom: 6 }}>
            Confirm password
          </label>
          <input
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter password"
            required
            minLength={8}
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
      <p style={{ marginTop: 8, textAlign: 'center', fontSize: 12, color: '#9ca3af', lineHeight: 1.5 }}>
        By continuing, you agree to our Terms and Privacy Policy.
      </p>
    </>
  );
}
