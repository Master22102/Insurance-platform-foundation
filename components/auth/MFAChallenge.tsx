'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/auth/supabase-client';

const MAX_TRIES = 3;

type Props = {
  onVerified: () => void;
  onExhaustedTries?: () => void;
};

export function MFAChallenge({ onVerified, onExhaustedTries }: Props) {
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tries, setTries] = useState(0);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const loadingRef = useRef(false);

  const code = digits.join('');

  const verify = useCallback(
    async (full: string) => {
      if (full.length !== 6 || loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      setError(null);
      try {
        const { data: factors, error: lfErr } = await supabase.auth.mfa.listFactors();
        if (lfErr) throw lfErr;
        const factor = factors?.totp?.[0];
        if (!factor?.id) throw new Error('No authenticator enrolled');

        const challenge = await supabase.auth.mfa.challenge({ factorId: factor.id });
        if (challenge.error) throw challenge.error;

        const verifyRes = await supabase.auth.mfa.verify({
          factorId: factor.id,
          challengeId: challenge.data.id,
          code: full,
        });
        if (verifyRes.error) throw verifyRes.error;

        onVerified();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Invalid code';
        setError(msg);
        setTries((t) => {
          const nextTries = t + 1;
          if (nextTries >= MAX_TRIES) {
            void fetch('/api/auth/login-attempt', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'record', success: false }),
            }).catch(() => {});
            onExhaustedTries?.();
          }
          return nextTries;
        });
        setDigits(['', '', '', '', '', '']);
        inputsRef.current[0]?.focus();
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [onExhaustedTries, onVerified],
  );

  useEffect(() => {
    if (code.length === 6) {
      void verify(code);
    }
  }, [code, verify]);

  const setDigit = (index: number, value: string) => {
    const v = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = v;
    setDigits(next);
    if (v && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const onKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const onPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const t = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (t.length === 0) return;
    const next = ['', '', '', '', '', ''];
    for (let i = 0; i < t.length; i++) next[i] = t[i]!;
    setDigits(next);
    const focusIdx = Math.min(t.length, 5);
    inputsRef.current[focusIdx]?.focus();
  };

  return (
    <div style={{ maxWidth: 400, margin: '0 auto' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1A2B4A', marginBottom: 8 }}>
        Enter your authentication code
      </h2>
      <p style={{ fontSize: 14, color: '#666', marginBottom: 20 }}>
        Open your authenticator app and enter the 6-digit code for Wayfarer.
      </p>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16 }} onPaste={onPaste}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              inputsRef.current[i] = el;
            }}
            inputMode="numeric"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            aria-label={`Digit ${i + 1}`}
            value={d}
            onChange={(e) => setDigit(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(i, e)}
            disabled={loading}
            style={{
              width: 44,
              height: 48,
              textAlign: 'center',
              fontSize: 20,
              fontWeight: 600,
              border: '1px solid #ddd',
              borderRadius: 8,
            }}
          />
        ))}
      </div>

      {error && (
        <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }} role="alert">
          {error}
        </p>
      )}
      {tries > 0 && tries < MAX_TRIES && (
        <p style={{ color: '#92400e', fontSize: 12, marginBottom: 8 }}>
          {MAX_TRIES - tries} attempt{MAX_TRIES - tries === 1 ? '' : 's'} remaining.
        </p>
      )}
      {loading && <p style={{ fontSize: 13, color: '#2E5FA3' }}>Verifying…</p>}

      <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 24, lineHeight: 1.5 }}>
        Can&apos;t access your authenticator?{' '}
        <a href="mailto:support@wayfarer.app" style={{ color: '#2E5FA3' }}>
          Contact support
        </a>{' '}
        for account recovery options.
      </p>
    </div>
  );
}
