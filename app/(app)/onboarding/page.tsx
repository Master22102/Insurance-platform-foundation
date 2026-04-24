'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/auth/supabase-client';

const TRAVEL_STYLES = [
  { id: 'solo', emoji: '1', label: 'Solo traveler' },
  { id: 'couple', emoji: '2', label: 'Couple' },
  { id: 'family', emoji: '3+', label: 'Family' },
  { id: 'group', emoji: '4+', label: 'Group' },
  { id: 'business', emoji: 'B', label: 'Business' },
];

const TRIP_FREQUENCIES = [
  { id: 'first_trip', label: 'This is my first trip' },
  { id: 'few_times', label: 'A few times a year' },
  { id: 'monthly', label: 'About once a month' },
  { id: 'frequent', label: 'Frequent flyer' },
];

const COVERAGE_AWARENESS = [
  { id: 'has_insurance', label: 'I have travel insurance' },
  { id: 'credit_card', label: 'I have credit card benefits' },
  { id: 'not_sure', label: 'Not sure what I have' },
  { id: 'none', label: 'No coverage that I know of' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [travelStyle, setTravelStyle] = useState<string | null>(null);
  const [frequency, setFrequency] = useState<string | null>(null);
  const [coverage, setCoverage] = useState<string | null>(null);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [parsedPreview, setParsedPreview] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);

  const canAdvance = () => {
    if (step === 0) return !!travelStyle;
    if (step === 1) return !!frequency;
    if (step === 2) return !!coverage;
    if (step === 3) return true;
    return false;
  };

  const finish = async () => {
    if (!user) return;
    setSaving(true);

    const payload = {
      travel_style: travelStyle,
      trip_frequency: frequency,
      coverage_awareness: coverage,
      voice_transcript: voiceTranscript || null,
      voice_confirmed: confirmed,
    };

    await fetch('/api/signal-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_id: user.id, parsed_payload: payload, source_voice_artifact_id: null }),
    });

    await fetch('/api/account/anchor-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_id: user.id, anchor_path: 'first_trip' }),
    });

    router.push('/trips/new');
  };

  const handleVoiceParse = async () => {
    if (!voiceTranscript.trim()) return;
    const res = await fetch('/api/voice/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript: voiceTranscript, context: 'signal_capture' }),
    });
    if (res.ok) {
      const data = await res.json();
      setParsedPreview(
        data.confidence > 0
          ? JSON.stringify(data.parsed, null, 2)
          : `Recorded: "${voiceTranscript}" (AI parse not yet connected; transcript saved as-is)`
      );
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      if (voiceTranscript.trim()) handleVoiceParse();
    } else {
      setIsRecording(true);
      setParsedPreview(null);
      setConfirmed(false);
    }
  };

  const STEPS = ['Travel Style', 'Frequency', 'Coverage', 'Priorities'];

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '40px 20px',
      background: 'linear-gradient(180deg, #0d1b2e 0%, #1A2B4A 100%)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'white', textAlign: 'center', margin: '0 0 6px' }}>
          Welcome to Wayfarer
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', margin: '0 0 32px' }}>
          {STEPS[step]} ({step + 1} of {STEPS.length})
        </p>

        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 28 }}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === step ? 24 : 8, height: 8, borderRadius: 4,
                background: i <= step ? '#2E5FA3' : 'rgba(255,255,255,0.15)',
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </div>

        {/* Step 0: Travel Style */}
        {step === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'white', margin: '0 0 8px', textAlign: 'center' }}>
              How do you usually travel?
            </p>
            {TRAVEL_STYLES.map((ts) => (
              <button
                key={ts.id}
                onClick={() => setTravelStyle(ts.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '16px 18px', borderRadius: 12,
                  background: travelStyle === ts.id ? 'rgba(46,95,163,0.25)' : 'rgba(255,255,255,0.05)',
                  border: travelStyle === ts.id ? '1.5px solid #2E5FA3' : '0.5px solid rgba(255,255,255,0.08)',
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: travelStyle === ts.id ? 'linear-gradient(180deg, #2E5FA3, #1A2B4A)' : 'rgba(255,255,255,0.06)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700, color: 'white', flexShrink: 0,
                }}>
                  {ts.emoji}
                </span>
                <span style={{ fontSize: 15, fontWeight: 500, color: 'white' }}>{ts.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Step 1: Trip Frequency */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'white', margin: '0 0 8px', textAlign: 'center' }}>
              How often do you travel?
            </p>
            {TRIP_FREQUENCIES.map((tf) => (
              <button
                key={tf.id}
                onClick={() => setFrequency(tf.id)}
                style={{
                  padding: '16px 18px', borderRadius: 12,
                  background: frequency === tf.id ? 'rgba(46,95,163,0.25)' : 'rgba(255,255,255,0.05)',
                  border: frequency === tf.id ? '1.5px solid #2E5FA3' : '0.5px solid rgba(255,255,255,0.08)',
                  cursor: 'pointer', textAlign: 'left',
                  fontSize: 15, fontWeight: 500, color: 'white',
                  transition: 'all 0.15s ease',
                }}
              >
                {tf.label}
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Coverage Awareness */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'white', margin: '0 0 8px', textAlign: 'center' }}>
              What coverage do you have?
            </p>
            {COVERAGE_AWARENESS.map((ca) => (
              <button
                key={ca.id}
                onClick={() => setCoverage(ca.id)}
                style={{
                  padding: '16px 18px', borderRadius: 12,
                  background: coverage === ca.id ? 'rgba(46,95,163,0.25)' : 'rgba(255,255,255,0.05)',
                  border: coverage === ca.id ? '1.5px solid #2E5FA3' : '0.5px solid rgba(255,255,255,0.08)',
                  cursor: 'pointer', textAlign: 'left',
                  fontSize: 15, fontWeight: 500, color: 'white',
                  transition: 'all 0.15s ease',
                }}
              >
                {ca.label}
              </button>
            ))}
          </div>
        )}

        {/* Step 3: Voice Signal Capture */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'white', margin: 0, textAlign: 'center' }}>
              Tell us about your travel priorities
            </p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', margin: 0, textAlign: 'center', lineHeight: 1.55 }}>
              What matters most to you when you travel? You can type or use voice. This is optional.
            </p>

            <textarea
              value={voiceTranscript}
              onChange={(e) => { setVoiceTranscript(e.target.value); setParsedPreview(null); setConfirmed(false); }}
              placeholder="e.g. I care about having good cancellation coverage, being near medical facilities, and knowing my credit card benefits..."
              style={{
                width: '100%', minHeight: 100, padding: 14, borderRadius: 10,
                background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)',
                color: 'white', fontSize: 14, resize: 'vertical', lineHeight: 1.55,
                fontFamily: 'inherit',
              }}
            />

            <button
              onClick={toggleRecording}
              style={{
                width: 56, height: 56, borderRadius: '50%',
                background: isRecording
                  ? 'radial-gradient(circle, #ef4444 0%, #b91c1c 100%)'
                  : 'linear-gradient(180deg, #2E5FA3 0%, #1A2B4A 100%)',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: isRecording ? 'breathe 3s ease-in-out infinite' : 'none',
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                {isRecording ? (
                  <rect x="6" y="6" width="12" height="12" rx="2" fill="white"/>
                ) : (
                  <>
                    <rect x="9" y="2" width="6" height="11" rx="3" fill="white"/>
                    <path d="M5 10a7 7 0 0014 0" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                    <path d="M12 19v3" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                  </>
                )}
              </svg>
            </button>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
              {isRecording ? 'Tap to stop' : 'Tap to record (or type above)'}
            </span>

            {parsedPreview && (
              <div style={{
                width: '100%', padding: 14, borderRadius: 10,
                background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)',
              }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Preview
                </p>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', margin: 0, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                  {parsedPreview}
                </p>
                {!confirmed && (
                  <button
                    onClick={() => setConfirmed(true)}
                    style={{
                      marginTop: 10, padding: '7px 16px', borderRadius: 7,
                      background: '#2E5FA3', border: 'none', color: 'white',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Confirm transcript
                  </button>
                )}
                {confirmed && (
                  <p style={{ fontSize: 11, color: '#22c55e', margin: '8px 0 0', fontWeight: 600 }}>
                    Confirmed
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32, gap: 12 }}>
          {step > 0 ? (
            <button
              onClick={() => setStep(step - 1)}
              style={{
                padding: '12px 20px', borderRadius: 10,
                background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Back
            </button>
          ) : <div />}

          {step < 3 ? (
            <button
              onClick={() => canAdvance() && setStep(step + 1)}
              disabled={!canAdvance()}
              style={{
                padding: '12px 28px', borderRadius: 10,
                background: canAdvance() ? 'linear-gradient(180deg, #2E5FA3 0%, #1A2B4A 100%)' : 'rgba(255,255,255,0.08)',
                border: 'none', color: canAdvance() ? 'white' : 'rgba(255,255,255,0.3)',
                fontSize: 14, fontWeight: 600, cursor: canAdvance() ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s ease',
              }}
            >
              Continue
            </button>
          ) : (
            <button
              onClick={finish}
              disabled={saving}
              style={{
                padding: '12px 28px', borderRadius: 10,
                background: saving ? 'rgba(255,255,255,0.08)' : 'linear-gradient(180deg, #2E5FA3 0%, #1A2B4A 100%)',
                border: 'none', color: 'white',
                fontSize: 14, fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Saving...' : voiceTranscript.trim() ? 'Finish' : 'Skip & continue'}
            </button>
          )}
        </div>

        <style>{`@keyframes breathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }`}</style>
      </div>
    </div>
  );
}
