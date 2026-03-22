'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/auth/supabase-client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatUsd, PRICING } from '@/lib/config/pricing';
import type { SignalProfile } from '@/lib/onboarding/signal-profile';
import VoiceNarrationPanel from '@/components/voice/VoiceNarrationPanel';

const TIER_CONFIG = {
  FREE: {
    label: 'Free account',
    color: '#6b7280',
    bg: '#f9fafb',
    border: '#e5e7eb',
    description: '2 free Quick Scans to get started',
    features: ['2 lifetime Quick Scans', 'No credit card required', 'Basic coverage preview'],
  },
  STANDARD: {
    label: 'Free account',
    color: '#6b7280',
    bg: '#f9fafb',
    border: '#e5e7eb',
    description: '2 free Quick Scans to get started',
    features: ['2 lifetime Quick Scans', 'No credit card required', 'Basic coverage preview'],
  },
  PREMIUM: {
    label: 'Free account',
    color: '#6b7280',
    bg: '#f9fafb',
    border: '#e5e7eb',
    description: '2 free Quick Scans to get started',
    features: ['2 lifetime Quick Scans', 'No credit card required', 'Basic coverage preview'],
  },
  CORPORATE: {
    label: 'Corporate',
    color: '#2E5FA3',
    bg: '#eff4fc',
    border: '#bfdbfe',
    description: 'Organization-level access',
    features: ['Unlimited everything', 'API access', 'Multi-user workspaces', 'Custom integrations', 'Dedicated support'],
  },
  FOUNDER: {
    label: 'Founder',
    color: '#7c3aed',
    bg: '#f5f3ff',
    border: '#ddd6fe',
    description: 'Founder operational controls',
    features: ['FOCL access', 'Rollout controls', 'Feature intelligence', 'Governance operations'],
  },
};

const COUNTRY_LIST = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' },
  { code: 'FI', name: 'Finland' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' },
  { code: 'CN', name: 'China' },
  { code: 'IN', name: 'India' },
  { code: 'SG', name: 'Singapore' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'AR', name: 'Argentina' },
  { code: 'CL', name: 'Chile' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'IL', name: 'Israel' },
  { code: 'TR', name: 'Turkey' },
  { code: 'RU', name: 'Russia' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'AT', name: 'Austria' },
  { code: 'BE', name: 'Belgium' },
  { code: 'IE', name: 'Ireland' },
  { code: 'GR', name: 'Greece' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'HU', name: 'Hungary' },
  { code: 'RO', name: 'Romania' },
  { code: 'TH', name: 'Thailand' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'PH', name: 'Philippines' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'EG', name: 'Egypt' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'KE', name: 'Kenya' },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: 11, fontWeight: 600, color: '#999',
      textTransform: 'uppercase', letterSpacing: '0.07em',
      margin: '0 0 10px', paddingLeft: 2,
    }}>
      {children}
    </p>
  );
}

function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'white',
      border: '1px solid #f0f0f0',
      borderRadius: 16,
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      overflow: 'hidden',
      ...style,
    }}>
      {children}
    </div>
  );
}

function Row({
  label, value, subtle, last = false, action
}: {
  label: string;
  value?: React.ReactNode;
  subtle?: boolean;
  last?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '13px 18px',
      borderBottom: last ? 'none' : '1px solid #f5f5f5',
    }}>
      <span style={{ fontSize: 14, color: subtle ? '#aaa' : '#444', fontWeight: 400 }}>{label}</span>
      {action || (
        <span style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>{value}</span>
      )}
    </div>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const cfg = TIER_CONFIG[tier as keyof typeof TIER_CONFIG] || TIER_CONFIG.FREE;
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, color: cfg.color,
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      borderRadius: 20, padding: '3px 10px', letterSpacing: '0.03em',
    }}>
      {cfg.label}
    </span>
  );
}

function CountrySelect({
  value, onChange, placeholder = 'Select country'
}: {
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
}) {
  const displayName = value ? (COUNTRY_LIST.find((c) => c.code === value)?.name ?? value) : placeholder;
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: value ? '#111' : '#aaa', pointerEvents: 'none' }}>
        {displayName}
      </span>
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ pointerEvents: 'none', flexShrink: 0 }}>
        <path d="M2 3.5L5 6.5L8 3.5" stroke="#aaa" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          position: 'absolute', inset: 0, opacity: 0,
          cursor: 'pointer', width: '100%', height: '100%',
        }}
      >
        <option value="">{placeholder}</option>
        {COUNTRY_LIST.map((c) => (
          <option key={c.code} value={c.code}>{c.name}</option>
        ))}
      </select>
    </div>
  );
}

const TIER_TRIP_LIMITS: Record<string, number | null> = {
  FREE: 3,
  CORPORATE: null,
  FOUNDER: null,
};

export default function AccountPage() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const router = useRouter();
  const [signOutLoading, setSignOutLoading] = useState(false);
  const [tripCount, setTripCount] = useState<number | null>(null);

  const [residenceCountry, setResidenceCountry] = useState<string>(profile?.residence_country_code || '');
  const [nationality, setNationality] = useState<string>((profile as any)?.primary_nationality || '');
  const [emailNotifications, setEmailNotifications] = useState<boolean>((profile as any)?.email_notifications ?? true);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsSaved, setPrefsSaved] = useState(false);

  const [passwordSending, setPasswordSending] = useState(false);
  const [passwordSent, setPasswordSent] = useState(false);

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const signalProfile = (profile?.preferences as Record<string, unknown> | undefined)?.signal_profile as SignalProfile | undefined;
  const [travelEditing, setTravelEditing] = useState(false);
  const [travelSaving, setTravelSaving] = useState(false);
  const [travelVoiceOpen, setTravelVoiceOpen] = useState(false);
  const [travelDraft, setTravelDraft] = useState<SignalProfile | null>(null);

  useEffect(() => {
    if (signalProfile && !travelEditing) {
      setTravelDraft(signalProfile);
    }
  }, [signalProfile, travelEditing]);

  const hasTravelSignal =
    signalProfile &&
    (signalProfile.places?.length ||
      signalProfile.activities?.length ||
      signalProfile.food_interests?.length ||
      (signalProfile.travel_style && signalProfile.travel_style.trim()));

  const persistSignalProfile = async (next: SignalProfile) => {
    if (!user || !profile) return;
    setTravelSaving(true);
    const prefs = { ...(profile.preferences && typeof profile.preferences === 'object' ? profile.preferences : {}), signal_profile: next };
    await supabase.from('user_profiles').update({ preferences: prefs }).eq('user_id', user.id);
    await refreshProfile();
    setTravelDraft(next);
    setTravelSaving(false);
    setTravelEditing(false);
  };

  useEffect(() => {
    if (!user) return;
    supabase
      .from('trips')
      .select('trip_id', { count: 'exact', head: true })
      .eq('account_id', user.id)
      .is('archived_at', null)
      .then(({ count }) => {
        setTripCount(count ?? 0);
      });
  }, [user]);

  const normalizeTier = (value: string | null | undefined): 'FREE' | 'CORPORATE' | 'FOUNDER' => {
    if (value === 'FOUNDER') return 'FOUNDER';
    if (value === 'CORPORATE') return 'CORPORATE';
    return 'FREE';
  };

  const tier = normalizeTier(profile?.membership_tier);
  const tierCfg = TIER_CONFIG[tier];
  const tripLimit = TIER_TRIP_LIMITS[tier];

  const handleSignOut = async () => {
    setSignOutLoading(true);
    await signOut();
    router.push('/signin');
  };

  const handleSavePrefs = async () => {
    if (!user) return;
    setSavingPrefs(true);
    await supabase
      .from('profiles')
      .update({
        residence_country_code: residenceCountry || null,
        primary_nationality: nationality || null,
        email_notifications: emailNotifications,
      })
      .eq('id', user.id);
    setSavingPrefs(false);
    setPrefsSaved(true);
    setTimeout(() => setPrefsSaved(false), 2500);
  };

  const handleChangePassword = async () => {
    if (!user?.email) return;
    setPasswordSending(true);
    await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setPasswordSending(false);
    setPasswordSent(true);
    setTimeout(() => setPasswordSent(false), 6000);
  };

  const initials = profile?.display_name
    ? profile.display_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : (user?.email?.[0] || '?').toUpperCase();

  const isCorporate = tier === 'CORPORATE';
  const isPremiumOrAbove = tier === 'CORPORATE' || tier === 'FOUNDER';
  const isStandardOrAbove = tier === 'CORPORATE' || tier === 'FOUNDER';

  const prefsChanged =
    residenceCountry !== (profile?.residence_country_code || '') ||
    nationality !== ((profile as any)?.primary_nationality || '') ||
    emailNotifications !== ((profile as any)?.email_notifications ?? true);

  return (
    <div style={{
      fontFamily: 'system-ui, -apple-system, sans-serif',
      paddingBottom: 40,
    }}>

      <div style={{
        background: 'linear-gradient(155deg, #1e3a5f 0%, #0f2440 100%)',
        borderRadius: 20,
        padding: '22px 20px 20px',
        marginBottom: 24,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', right: -20, top: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ position: 'absolute', right: 30, bottom: -10, width: 70, height: 70, borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, fontWeight: 700, color: 'white',
            border: '2px solid rgba(255,255,255,0.2)',
            flexShrink: 0,
          }}>
            {initials}
          </div>
          <div>
            <p style={{ fontSize: 18, fontWeight: 700, color: 'white', margin: '0 0 3px', letterSpacing: '-0.2px' }}>
              {profile?.display_name || user?.email?.split('@')[0] || 'Traveler'}
            </p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', margin: '0 0 8px' }}>
              {user?.email}
            </p>
            <TierBadge tier={tier} />
          </div>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          gap: 8, marginTop: 16, position: 'relative',
        }}>
          {[
            { label: 'Trips unlocked', value: tripCount === null ? '—' : String(tripCount ?? 0) },
            { label: 'Deep scans', value: isCorporate ? '∞' : (profile as any)?.deep_scan_credits_remaining ?? '—' },
            {
              label: 'Deep Scans',
              value: isCorporate ? '∞' : (profile as any)?.deep_scan_credits_remaining != null ? String((profile as any).deep_scan_credits_remaining) : '—',
            },
          ].map((stat) => (
            <div key={stat.label} style={{
              background: 'rgba(255,255,255,0.08)',
              borderRadius: 10, padding: '8px 10px',
              textAlign: 'center',
            }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: 'white', margin: '0 0 2px' }}>{stat.value}</p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', margin: 0, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <SectionLabel>Membership</SectionLabel>
        <Card>
          <div style={{
            padding: '14px 18px',
            borderBottom: '1px solid #f5f5f5',
          }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#111', margin: '0 0 4px' }}>
              Wayfarer — no subscription
            </p>
            <p style={{ fontSize: 13, color: '#555', margin: '0 0 10px', lineHeight: 1.55 }}>
              Your account is free. Each trip you want to fully protect costs {formatUsd(PRICING.tripUnlockUsd)} — unlock it once, keep the protection for that trip.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                '2 free Quick Scans on your account',
                `Unlock any trip for ${formatUsd(PRICING.tripUnlockUsd)} — includes ${PRICING.deepScanCreditsIncludedOnUnlock} Deep Scan credits`,
                `Additional Deep Scans: ${formatUsd(PRICING.deepScanSingleUsd)} per scan`,
                'No monthly fees. No subscription.',
              ].map((f) => (
                <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                    <circle cx="7" cy="7" r="6.5" fill="#f0fdf4" stroke="#bbf7d0"/>
                    <path d="M4.5 7l2 2 3-3" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span style={{ fontSize: 13, color: '#444', lineHeight: 1.5 }}>{f}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding: '14px 18px' }}>
            <Link href="/trips" style={{
              display: 'block', textAlign: 'center', padding: '11px 0',
              background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)',
              border: 'none', borderRadius: 12,
              fontSize: 13, fontWeight: 600, color: 'white',
              textDecoration: 'none',
            }}>
              Unlock a trip — {formatUsd(PRICING.tripUnlockUsd)}
            </Link>
          </div>
        </Card>
      </div>

      <div style={{ marginBottom: 24 }}>
        <SectionLabel>Scan credits</SectionLabel>
        <Card>
          <Row label="Basic scans" value={isCorporate ? 'Unlimited' : `${(profile as any)?.scan_credits_remaining ?? 0} remaining`} />
          <Row label="Deep scans" value={isCorporate ? 'Unlimited' : `${(profile as any)?.deep_scan_credits_remaining ?? 0} remaining`} />
          <Row
            label="Resets"
            value="1st of each month"
            last={!isStandardOrAbove}
          />
          {isStandardOrAbove && (
            <Row label="Data export" action={
              <button
                onClick={() => { window.location.href = '/api/account/export'; }}
                style={{
                  fontSize: 11, fontWeight: 600, color: '#2E5FA3',
                  background: '#eff4fc', border: '1px solid #bfdbfe',
                  borderRadius: 20, padding: '2px 12px',
                  cursor: 'pointer',
                }}
              >
                Download
              </button>
            } last />
          )}
        </Card>
      </div>

      <div style={{ marginBottom: 24 }}>
        <SectionLabel>Features</SectionLabel>
        <Card>
          {[
            { label: 'Policy scanning', enabled: true },
            { label: 'Coverage graph', enabled: true },
            { label: 'Claim routing', enabled: true },
            { label: 'Incident tracking', enabled: true },
            { label: 'Narration & notes', enabled: true },
            { label: 'Deep scan analysis', enabled: isStandardOrAbove },
            { label: 'Data export', enabled: isStandardOrAbove },
            { label: 'Claim assistance', enabled: isPremiumOrAbove },
            { label: 'Group trips', enabled: isPremiumOrAbove },
            { label: 'API access', enabled: isCorporate },
            { label: 'Multi-user workspace', enabled: isCorporate, last: true },
          ].map((item, i, arr) => (
            <Row
              key={item.label}
              label={item.label}
              last={i === arr.length - 1}
              action={
                item.enabled ? (
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: '#16a34a',
                    background: '#f0fdf4', border: '1px solid #bbf7d0',
                    borderRadius: 20, padding: '2px 9px',
                  }}>On</span>
                ) : (
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: '#9ca3af',
                    background: '#f9fafb', border: '1px solid #e5e7eb',
                    borderRadius: 20, padding: '2px 9px',
                  }}>Upgrade</span>
                )
              }
            />
          ))}
        </Card>
      </div>

      <div style={{ marginBottom: 24 }}>
        <SectionLabel>Group &amp; family</SectionLabel>
        <Card>
          <div
            style={{ cursor: 'pointer' }}
            onClick={() => router.push('/account/group-invites')}
          >
            <Row
              label="Group trip invites"
              action={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>Inbox</span>
                  <svg width="5" height="9" viewBox="0 0 5 9" fill="none">
                    <path d="M1 1l3 3.5L1 8" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              }
            />
          </div>
          <div
            style={{ cursor: 'pointer' }}
            onClick={() => router.push('/account/guardian-invites')}
          >
            <Row
              label="Guardian approvals"
              last
              action={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>Inbox</span>
                  <svg width="5" height="9" viewBox="0 0 5 9" fill="none">
                    <path d="M1 1l3 3.5L1 8" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              }
            />
          </div>
        </Card>
      </div>

      <div style={{ marginBottom: 24 }}>
        <SectionLabel>Account access</SectionLabel>
        <Card>
          <Row label="Email" value={user?.email || '—'} />
          <div
            style={{ cursor: 'pointer' }}
            onClick={() => router.push('/account/security')}
          >
            <Row
              label="Two-factor authentication"
              action={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    color: profile?.mfa_enabled ? '#16a34a' : '#9ca3af',
                    background: profile?.mfa_enabled ? '#f0fdf4' : '#f9fafb',
                    border: `1px solid ${profile?.mfa_enabled ? '#bbf7d0' : '#e5e7eb'}`,
                    borderRadius: 20, padding: '2px 9px',
                  }}>
                    {profile?.mfa_enabled ? 'On' : 'Off'}
                  </span>
                  <svg width="5" height="9" viewBox="0 0 5 9" fill="none">
                    <path d="M1 1l3 3.5L1 8" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              }
            />
          </div>
          <Row
            label="Password"
            action={
              passwordSent ? (
                <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 500 }}>
                  Reset link sent
                </span>
              ) : (
                <button
                  onClick={handleChangePassword}
                  disabled={passwordSending}
                  style={{
                    background: 'none', border: 'none', cursor: passwordSending ? 'not-allowed' : 'pointer',
                    fontSize: 13, color: passwordSending ? '#aaa' : '#2563eb', fontWeight: 500,
                    padding: 0,
                  }}
                >
                  {passwordSending ? 'Sending...' : 'Change'}
                </button>
              )
            }
            last
          />
        </Card>
      </div>

      <div style={{ marginBottom: 24 }}>
        <SectionLabel>Preferences</SectionLabel>
        <Card>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '13px 18px',
            borderBottom: '1px solid #f5f5f5',
          }}>
            <span style={{ fontSize: 14, color: '#444', fontWeight: 400 }}>Home country</span>
            <CountrySelect
              value={residenceCountry}
              onChange={setResidenceCountry}
              placeholder="Select country"
            />
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '13px 18px',
            borderBottom: '1px solid #f5f5f5',
          }}>
            <span style={{ fontSize: 14, color: '#444', fontWeight: 400 }}>Primary nationality</span>
            <CountrySelect
              value={nationality}
              onChange={setNationality}
              placeholder="Select nationality"
            />
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '13px 18px',
            borderBottom: prefsChanged ? '1px solid #f5f5f5' : 'none',
          }}>
            <div>
              <span style={{ fontSize: 14, color: '#444', fontWeight: 400 }}>Email notifications</span>
              <p style={{ fontSize: 11, color: '#bbb', margin: '2px 0 0' }}>Trip alerts and claim updates</p>
            </div>
            <button
              onClick={() => setEmailNotifications((v) => !v)}
              style={{
                width: 44, height: 26, borderRadius: 13,
                background: emailNotifications ? '#1A2B4A' : '#e5e7eb',
                border: 'none', cursor: 'pointer',
                position: 'relative', transition: 'background 0.2s ease',
                flexShrink: 0,
              }}
            >
              <span style={{
                position: 'absolute', top: 3,
                left: emailNotifications ? 21 : 3,
                width: 20, height: 20, borderRadius: '50%',
                background: 'white',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                transition: 'left 0.2s ease',
                display: 'block',
              }} />
            </button>
          </div>
          {prefsChanged && (
            <div style={{ padding: '10px 18px 14px' }}>
              <button
                onClick={handleSavePrefs}
                disabled={savingPrefs}
                style={{
                  width: '100%', padding: '10px 0',
                  background: prefsSaved ? '#f0fdf4' : '#1A2B4A',
                  border: prefsSaved ? '1px solid #bbf7d0' : 'none',
                  borderRadius: 10,
                  fontSize: 13, fontWeight: 600,
                  color: prefsSaved ? '#16a34a' : 'white',
                  cursor: savingPrefs ? 'not-allowed' : 'pointer',
                  opacity: savingPrefs ? 0.7 : 1,
                  transition: 'all 0.2s ease',
                }}
              >
                {savingPrefs ? 'Saving...' : prefsSaved ? 'Saved' : 'Save preferences'}
              </button>
            </div>
          )}
        </Card>
      </div>

      <div style={{ marginBottom: 24 }}>
        <SectionLabel>Security</SectionLabel>
        <Card>
          <div style={{ cursor: 'pointer' }} onClick={() => router.push('/account/security')}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '13px 18px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M12 2L4 5v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V5l-8-3z"
                    stroke="#1A2B4A"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </svg>
                <div>
                  <span style={{ fontSize: 14, color: '#444', fontWeight: 600 }}>Security</span>
                  <p style={{ margin: '3px 0 0', fontSize: 12, color: '#9ca3af' }}>
                    Two-factor authentication: {profile?.mfa_enabled ? 'On' : 'Off'}
                  </p>
                </div>
              </div>
              <svg width="5" height="9" viewBox="0 0 5 9" fill="none">
                <path d="M1 1l3 3.5L1 8" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </Card>
      </div>

      <div style={{ marginBottom: 24 }}>
        <SectionLabel>Travel Profile</SectionLabel>
        <Card>
          {!hasTravelSignal && !travelEditing ? (
            <div style={{ padding: '18px 18px 20px' }}>
              <p style={{ fontSize: 14, color: '#555', margin: '0 0 12px', lineHeight: 1.55 }}>
                Tell us about your travel interests so we can tailor suggestions.
              </p>
              <button
                type="button"
                onClick={() => setTravelVoiceOpen(true)}
                style={{
                  padding: '10px 16px',
                  background: '#1A2B4A',
                  color: 'white',
                  border: 'none',
                  borderRadius: 10,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  marginRight: 10,
                }}
              >
                Capture with voice
              </button>
              <button
                type="button"
                onClick={() => {
                  setTravelDraft({
                    places: [],
                    activities: [],
                    food_interests: [],
                    travel_style: '',
                    detail_preference: 'balanced',
                    interests_other: [],
                    capture_rounds: 0,
                    last_updated: new Date().toISOString(),
                  });
                  setTravelEditing(true);
                }}
                style={{ padding: '10px 16px', background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 13, fontWeight: 600 }}
              >
                Enter manually
              </button>
            </div>
          ) : !travelEditing ? (
            <div style={{ padding: '14px 18px 18px' }}>
              {(() => {
                const d = travelDraft || signalProfile;
                return (
                  <>
              <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 8px' }}>Places I&apos;m interested in</p>
              <p style={{ fontSize: 13, color: '#111', margin: '0 0 12px' }}>{(d?.places || []).join(' · ') || '—'}</p>
              <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 8px' }}>Activities</p>
              <p style={{ fontSize: 13, color: '#111', margin: '0 0 12px' }}>{(d?.activities || []).join(' · ') || '—'}</p>
              <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 8px' }}>Food &amp; dining</p>
              <p style={{ fontSize: 13, color: '#111', margin: '0 0 12px' }}>{(d?.food_interests || []).join(' · ') || '—'}</p>
              <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 8px' }}>Travel style</p>
              <p style={{ fontSize: 13, color: '#111', margin: '0 0 12px' }}>{d?.travel_style || '—'}</p>
              <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 8px' }}>Detail preference</p>
              <p style={{ fontSize: 13, color: '#111', margin: '0 0 14px' }}>{d?.detail_preference || 'balanced'}</p>
                  </>
                );
              })()}
              <button
                type="button"
                onClick={() => setTravelEditing(true)}
                style={{ padding: '8px 14px', background: '#eff4fc', border: '1px solid #bfdbfe', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#1d4ed8' }}
              >
                Edit
              </button>
            </div>
          ) : (
            <div style={{ padding: '14px 18px 18px' }}>
              {[
                { key: 'places' as const, label: 'Places (one per line)' },
                { key: 'activities' as const, label: 'Activities (one per line)' },
                { key: 'food_interests' as const, label: 'Food & dining (one per line)' },
              ].map((row) => (
                <label key={row.key} style={{ display: 'block', marginBottom: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>{row.label}</span>
                  <textarea
                    rows={3}
                    value={(travelDraft?.[row.key] as string[] | undefined)?.join('\n') || ''}
                    onChange={(e) =>
                      setTravelDraft((d) =>
                        d
                          ? {
                              ...d,
                              [row.key]: e.target.value
                                .split('\n')
                                .map((s) => s.trim())
                                .filter(Boolean),
                            }
                          : d,
                      )
                    }
                    style={{ width: '100%', boxSizing: 'border-box', marginTop: 6, borderRadius: 8, border: '1px solid #e2e8f0', padding: 8, fontSize: 13 }}
                  />
                </label>
              ))}
              <label style={{ display: 'block', marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Travel style</span>
                <select
                  value={travelDraft?.travel_style || ''}
                  onChange={(e) => setTravelDraft((d) => (d ? { ...d, travel_style: e.target.value } : d))}
                  style={{ display: 'block', width: '100%', marginTop: 6, padding: 8, borderRadius: 8, border: '1px solid #e2e8f0' }}
                >
                  <option value="">—</option>
                  <option value="solo">Solo</option>
                  <option value="group">Group</option>
                  <option value="mixed">Mixed</option>
                  <option value="luxury">Luxury</option>
                  <option value="backpacker">Backpacker</option>
                  <option value="adventure">Adventure</option>
                </select>
              </label>
              <label style={{ display: 'block', marginBottom: 14 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Detail preference</span>
                <select
                  value={travelDraft?.detail_preference || 'balanced'}
                  onChange={(e) =>
                    setTravelDraft((d) =>
                      d ? { ...d, detail_preference: e.target.value as SignalProfile['detail_preference'] } : d,
                    )
                  }
                  style={{ display: 'block', width: '100%', marginTop: 6, padding: 8, borderRadius: 8, border: '1px solid #e2e8f0' }}
                >
                  <option value="simple">Simple</option>
                  <option value="balanced">Balanced</option>
                  <option value="detailed">Detailed</option>
                </select>
              </label>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  disabled={travelSaving || !travelDraft}
                  onClick={() => travelDraft && void persistSignalProfile({ ...travelDraft, last_updated: new Date().toISOString() })}
                  style={{
                    padding: '10px 16px',
                    background: '#1A2B4A',
                    color: 'white',
                    border: 'none',
                    borderRadius: 10,
                    fontWeight: 700,
                    cursor: travelSaving ? 'not-allowed' : 'pointer',
                  }}
                >
                  {travelSaving ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTravelEditing(false);
                    setTravelDraft(signalProfile || null);
                  }}
                  style={{ padding: '10px 16px', background: 'white', border: '1px solid #e2e8f0', borderRadius: 10 }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {travelVoiceOpen && user && (
        <>
          <div
            role="presentation"
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 85 }}
            onClick={() => setTravelVoiceOpen(false)}
          />
          <VoiceNarrationPanel
            context="signal_capture"
            accountId={user.id}
            onCancel={() => setTravelVoiceOpen(false)}
            onFieldsConfirmed={(fields, _meta) => {
              const places = Array.isArray(fields.places) ? (fields.places as string[]) : [];
              const activities = Array.isArray(fields.activities) ? (fields.activities as string[]) : [];
              const food = Array.isArray(fields.food_interests) ? (fields.food_interests as string[]) : [];
              const other = Array.isArray(fields.interests_other) ? (fields.interests_other as string[]) : [];
              const travel_style = typeof fields.travel_style === 'string' ? fields.travel_style : '';
              const detail_preference =
                fields.detail_preference === 'simple' || fields.detail_preference === 'detailed' || fields.detail_preference === 'balanced'
                  ? fields.detail_preference
                  : 'balanced';
              const next: SignalProfile = {
                places,
                activities,
                food_interests: food,
                travel_style,
                detail_preference,
                interests_other: other,
                capture_rounds: (signalProfile?.capture_rounds || 0) + 1,
                last_updated: new Date().toISOString(),
              };
              void persistSignalProfile(next);
              setTravelVoiceOpen(false);
            }}
          />
        </>
      )}

      <div style={{ marginBottom: 24 }}>
        <SectionLabel>About</SectionLabel>
        <Card>
          <Row label="Version" value="1.0.0-beta" />
          <Row label="Account created" value={
            user?.created_at
              ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
              : '—'
          } />
          <div
            style={{ cursor: 'pointer' }}
            onClick={() => window.open('/status', '_blank', 'noopener,noreferrer')}
          >
            <Row label="Platform status" action={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
                  <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 500 }}>All systems operational</span>
                </div>
                <svg width="5" height="9" viewBox="0 0 5 9" fill="none">
                  <path d="M1 1l3 3.5L1 8" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            } />
          </div>
          <div
            style={{ cursor: 'pointer' }}
            onClick={() => window.open('/privacy', '_blank', 'noopener,noreferrer')}
          >
            <Row label="Privacy policy" action={
              <svg width="5" height="9" viewBox="0 0 5 9" fill="none">
                <path d="M1 1l3 3.5L1 8" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            } />
          </div>
          <div
            style={{ cursor: 'pointer' }}
            onClick={() => window.open('/terms', '_blank', 'noopener,noreferrer')}
          >
            <Row label="Terms of service" action={
              <svg width="5" height="9" viewBox="0 0 5 9" fill="none">
                <path d="M1 1l3 3.5L1 8" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            } />
          </div>
          <div
            style={{ cursor: 'pointer' }}
            onClick={() => router.push('/account/trust-safety')}
          >
            <Row label="Trust & Safety" action={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontSize: 11, fontWeight: 600, color: '#16a34a',
                  background: '#f0fdf4', border: '1px solid #bbf7d0',
                  borderRadius: 20, padding: '2px 9px',
                }}>SOC 2 in progress</span>
                <svg width="5" height="9" viewBox="0 0 5 9" fill="none">
                  <path d="M1 1l3 3.5L1 8" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            } last />
          </div>
        </Card>
      </div>

      <button
        onClick={handleSignOut}
        disabled={signOutLoading}
        style={{
          width: '100%', padding: '14px 0',
          background: 'none',
          border: '1.5px solid #fee2e2',
          borderRadius: 14,
          fontSize: 14, fontWeight: 600, color: '#dc2626',
          cursor: signOutLoading ? 'not-allowed' : 'pointer',
          opacity: signOutLoading ? 0.7 : 1,
          transition: 'opacity 0.15s ease',
        }}
      >
        {signOutLoading ? 'Signing out...' : 'Sign out'}
      </button>

      {showUpgradeModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          <div
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }}
            onClick={() => setShowUpgradeModal(false)}
          />
          <div style={{
            position: 'relative', background: 'white',
            borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480,
            padding: '28px 24px 40px', zIndex: 1,
            animation: 'slideUp 0.25s cubic-bezier(0.32, 0.72, 0, 1)',
          }}>
            <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <p style={{ fontSize: 18, fontWeight: 700, color: '#1A2B4A', margin: '0 0 2px' }}>Upgrade your plan</p>
                <p style={{ fontSize: 13, color: '#888', margin: 0 }}>Unlock more trips, deep scans, and claim tools</p>
              </div>
              <button onClick={() => setShowUpgradeModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#aaa' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {(['CORPORATE'] as const).map((t) => {
                const cfg = TIER_CONFIG[t];
                const isCurrent = tier === t;
                return (
                  <div key={t} style={{
                    border: `1.5px solid ${isCurrent ? cfg.border : '#f0f0f0'}`,
                    borderRadius: 12, padding: '14px 16px',
                    background: isCurrent ? cfg.bg : 'white',
                    opacity: isCurrent ? 0.7 : 1,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
                      {isCurrent && (
                        <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 20, padding: '2px 9px' }}>
                          Current
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 12, color: '#888', margin: '0 0 8px' }}>{cfg.description}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {cfg.features.slice(0, 3).map((f) => (
                        <span key={f} style={{ fontSize: 11, color: '#555', background: '#f5f5f5', borderRadius: 20, padding: '2px 8px' }}>{f}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => { setShowUpgradeModal(false); router.push('/pricing'); }}
              style={{
                width: '100%', padding: '12px 0',
                background: '#1A2B4A', color: 'white',
                border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              See all plans and pricing
            </button>
            <button
              onClick={() => setShowUpgradeModal(false)}
              style={{
                width: '100%', padding: '11px 0', marginTop: 8,
                background: 'none', color: '#888',
                border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14, fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
