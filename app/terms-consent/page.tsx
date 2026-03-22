'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

const TERMS_KEY = 'wayfarer_terms_consent_v1';
const TERMS_AT_KEY = 'wayfarer_terms_accepted_at';

export default function TermsConsentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextTarget = useMemo(() => {
    const raw = searchParams.get('next');
    if (raw === '/signin' || raw === '/signup') return raw;
    return '/signup';
  }, [searchParams]);

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [saving, setSaving] = useState(false);

  const canContinue = termsAccepted && privacyAccepted && !saving;

  const acceptAndContinue = () => {
    if (!canContinue) return;
    setSaving(true);
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(TERMS_KEY, '1');
        window.localStorage.setItem(TERMS_AT_KEY, new Date().toISOString());
      }
      router.replace(nextTarget);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 680, margin: '48px auto', padding: '0 20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <h1 style={{ margin: '0 0 10px', color: '#1A2B4A', fontSize: 30, fontWeight: 800, letterSpacing: '-0.4px' }}>
        Terms & Conditions
      </h1>
      <p style={{ margin: '0 0 22px', color: '#555', fontSize: 14, lineHeight: 1.6 }}>
        Before using Wayfarer, review and accept our terms and privacy policy.
      </p>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 18, background: 'white' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
            <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} />
            <span style={{ fontSize: 14, color: '#222', lineHeight: 1.5 }}>
              I agree to Terms &amp; Conditions (vX.Y){' '}
              <Link href="/terms" target="_blank" style={{ color: '#2E5FA3', textDecoration: 'none', fontWeight: 600 }}>
                (read)
              </Link>
            </span>
          </label>

          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
            <input type="checkbox" checked={privacyAccepted} onChange={(e) => setPrivacyAccepted(e.target.checked)} />
            <span style={{ fontSize: 14, color: '#222', lineHeight: 1.5 }}>
              I agree to Privacy (vA.B){' '}
              <Link href="/privacy" target="_blank" style={{ color: '#2E5FA3', textDecoration: 'none', fontWeight: 600 }}>
                (read)
              </Link>
            </span>
          </label>
        </div>

        <button
          onClick={acceptAndContinue}
          disabled={!canContinue}
          style={{
            marginTop: 16,
            width: '100%',
            border: 'none',
            borderRadius: 10,
            padding: '11px 12px',
            fontSize: 14,
            fontWeight: 700,
            color: 'white',
            background: canContinue ? '#1A2B4A' : '#94a3b8',
            cursor: canContinue ? 'pointer' : 'not-allowed',
          }}
        >
          {saving ? 'Saving...' : 'Accept and continue'}
        </button>
      </div>
    </div>
  );
}

