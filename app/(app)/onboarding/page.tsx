'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/auth/supabase-client';
import { useSpeechCapture } from '@/lib/speech/useSpeechCapture';
import { insertVoiceArtifact } from '@/lib/voice/insert-voice-artifact';
import {
  type CategorizedChips,
  type SignalProfile,
  categorizeSignalChips,
  chipsFromText,
  categorizedToSignalProfile,
  fieldsToCategorized,
  mergeCategorized,
} from '@/lib/onboarding/signal-profile';

type Step = 'terms' | 'signal';

function TransitionScreen({ message }: { message: string }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(255,255,255,0.95)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        zIndex: 999,
        animation: 'fadeIn 0.35s ease',
      }}
    >
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
      <div
        style={{
          width: 28,
          height: 28,
          border: '2.5px solid #e5e5e5',
          borderTopColor: '#1A2B4A',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <p style={{ fontSize: 15, color: '#1A2B4A', fontWeight: 600 }}>{message}</p>
    </div>
  );
}

const emptyCat = (): CategorizedChips => ({
  places: [],
  activities: [],
  food: [],
  travelStyle: [],
  other: [],
});

async function categorizeSegment(text: string): Promise<CategorizedChips> {
  const chips = chipsFromText(text);
  let cat = categorizeSignalChips(chips);
  try {
    const res = await fetch('/api/voice/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: chips.join(', '),
        context: 'signal_categorize',
      }),
    });
    const j = await res.json();
    if (j.parsed && j.fields && typeof j.fields === 'object') {
      cat = mergeCategorized(cat, fieldsToCategorized(j.fields));
    }
  } catch {
    /* offline — heuristics only */
  }
  return cat;
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
  const [voiceState, setVoiceState] = useState<'idle' | 'recording'>('idle');
  const [voiceError, setVoiceError] = useState('');
  const signalTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [signalPhase, setSignalPhase] = useState<'capture' | 'review'>('capture');
  const [narrationParts, setNarrationParts] = useState<string[]>([]);
  const [accumulatedCat, setAccumulatedCat] = useState<CategorizedChips>(emptyCat);
  const [highlightTokens, setHighlightTokens] = useState<Set<string>>(new Set());
  const [detailPreference, setDetailPreference] = useState<SignalProfile['detail_preference']>('balanced');
  const [editingCard, setEditingCard] = useState<keyof CategorizedChips | null>(null);
  const narrationPartsRef = useRef<string[]>([]);

  const [bootTransition, setBootTransition] = useState(false);
  const [termsTransition, setTermsTransition] = useState(false);
  const [finishTransition, setFinishTransition] = useState(false);

  const { start: startSpeech, stop: stopSpeech, reset: resetSpeech, lastTranscriptRef } = useSpeechCapture({
    continuous: true,
    maxDurationMs: 5 * 60 * 1000,
    onTranscript: (text, _isFinal) => {
      const t = text.trim();
      if (!t) return;
      setVoiceState('recording');
      const parts = narrationPartsRef.current;
      setTyped(parts.length ? `${parts.join(' ')} ${t}`.trim() : t);
    },
    onError: (message) => {
      setVoiceError(message);
      setVoiceState('idle');
    },
  });

  const termsVersion = 'vX.Y';
  const privacyVersion = 'vA.B';
  const canContinueTerms = termsAccepted && privacyAccepted;

  useEffect(() => {
    narrationPartsRef.current = narrationParts;
  }, [narrationParts]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem('wayfarer_onboarding_boot')) return;
    setBootTransition(true);
    const t = window.setTimeout(() => {
      sessionStorage.setItem('wayfarer_onboarding_boot', '1');
      setBootTransition(false);
    }, 1500);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!profile?.onboarding_completed) return;
    const anchorDone = profile.preferences?.onboarding?.anchor_selection?.completed === true;
    router.replace(anchorDone ? '/trips' : '/get-started');
  }, [profile?.onboarding_completed, profile?.preferences, router]);

  const toggleVoiceCapture = async () => {
    if (voiceState === 'recording') {
      stopSpeech();
      setVoiceState('idle');
      const seg = (lastTranscriptRef.current || '').trim();
      if (!seg) {
        setVoiceError('No speech captured. Try again or type instead.');
        return;
      }
      const prevFlat = new Set(
        [...accumulatedCat.places, ...accumulatedCat.activities, ...accumulatedCat.food, ...accumulatedCat.travelStyle, ...accumulatedCat.other].map(
          (s) => s.toLowerCase(),
        ),
      );
      const deltaCat = await categorizeSegment(seg);
      const newTok = new Set<string>();
      for (const x of [...deltaCat.places, ...deltaCat.activities, ...deltaCat.food, ...deltaCat.travelStyle, ...deltaCat.other]) {
        if (!prevFlat.has(x.toLowerCase())) newTok.add(x);
      }
      setHighlightTokens(newTok);
      setAccumulatedCat((prev) => mergeCategorized(prev, deltaCat));
      setNarrationParts((p) => {
        const next = [...p, seg];
        setTyped(next.join(' '));
        return next;
      });
      setSignalPhase('review');
      return;
    }

    setVoiceError('');
    resetSpeech();
    if (narrationParts.length === 0) {
      setTyped('');
    }
    setVoiceState('recording');
    startSpeech();
  };

  const startVoiceRound = () => {
    setVoiceError('');
    resetSpeech();
    setVoiceState('recording');
    startSpeech();
  };

  const runTypeReview = useCallback(async () => {
    const t = typed.trim();
    if (!t) return;
    const cat = await categorizeSegment(t);
    setAccumulatedCat(cat);
    setHighlightTokens(new Set());
    setNarrationParts([t]);
    setSignalPhase('review');
  }, [typed]);

  const saveAndFinish = async (payload: { skipped?: boolean; signalProfile?: SignalProfile; rawTranscript?: string }) => {
    if (!user) return;
    setSaving(true);
    setError('');
    try {
      const acceptedAt =
        typeof window !== 'undefined'
          ? window.localStorage.getItem('wayfarer_terms_accepted_at') || new Date().toISOString()
          : new Date().toISOString();
      const existingPreferences = profile?.preferences && typeof profile.preferences === 'object' ? profile.preferences : {};
      const onboardingPrefs =
        existingPreferences.onboarding && typeof existingPreferences.onboarding === 'object' ? existingPreferences.onboarding : {};

      const signalProfile = payload.skipped ? undefined : payload.signalProfile;

      const preferences = {
        ...existingPreferences,
        ...(signalProfile ? { signal_profile: signalProfile } : {}),
        onboarding: {
          ...onboardingPrefs,
          terms: { accepted: true, version: termsVersion, accepted_at: acceptedAt },
          privacy: { accepted: true, version: privacyVersion, accepted_at: acceptedAt },
          signal: payload.skipped
            ? { source: 'skipped', skipped: true }
            : {
                source: mode,
                capture_rounds: signalProfile?.capture_rounds ?? 0,
                confirmed_at: new Date().toISOString(),
              },
          anchor_selection: {
            completed: true,
            choice: 'trip' as const,
            completed_at: new Date().toISOString(),
          },
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

      if (!payload.skipped && payload.rawTranscript && signalProfile) {
        await insertVoiceArtifact(supabase, {
          account_id: user.id,
          capture_context: 'signal_capture',
          transcript_raw: payload.rawTranscript,
          transcript_normalized: payload.rawTranscript.charAt(0).toUpperCase() + payload.rawTranscript.slice(1),
          parse_attempt: accumulatedCat as unknown as Record<string, unknown>,
          confirmation_state: 'confirmed',
          confirmed_fields: signalProfile as unknown as Record<string, unknown>,
          confirmed_at: new Date().toISOString(),
          confirmed_by: user.id,
        });
      }

      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('wayfarer_anchor_selected', '1');
      }

      await refreshProfile();
      router.replace('/trips');
    } catch (e: any) {
      setError(e?.message || 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const confirmSignal = async () => {
    const raw = typed.trim();
    let profile = categorizedToSignalProfile(accumulatedCat, Math.max(1, narrationParts.length || (raw ? 1 : 0)), detailPreference);
    try {
      const res = await fetch('/api/voice/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: raw, context: 'signal_capture' }),
      });
      const j = await res.json();
      if (j.parsed && j.fields) {
        const f = j.fields as Record<string, unknown>;
        if (typeof f.travel_style === 'string' && f.travel_style.trim()) profile = { ...profile, travel_style: f.travel_style.trim() };
        if (f.detail_preference === 'simple' || f.detail_preference === 'balanced' || f.detail_preference === 'detailed') {
          profile = { ...profile, detail_preference: f.detail_preference };
        }
        const mergeStr = (a: string[], b: string[]) => {
          const seen = new Set<string>();
          const out: string[] = [];
          for (const s of [...a, ...b]) {
            const k = s.toLowerCase();
            if (seen.has(k)) continue;
            seen.add(k);
            out.push(s);
          }
          return out;
        };
        if (Array.isArray(f.places)) profile.places = mergeStr(profile.places, f.places as string[]);
        if (Array.isArray(f.activities)) profile.activities = mergeStr(profile.activities, f.activities as string[]);
        if (Array.isArray(f.food_interests)) profile.food_interests = mergeStr(profile.food_interests, f.food_interests as string[]);
      }
    } catch {
      /* keep heuristic profile */
    }
    setFinishTransition(true);
    window.setTimeout(() => {
      void (async () => {
        await saveAndFinish({ signalProfile: profile, rawTranscript: raw });
        setFinishTransition(false);
      })();
    }, 1500);
  };

  const updateCardItems = (key: keyof CategorizedChips, lines: string) => {
    const items = lines
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    setAccumulatedCat((prev) => ({ ...prev, [key]: items }));
  };

  if (!user) return null;
  if (profile?.onboarding_completed) return null;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {bootTransition && <TransitionScreen message="Securing your account…" />}
      {termsTransition && <TransitionScreen message="Setting up your workspace…" />}
      {finishTransition && <TransitionScreen message="Building your dashboard…" />}

      <div style={{ marginBottom: 22 }}>
        <p
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: '#aaa',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            margin: 0,
          }}
        >
          Welcome
        </p>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1A2B4A', margin: '8px 0 0', letterSpacing: '-0.5px' }}>
          {step === 'terms' ? 'Terms and Conditions' : 'What are your expectations?'}
        </h1>
      </div>

      {step === 'terms' ? (
        <div style={{ background: 'white', border: '1px solid #eaeaea', borderRadius: 14, padding: '22px 22px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
              <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} />
              <span style={{ fontSize: 14, color: '#333', lineHeight: 1.5 }}>
                I agree to Terms and Conditions ({termsVersion}){' '}
                <Link href="/terms" style={{ color: '#2E5FA3', textDecoration: 'none', fontWeight: 600 }} target="_blank">
                  (read)
                </Link>
              </span>
            </label>

            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
              <input type="checkbox" checked={privacyAccepted} onChange={(e) => setPrivacyAccepted(e.target.checked)} />
              <span style={{ fontSize: 14, color: '#333', lineHeight: 1.5 }}>
                I agree to the Privacy Policy ({privacyVersion}){' '}
                <Link href="/privacy" style={{ color: '#2E5FA3', textDecoration: 'none', fontWeight: 600 }} target="_blank">
                  (read)
                </Link>
              </span>
            </label>
          </div>

          {error && (
            <div
              style={{
                padding: '10px 12px',
                background: '#fef9f0',
                border: '1px solid #fde68a',
                borderRadius: 10,
                fontSize: 13,
                color: '#92400e',
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
            <button
              disabled={!canContinueTerms}
              onClick={() => {
                setTermsTransition(true);
                window.setTimeout(() => {
                  setTermsTransition(false);
                  setStep('signal');
                }, 1000);
              }}
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
            <button
              disabled
              title="You must accept Terms and Conditions and Privacy Policy before proceeding."
              style={{
                marginLeft: 10,
                padding: '10px 16px',
                background: '#f1f5f9',
                color: '#94a3b8',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'not-allowed',
              }}
            >
              Read later
            </button>
          </div>

          <p style={{ fontSize: 12, color: '#888', margin: '14px 0 0', lineHeight: 1.5 }}>You must accept before continuing.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: 'white', border: '1px solid #eaeaea', borderRadius: 14, padding: '22px 22px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 14 }}>
              <button
                onClick={() => {
                  setMode('type');
                  setSignalPhase('capture');
                }}
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
                Type instead
              </button>
            </div>

            {signalPhase === 'capture' && mode === 'voice' ? (
              <div
                style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 200,
                  background: '#f8fbff',
                  border: '1px solid #e3eefc',
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                {voiceState !== 'recording' && (
                  <>
                    <span style={{ position: 'absolute', top: 14, left: 18, fontSize: 12, opacity: 0.4, color: '#475569' }}>
                      Places you want to visit
                    </span>
                    <span style={{ position: 'absolute', top: 14, right: 18, fontSize: 12, opacity: 0.4, color: '#475569' }}>
                      Group travel?
                    </span>
                    <span style={{ position: 'absolute', bottom: 14, left: 18, fontSize: 12, opacity: 0.4, color: '#475569' }}>
                      Food &amp; dining
                    </span>
                    <span style={{ position: 'absolute', bottom: 14, right: 18, fontSize: 12, opacity: 0.4, color: '#475569' }}>
                      Activities &amp; interests
                    </span>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => void toggleVoiceCapture()}
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    border: voiceState === 'recording' ? '1px solid #fecaca' : '1px solid #dbeafe',
                    background: voiceState === 'recording' ? '#fee2e2' : '#eff6ff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1,
                  }}
                  aria-label="Microphone"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 14a3 3 0 003-3V5a3 3 0 10-6 0v6a3 3 0 003 3z"
                      stroke={voiceState === 'recording' ? '#b91c1c' : '#1e40af'}
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                    <path
                      d="M19 11a7 7 0 01-14 0"
                      stroke={voiceState === 'recording' ? '#b91c1c' : '#1e40af'}
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                    <path d="M12 18v3M8 21h8" stroke={voiceState === 'recording' ? '#b91c1c' : '#1e40af'} strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
                <p style={{ fontSize: 14, color: '#555', margin: '12px 0 0', textAlign: 'center' }}>
                  {voiceState === 'recording' ? 'Listening… tap again to stop.' : 'Tap the mic to narrate.'}
                </p>
                {voiceError && <p style={{ fontSize: 12, color: '#b45309', margin: '8px 0 0' }}>{voiceError}</p>}
              </div>
            ) : signalPhase === 'capture' ? (
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 8 }}>
                  Tell us what you want Wayfarer to help with
                </label>
                <textarea
                  ref={signalTextareaRef}
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
                <button
                  type="button"
                  onClick={() => void runTypeReview()}
                  disabled={!typed.trim()}
                  style={{
                    marginTop: 10,
                    padding: '10px 16px',
                    background: typed.trim() ? '#1A2B4A' : '#cbd5e1',
                    color: 'white',
                    border: 'none',
                    borderRadius: 10,
                    fontWeight: 700,
                    cursor: typed.trim() ? 'pointer' : 'not-allowed',
                  }}
                >
                  Preview summary
                </button>
              </div>
            ) : null}
          </div>

          {signalPhase === 'review' && (
            <div style={{ background: 'white', border: '1px solid #eaeaea', borderRadius: 14, padding: '22px 22px' }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: '#1A2B4A', margin: '0 0 6px' }}>Here&apos;s what we heard</h2>
              <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 14px' }}>Review by category — tap a card to edit.</p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                {(
                  [
                    { key: 'places' as const, emoji: '🌍', label: 'Places', bg: '#eff6ff' },
                    { key: 'activities' as const, emoji: '🎯', label: 'Activities', bg: '#ecfdf5' },
                    { key: 'food' as const, emoji: '🍽️', label: 'Food', bg: '#fffbeb' },
                    { key: 'travelStyle' as const, emoji: '✈️', label: 'Travel style', bg: '#f5f3ff' },
                  ] as const
                ).map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setEditingCard(c.key)}
                    style={{
                      textAlign: 'left',
                      padding: 12,
                      borderRadius: 12,
                      border: '1px solid #e5e7eb',
                      background: c.bg,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: 18, marginBottom: 4 }}>{c.emoji}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>{c.label}</div>
                    <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.45 }}>
                      {(accumulatedCat[c.key].length ? accumulatedCat[c.key] : ['—']).slice(0, 8).map((item) => {
                        const hi = highlightTokens.has(item);
                        return (
                        <span
                          key={`${c.key}-${item}`}
                          style={{
                            display: 'inline-block',
                            marginRight: 6,
                            marginBottom: 4,
                            fontWeight: hi ? 700 : 400,
                            boxShadow: hi ? '0 0 0 2px #38bdf8' : undefined,
                            borderRadius: 4,
                            padding: hi ? '0 4px' : 0,
                          }}
                        >
                          {item}
                        </span>
                        );
                      })}
                    </div>
                  </button>
                ))}
              </div>

              {editingCard && (
                <div style={{ marginBottom: 14, padding: 12, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                  <p style={{ fontSize: 12, fontWeight: 600, margin: '0 0 6px' }}>Edit {editingCard} (one item per line)</p>
                  <textarea
                    rows={5}
                    defaultValue={accumulatedCat[editingCard].join('\n')}
                    key={editingCard}
                    id="edit-card-ta"
                    style={{ width: '100%', boxSizing: 'border-box', fontSize: 13, borderRadius: 8, border: '1px solid #e2e8f0', padding: 8 }}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button
                      type="button"
                      onClick={() => {
                        const el = document.getElementById('edit-card-ta') as HTMLTextAreaElement;
                        if (el) updateCardItems(editingCard, el.value);
                        setEditingCard(null);
                      }}
                      style={{ padding: '8px 12px', background: '#1A2B4A', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600 }}
                    >
                      Save
                    </button>
                    <button type="button" onClick={() => setEditingCard(null)} style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, background: 'white' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Detail preference</label>
              <select
                value={detailPreference}
                onChange={(e) => setDetailPreference(e.target.value as SignalProfile['detail_preference'])}
                style={{ marginBottom: 14, padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
              >
                <option value="simple">Simple</option>
                <option value="balanced">Balanced</option>
                <option value="detailed">Detailed</option>
              </select>

              {error && (
                <div style={{ marginBottom: 12, padding: '10px 12px', background: '#fef9f0', border: '1px solid #fde68a', borderRadius: 10, fontSize: 13, color: '#92400e' }}>
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setSignalPhase('capture');
                  setMode('voice');
                  setHighlightTokens(new Set());
                  startVoiceRound();
                }}
                disabled={saving}
                style={{
                  width: '100%',
                  padding: '11px 0',
                  marginBottom: 10,
                  background: 'white',
                  border: '1px solid #1A2B4A',
                  color: '#1A2B4A',
                  borderRadius: 10,
                  fontWeight: 700,
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                + Continue narrating
              </button>
              <button
                type="button"
                onClick={() => void confirmSignal()}
                disabled={saving}
                style={{
                  width: '100%',
                  padding: '12px 0',
                  background: 'linear-gradient(180deg, #2E5FA3 0%, #1A2B4A 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 10,
                  fontWeight: 800,
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Saving…' : 'Confirm'}
              </button>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 12, fontSize: 13 }}>
                <button
                  type="button"
                  onClick={() => {
                    setMode('type');
                    setSignalPhase('capture');
                    queueMicrotask(() => signalTextareaRef.current?.focus());
                  }}
                  style={{ border: 'none', background: 'none', color: '#2E5FA3', cursor: 'pointer', fontWeight: 600 }}
                >
                  Edit
                </button>
                <span style={{ color: '#cbd5e1' }}>·</span>
                <button
                  type="button"
                  onClick={() => {
                    resetSpeech();
                    setTyped('');
                    setNarrationParts([]);
                    setAccumulatedCat(emptyCat());
                    setSignalPhase('capture');
                    setVoiceState('idle');
                    setHighlightTokens(new Set());
                  }}
                  style={{ border: 'none', background: 'none', color: '#64748b', cursor: 'pointer', fontWeight: 600 }}
                >
                  Start over
                </button>
              </div>
            </div>
          )}

          <p style={{ textAlign: 'center', margin: '4px 0 0' }}>
            <button
              type="button"
              onClick={() => void saveAndFinish({ skipped: true })}
              disabled={saving}
              style={{
                background: 'none',
                border: 'none',
                fontSize: 13,
                color: '#94a3b8',
                cursor: saving ? 'not-allowed' : 'pointer',
                textDecoration: 'underline',
              }}
            >
              Skip this step
            </button>
          </p>
        </div>
      )}
    </div>
  );
}
