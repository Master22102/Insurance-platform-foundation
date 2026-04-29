'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/auth/supabase-client';
import type { ContextualIntelligencePrefs } from '@/lib/context-engine/types';
import { DEFAULT_CONTEXTUAL_INTELLIGENCE_PREFS } from '@/lib/context-engine/types';
import { mergeContextualIntelligencePrefs } from '@/lib/context-engine/evaluate';
import type { SignalProfile } from '@/lib/onboarding/signal-profile';
import { defaultSignalProfile } from '@/lib/onboarding/signal-profile';
import AppPageRoot from '@/components/layout/AppPageRoot';

export default function ContextualIntelligenceSettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [prefs, setPrefs] = useState<ContextualIntelligencePrefs>(DEFAULT_CONTEXTUAL_INTELLIGENCE_PREFS);
  const [detailPreference, setDetailPreference] = useState<SignalProfile['detail_preference']>('balanced');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const raw =
      profile?.preferences && typeof profile.preferences === 'object'
        ? (profile.preferences as Record<string, unknown>).contextual_intelligence
        : undefined;
    setPrefs(mergeContextualIntelligencePrefs(raw));
    const sp = (profile?.preferences as Record<string, unknown> | undefined)?.signal_profile as
      | SignalProfile
      | undefined;
    const d = sp?.detail_preference;
    if (d === 'simple' || d === 'balanced' || d === 'detailed') setDetailPreference(d);
    else setDetailPreference('balanced');
  }, [profile?.preferences]);

  const persistDetailPreference = useCallback(
    async (next: SignalProfile['detail_preference']) => {
      if (!user) return;
      setSaving(true);
      setSaved(false);
      const base =
        profile?.preferences && typeof profile.preferences === 'object'
          ? { ...(profile.preferences as Record<string, unknown>) }
          : {};
      const prevSp =
        base.signal_profile && typeof base.signal_profile === 'object'
          ? (base.signal_profile as Record<string, unknown>)
          : {};
      const mergedSp = { ...defaultSignalProfile(), ...prevSp, detail_preference: next, last_updated: new Date().toISOString() };
      const preferences = { ...base, signal_profile: mergedSp };
      const { error } = await supabase.from('user_profiles').update({ preferences }).eq('user_id', user.id);
      setSaving(false);
      if (!error) {
        setSaved(true);
        setDetailPreference(next);
        await refreshProfile();
        setTimeout(() => setSaved(false), 2000);
      }
    },
    [user, profile?.preferences, refreshProfile],
  );

  const persist = useCallback(
    async (next: ContextualIntelligencePrefs) => {
      if (!user) return;
      setSaving(true);
      setSaved(false);
      const base =
        profile?.preferences && typeof profile.preferences === 'object'
          ? { ...(profile.preferences as Record<string, unknown>) }
          : {};
      const preferences = { ...base, contextual_intelligence: next };
      const { error } = await supabase.from('user_profiles').update({ preferences }).eq('user_id', user.id);
      setSaving(false);
      if (!error) {
        setSaved(true);
        await refreshProfile();
        setTimeout(() => setSaved(false), 2000);
      }
    },
    [user, profile?.preferences, refreshProfile],
  );

  const row = (key: keyof ContextualIntelligencePrefs, label: string, help: string) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '13px 18px',
        borderBottom: '1px solid #f5f5f5',
        gap: 12,
      }}
    >
      <div>
        <span style={{ fontSize: 14, color: '#444', fontWeight: 500 }}>{label}</span>
        <p style={{ fontSize: 11, color: '#9ca3af', margin: '4px 0 0', lineHeight: 1.45 }}>{help}</p>
      </div>
      <button
        type="button"
        data-testid={`ci-toggle-${String(key)}`}
        onClick={() => {
          const v = { ...prefs, [key]: !prefs[key] };
          setPrefs(v);
          void persist(v);
        }}
        style={{
          width: 44,
          height: 26,
          borderRadius: 13,
          background: prefs[key] ? '#1A2B4A' : '#e5e7eb',
          border: 'none',
          cursor: 'pointer',
          position: 'relative',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 3,
            left: prefs[key] ? 21 : 3,
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: 'white',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            transition: 'left 0.2s ease',
            display: 'block',
          }}
        />
      </button>
    </div>
  );

  return (
    <AppPageRoot style={{ maxWidth: 640, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <Link href="/account" style={{ fontSize: 13, color: '#888', textDecoration: 'none' }}>
        ← Account
      </Link>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A2B4A', margin: '16px 0 8px' }}>Contextual intelligence</h1>
      <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 20px', lineHeight: 1.55 }}>
        The &quot;Right now&quot; card on each trip uses rule-based prompts from your itinerary, incidents, and claims. No AI
        models — just timely nudges. FOCL can turn the feature off for everyone; these toggles are your personal
        preferences.
      </p>

      <div
        style={{
          background: 'white',
          border: '1px solid #eee',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        {row('enabled', 'Master toggle', 'When on, the app shows relevant information based on where you are in your trip.')}
        {row(
          'preparation_prompts',
          'Preparation prompts',
          'Reminders before your trip — download documents, review coverage, check readiness.',
        )}
        {row(
          'evidence_suggestions',
          'Evidence suggestions',
          'When something goes wrong — what to capture and why, based on your incident type.',
        )}
        {row(
          'disruption_guidance',
          'Disruption guidance',
          'Coverage thresholds, filing steps, and next actions during a disruption.',
        )}
        {row(
          'filing_deadline_warnings',
          'Filing deadline warnings',
          'Get reminded when a filing deadline is approaching.',
        )}
      </div>

      <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A2B4A', margin: '28px 0 8px' }}>Explanations &amp; detail</h2>
      <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 12px', lineHeight: 1.55 }}>
        How much structural detail you prefer in summaries and check-ins (onboarding no longer sets this).
      </p>
      <div
        style={{
          background: 'white',
          border: '1px solid #eee',
          borderRadius: 12,
          padding: '16px 18px',
        }}
      >
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 8 }}>
          Detail level
        </label>
        <select
          value={detailPreference}
          onChange={(e) => {
            const v = e.target.value as SignalProfile['detail_preference'];
            setDetailPreference(v);
            void persistDetailPreference(v);
          }}
          style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, minWidth: 220 }}
        >
          <option value="simple">Simple</option>
          <option value="balanced">Balanced</option>
          <option value="detailed">Detailed</option>
        </select>
      </div>

      <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 14 }} data-testid="ci-save-status">
        {saving ? 'Saving…' : saved ? 'Saved' : ''}
      </p>
    </AppPageRoot>
  );
}
