'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/auth/supabase-client';

export default function GetStartedPage() {
  const { user, profile, refreshProfile } = useAuth();
  const router = useRouter();
  const [savingChoice, setSavingChoice] = useState('');

  // Returning users who already completed onboarding + anchor should never sit on this screen again.
  useEffect(() => {
    if (!user || !profile) return;
    if (profile.onboarding_completed !== true) return;
    if (profile.preferences?.onboarding?.anchor_selection?.completed !== true) return;
    router.replace('/trips');
  }, [user, profile, router]);

  const completeAnchorSelection = async (choice: 'trip' | 'policy' | 'planning', target: string) => {
    if (savingChoice) return;
    setSavingChoice(choice);
    try {
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('wayfarer_anchor_selected', '1');
      }
      if (!user) {
        // If auth context is still warming up, keep forward progress instead of dead-clicking.
        router.push(target);
        return;
      }
      const existingPreferences = (profile?.preferences && typeof profile.preferences === 'object')
        ? profile.preferences
        : {};
      const onboardingPrefs = (existingPreferences.onboarding && typeof existingPreferences.onboarding === 'object')
        ? existingPreferences.onboarding
        : {};

      const preferences = {
        ...existingPreferences,
        onboarding: {
          ...onboardingPrefs,
          anchor_selection: {
            completed: true,
            choice,
            completed_at: new Date().toISOString(),
          },
        },
      };

      const { error, data } = await supabase
        .from('user_profiles')
        .update({ preferences })
        .eq('user_id', user.id)
        .select('user_id')
        .maybeSingle();
      if (error || !data) {
        console.warn('[get-started] could not persist anchor selection', error?.message ?? 'profile row missing');
      }

      await refreshProfile();
      router.push(target);
    } finally {
      setSavingChoice('');
    }
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <h1 style={{ fontSize: 28, fontWeight: 900, color: '#1A2B4A', margin: '0 0 10px', letterSpacing: '-0.6px' }}>
        Let&apos;s get started
      </h1>
      <p style={{ fontSize: 14, color: '#555', margin: '0 0 22px', lineHeight: 1.6 }}>
        Add a trip, add a policy, or start planning. You can do one now and the other later.
      </p>

      <div style={{ display: 'grid', gap: 12 }}>
        <button onClick={() => completeAnchorSelection('trip', '/trips')} disabled={savingChoice.length > 0} style={{
          background: 'white', border: '1px solid #eaeaea', borderRadius: 14, padding: '16px 16px',
          color: '#1A2B4A', width: '100%', textAlign: 'left', cursor: savingChoice ? 'not-allowed' : 'pointer',
        }}>
          <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 4 }}>Add a trip itinerary</div>
          <div style={{ fontSize: 13, color: '#666', lineHeight: 1.5 }}>Upload, import, paste, or enter your itinerary.</div>
        </button>

        <button onClick={() => completeAnchorSelection('policy', '/policies/upload')} disabled={savingChoice.length > 0} style={{
          background: 'white', border: '1px solid #eaeaea', borderRadius: 14, padding: '16px 16px',
          color: '#1A2B4A', width: '100%', textAlign: 'left', cursor: savingChoice ? 'not-allowed' : 'pointer',
        }}>
          <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 4 }}>Add an insurance policy</div>
          <div style={{ fontSize: 13, color: '#666', lineHeight: 1.5 }}>Upload a policy PDF or enter details manually.</div>
        </button>

        <button onClick={() => completeAnchorSelection('planning', '/trips')} disabled={savingChoice.length > 0} style={{
          background: '#f7f8fa', border: '1px solid #eaeaea', borderRadius: 14, padding: '16px 16px',
          color: '#1A2B4A', width: '100%', textAlign: 'left', cursor: savingChoice ? 'not-allowed' : 'pointer',
        }}>
          <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 4 }}>I&apos;m still planning</div>
          <div style={{ fontSize: 13, color: '#666', lineHeight: 1.5 }}>Create a trip when you&apos;re ready.</div>
        </button>
      </div>

      {savingChoice && (
        <p style={{ fontSize: 12, color: '#888', marginTop: 10 }}>
          Saving your starting point...
        </p>
      )}
    </div>
  );
}

