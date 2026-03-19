'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';

export default function EmailConfirmedPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      const timeout = window.setTimeout(() => router.replace('/trips'), 1800);
      return () => window.clearTimeout(timeout);
    }
  }, [loading, user, router]);

  return (
    <div
      style={{
        maxWidth: 480,
        margin: '80px auto',
        padding: '0 24px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 18,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M20 6L9 17l-5-5" stroke="#16a34a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <h1 style={{ fontSize: 24, margin: '0 0 10px', color: '#1A2B4A' }}>Email confirmed</h1>
      <p style={{ fontSize: 14, color: '#666', lineHeight: 1.6, margin: '0 0 24px' }}>
        Your account is confirmed and ready. {user ? 'We will take you into the app now.' : 'Sign in to continue.'}
      </p>

      {user ? (
        <Link
          href="/trips"
          style={{
            display: 'inline-block',
            padding: '10px 16px',
            background: '#1A2B4A',
            color: 'white',
            borderRadius: 8,
            textDecoration: 'none',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Continue to trips
        </Link>
      ) : (
        <Link
          href="/signin"
          style={{
            display: 'inline-block',
            padding: '10px 16px',
            background: '#1A2B4A',
            color: 'white',
            borderRadius: 8,
            textDecoration: 'none',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Sign in
        </Link>
      )}
    </div>
  );
}
