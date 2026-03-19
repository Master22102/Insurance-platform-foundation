'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/auth/supabase-client';

type Step = 'terms' | 'signal';

function chipify(text: string): string[] {
  const raw = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const uniq = new Set<string>();
  for (const w of raw) {
    if (w.length < 4) continue;
    if (['this', 'that', 'with', 'have', 'from', 'your', 'what', 'when', 'where', 'help', 'want'].includes(w)) continue;
    uniq.add(w);
    if (uniq.size >= 8) break;
  }
  return Array.from(uniq);
}

export default function OnboardingPage() {
  const { user, profile, refreshProfile } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>('terms');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [mode, setMode] = useState<'voice' | 'type'>('voice');
  const [typed, setTyped] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const proposed = useMemo(() => {
    const text = typed.trim();
    if (!text) return null;
    const lines = text.split(/[.!\n]/).map((s) => s.trim()).filter(Boolean).slice(0, 4);
    return {
      summaryBullets: lines.length ? lines : [text.slice(0, 160)],
      chips: chipify(text),
    };
  }, [typed]);

  const termsVersion = 'vX.Y';
  const privacyVersion = 'vA.B';

  const canContinueTerms = termsAccepted && privacyAccepted;

  const saveAndFinish = async (payload: any) => {
    if (!user) return;
    setSaving(true);
    setError('');
    try {
      const preferences = {
        onboarding: {
          terms: { accepted: true, version: termsVersion, accepted_at: new Date().toISOString() },
          privacy: { accepted: true, version: privacyVersion, accepted_at: new Date().toISOString() },
          signal: payload,
        },
      };

      const { data: updated, error: updateErr } = await supabase
        .from('user_profiles')
        .update({ onboarding_completed: true, preferences })
        .eq('user_id', user.id)
        .select('user_id')
        .maybeSingle();
      if (updateErr) throw updateErr;
      if (!updated?.user_id) throw new Error('Profile could not be updated (missing row).');

      await refreshProfile();
      router.replace('/get-started');
    } catch (e: any) {
      setError(e?.message || 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  if (profile?.onboarding_completed) {
    router.replace('/get-started');
    return null;
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ marginBottom: 22 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#aaa', letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>
          Welcome
        </p>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1A2B4A', margin: '8px 0 0', letterSpacing: '-0.5px' }}>
          {step === 'terms' ? 'Terms & Privacy' : 'What are your expectations of the platform?'}
        </h1>
      </div>

      {step === 'terms' ? (
        <div style={{ background: 'white', border: '1px solid #eaeaea', borderRadius: 14, padding: '22px 22px' }}>
          <p style={{ fontSize: 14, color: '#555', margin: '0 0 14px', lineHeight: 1.6 }}>
            We&apos;ll never silently change your trip or coverage. You stay in control.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
              <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} />
              <span style={{ fontSize: 14, color: '#333', lineHeight: 1.5 }}>
                I agree to Terms &amp; Conditions ({termsVersion}){' '}
                <Link href="/terms" style={{ color: '#2E5FA3', textDecoration: 'none', fontWeight: 600 }} target="_blank">
                  (read)
                </Link>
              </span>
            </label>

            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
              <input type="checkbox" checked={privacyAccepted} onChange={(e) => setPrivacyAccepted(e.target.checked)} />
              <span style={{ fontSize: 14, color: '#333', lineHeight: 1.5 }}>
                I agree to Privacy ({privacyVersion}){' '}
                <Link href="/privacy" style={{ color: '#2E5FA3', textDecoration: 'none', fontWeight: 600 }} target="_blank">
                  (read)
                </Link>
              </span>
            </label>
          </div>

          {error && (
            <div style={{ padding: '10px 12px', background: '#fef9f0', border: '1px solid #fde68a', borderRadius: 10, fontSize: 13, color: '#92400e' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
            <button
              disabled={!canContinueTerms}
              onClick={() => setStep('signal')}
              style={{
                padding: '10px 16px',
                background: canContinueTerms ? '#1A2B4A' : '#cbd5e1',
                color: 'white',
                border: 'none',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 700,
                cursor: canContinueTerms ? 'pointer' : 'not-allowed',
              }}
            >
              Accept and continue
            </button>
          </div>

          <p style={{ fontSize: 12, color: '#888', margin: '14px 0 0', lineHeight: 1.5 }}>
            You must accept before continuing.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: 'white', border: '1px solid #eaeaea', borderRadius: 14, padding: '22px 22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 10 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setMode('voice')}
                  style={{
                    background: mode === 'voice' ? '#eff4fc' : 'transparent',
                    border: mode === 'voice' ? '1px solid #bfdbfe' : '1px solid transparent',
                    color: mode === 'voice' ? '#1D4ED8' : '#888',
                    fontSize: 12,
                    fontWeight: 700,
                    borderRadius: 999,
                    padding: '6px 10px',
                    cursor: 'pointer',
                  }}
                >
                  Narrate
                </button>
                <button
                  onClick={() => setMode('type')}
                  style={{
                    background: mode === 'type' ? '#eff4fc' : 'transparent',
                    border: mode === 'type' ? '1px solid #bfdbfe' : '1px solid transparent',
                    color: mode === 'type' ? '#1D4ED8' : '#888',
                    fontSize: 12,
                    fontWeight: 700,
                    borderRadius: 999,
                    padding: '6px 10px',
                    cursor: 'pointer',
                  }}
                >
                  Type
                </button>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => saveAndFinish({ skipped: true })}
                  disabled={saving}
                  style={{ background: 'transparent', border: 'none', color: '#888', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}
                >
                  Skip for now
                </button>
              </div>
            </div>

            {mode === 'voice' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: '#f8fbff', border: '1px solid #e3eefc', borderRadius: 12, padding: 12 }}>
                <button
                  type="button"
                  disabled
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    border: '1px solid #dbeafe',
                    background: '#eff6ff',
                    cursor: 'not-allowed',
                  }}
                  aria-label="Microphone (coming soon)"
                  title="Microphone capture is pluggable and will be added next."
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M12 14a3 3 0 003-3V5a3 3 0 10-6 0v6a3 3 0 003 3z" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M19 11a7 7 0 01-14 0" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M12 18v3" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M8 21h8" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
                <div>
                  <p style={{ fontSize: 14, color: '#555', margin: '0 0 4px', lineHeight: 1.5 }}>
                    Go ahead and speak.
                  </p>
                  <p style={{ fontSize: 12, color: '#999', margin: 0, lineHeight: 1.5 }}>
                    Max 5 minutes. Voice is proposal-only until you confirm.
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 8 }}>
                  Tell us what you want Wayfarer to help with
                </label>
                <textarea
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder="e.g. I want help staying on top of visas, finding concerts, and understanding what my credit card covers if my flight is delayed…"
                  rows={6}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    border: '1px solid #e5e7eb',
                    borderRadius: 12,
                    padding: '12px 12px',
                    fontSize: 14,
                    outline: 'none',
                    resize: 'vertical',
                    lineHeight: 1.55,
                  }}
                />
              </div>
            )}
          </div>

          {(mode === 'type' && typed.trim().length > 0) && (
          <div style={{ background: 'white', border: '1px solid #eaeaea', borderRadius: 14, padding: '22px 22px' }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: '#1A2B4A', margin: '0 0 10px', letterSpacing: '-0.2px' }}>
              Here&apos;s what I heard
            </h2>

            {!proposed ? (
              <p style={{ fontSize: 13, color: '#888', margin: 0, lineHeight: 1.6 }}>
                Add a quick note (or skip for now). Nothing is committed until you confirm.
              </p>
            ) : (
              <>
                <ul style={{ margin: '0 0 12px', paddingLeft: 18, color: '#555' }}>
                  {proposed.summaryBullets.map((b) => (
                    <li key={b} style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 4 }}>{b}</li>
                  ))}
                </ul>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {proposed.chips.map((c) => (
                    <span key={c} style={{ fontSize: 11, fontWeight: 700, color: '#2E5FA3', background: '#eff4fc', border: '1px solid #bfdbfe', borderRadius: 999, padding: '4px 10px' }}>
                      {c}
                    </span>
                  ))}
                </div>
              </>
            )}

            {error && (
              <div style={{ marginTop: 12, padding: '10px 12px', background: '#fef9f0', border: '1px solid #fde68a', borderRadius: 10, fontSize: 13, color: '#92400e' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button
                type="button"
                onClick={() => { setTyped(''); setMode('type'); }}
                disabled={saving}
                style={{ padding: '10px 14px', background: '#f5f5f5', border: '1px solid #e5e5e5', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => saveAndFinish({ mode, typed: typed.trim(), proposal: proposed })}
                disabled={saving}
                style={{ padding: '10px 14px', background: '#1A2B4A', color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer' }}
              >
                {saving ? 'Saving…' : 'Confirm'}
              </button>
            </div>

            <p style={{ fontSize: 12, color: '#888', margin: '12px 0 0', lineHeight: 1.5 }}>
              Confirm is the only action that writes your profile.
            </p>
          </div>
          )}

          {mode === 'voice' && (
            <div style={{ background: 'white', border: '1px solid #eaeaea', borderRadius: 14, padding: '16px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <p style={{ fontSize: 13, color: '#666', margin: 0 }}>
                No voice text will be saved until you confirm.
              </p>
              <button
                type="button"
                onClick={() => saveAndFinish({ mode: 'voice', skipped: true })}
                disabled={saving}
                style={{ padding: '10px 14px', background: '#1A2B4A', color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer' }}
              >
                {saving ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

