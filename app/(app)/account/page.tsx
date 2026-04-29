'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/auth/supabase-client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatUsd, PRICING } from '@/lib/config/pricing';
import type { SignalProfile } from '@/lib/onboarding/signal-profile';
import VoiceNarrationPanel from '@/components/voice/VoiceNarrationPanel';
import CreatorDiscoveryModal from '@/components/creators/CreatorDiscoveryModal';
import { useIsMobile, useIsNarrowAppShell } from '@/lib/hooks/useIsMobile';
import { useAppPageSurface } from '@/lib/hooks/useAppPageSurface';
import { touch } from '@/lib/styles/tokens';

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
  const narrowShell = useIsNarrowAppShell();
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 12,
      padding: narrowShell ? '14px 16px' : '13px 18px',
      minHeight: narrowShell ? 48 : undefined,
      borderBottom: last ? 'none' : '1px solid #f5f5f5',
    }}>
      <span style={{ fontSize: 14, color: subtle ? '#aaa' : '#444', fontWeight: 400 }}>{label}</span>
      {action || (
        <span style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>{value}</span>
      )}
    </div>
  );
}

function SettingsRowChevron({ ariaHidden }: { ariaHidden?: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: touch.minTap,
        minHeight: touch.minTap,
        marginRight: -10,
      }}
      aria-hidden={ariaHidden ? true : undefined}
    >
      <svg width="5" height="9" viewBox="0 0 5 9" fill="none" aria-hidden>
        <path d="M1 1l3 3.5L1 8" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
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
  const isMobile = useIsMobile();
  const narrowShell = useIsNarrowAppShell();
  const accountSurface = useAppPageSurface({
    fontFamily: 'system-ui, -apple-system, sans-serif',
    maxWidth: '100%',
  });
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

  // Discovery preferences (MVP): open creator discovery search modal.
  const [creatorDiscoveryOpen, setCreatorDiscoveryOpen] = useState(false);

  // Front-end feedback form (backend endpoint may be deployed separately).
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState<'bug' | 'feature' | 'question' | 'other'>('feature');
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackScreenshotDataUrl, setFeedbackScreenshotDataUrl] = useState<string | null>(null);
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  // GDPR delete account (GDPR erasure) modal.
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteSending, setDeleteSending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const signalProfile = (profile?.preferences as Record<string, unknown> | undefined)?.signal_profile as SignalProfile | undefined;
  const [passportCountry, setPassportCountry] = useState<string>(
    ((profile?.preferences as Record<string, unknown> | undefined)?.passport_country as string | undefined) || '',
  );
  const [tempUnitPref, setTempUnitPref] = useState<'F' | 'C'>('F');
  const [medicalInfoDraft, setMedicalInfoDraft] = useState('');
  const [savingMedical, setSavingMedical] = useState(false);
  const [travelEditing, setTravelEditing] = useState(false);
  const [travelSaving, setTravelSaving] = useState(false);
  const [travelVoiceOpen, setTravelVoiceOpen] = useState(false);
  const [travelDraft, setTravelDraft] = useState<SignalProfile | null>(null);

  useEffect(() => {
    if (signalProfile && !travelEditing) {
      setTravelDraft(signalProfile);
    }
  }, [signalProfile, travelEditing]);

  useEffect(() => {
    const next = ((profile?.preferences as Record<string, unknown> | undefined)?.passport_country as string | undefined) || '';
    setPassportCountry(next);
  }, [profile?.preferences]);

  useEffect(() => {
    const p = profile?.preferences as Record<string, unknown> | undefined;
    setTempUnitPref(p?.temperature_unit === 'C' ? 'C' : 'F');
    setMedicalInfoDraft(typeof p?.medical_info === 'string' ? p.medical_info : '');
  }, [profile?.preferences]);

  const savePassportPrefs = async () => {
    if (!user || !profile) return;
    const prefs =
      profile.preferences && typeof profile.preferences === 'object'
        ? (profile.preferences as Record<string, unknown>)
        : {};
    const next = { ...prefs, passport_country: passportCountry || null };
    await supabase.from('user_profiles').update({ preferences: next }).eq('user_id', user.id);
    await refreshProfile();
  };

  const savePreferencePatch = async (patch: Record<string, unknown>) => {
    if (!user || !profile) return;
    const prefs =
      profile.preferences && typeof profile.preferences === 'object'
        ? { ...(profile.preferences as Record<string, unknown>) }
        : {};
    await supabase.from('user_profiles').update({ preferences: { ...prefs, ...patch } }).eq('user_id', user.id);
    await refreshProfile();
  };

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

  const handleDeleteAccount = async () => {
    if (!deletePassword.trim()) {
      setDeleteError('Password is required.');
      return;
    }
    if (deleteConfirmText !== 'DELETE') {
      setDeleteError('Type DELETE exactly to confirm.');
      return;
    }

    setDeleteSending(true);
    setDeleteError(null);
    try {
      // Backend expects the confirmation phrase below (kept server-side UX-safe).
      const res = await fetch('/api/account/erasure', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          password: deletePassword,
          confirmPhrase: 'ERASE MY PERSONAL DATA',
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        setDeleteError(json?.error || json?.message || 'Delete request failed.');
        return;
      }

      setShowDeleteModal(false);
      // Session will typically be invalid soon; force sign-out immediately.
      await handleSignOut();
    } catch (e: any) {
      setDeleteError(e?.message || 'Delete request failed.');
    } finally {
      setDeleteSending(false);
    }
  };

  const handleSubmitFeedback = async () => {
    setFeedbackError(null);
    setFeedbackSuccess(null);

    const trimmed = feedbackText.trim();
    if (!trimmed) {
      setFeedbackError('Please write a short description.');
      return;
    }

    setFeedbackSending(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          category: feedbackCategory,
          message: trimmed,
          screenshot_data_url: feedbackScreenshotDataUrl,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) {
        if (res.status === 404) {
          setFeedbackError('Feedback service is not configured yet. Email support@wayfarer.app.');
          return;
        }
        setFeedbackError(json?.error || json?.message || 'Feedback submission failed.');
        return;
      }

      setFeedbackSuccess('Thanks. Your feedback has been received.');
      setTimeout(() => setShowFeedbackModal(false), 900);
      setFeedbackText('');
      setFeedbackScreenshotDataUrl(null);
    } catch (e: any) {
      // Helpful fallback when backend endpoint isn't deployed yet.
      setFeedbackError(e?.message || "Feedback temporarily unavailable. Email support@wayfarer.app.");
    } finally {
      setFeedbackSending(false);
    }
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

  const prefRowPad = narrowShell ? '14px 16px' : '13px 18px';
  const prefRowMinH = narrowShell ? 48 : undefined;

  return (
    <div style={accountSurface}>

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
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr',
          gap: 8, marginTop: 16, position: 'relative',
        }}>
          {[
            { label: 'Trips', value: tripCount === null ? '—' : String(tripCount ?? 0) },
            { label: 'Deep scans', value: isCorporate ? '∞' : (profile as any)?.deep_scan_credits_remaining != null ? String((profile as any).deep_scan_credits_remaining) : '—' },
            ...(!isMobile
              ? [{ label: 'Quick scans', value: isCorporate ? '∞' : String((profile as any)?.scan_credits_remaining ?? '—') }]
              : []),
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
                  <SettingsRowChevron />
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
                  <SettingsRowChevron />
                </div>
              }
            />
          </div>
        </Card>
      </div>

      <div style={{ marginBottom: 24 }}>
        <SectionLabel>Emergency &amp; safety</SectionLabel>
        <Card>
          <div style={{ cursor: 'pointer' }} onClick={() => router.push('/safety')}>
            <Row
              label="Emergency Contacts"
              action={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>Manage</span>
                  <SettingsRowChevron />
                </div>
              }
            />
          </div>
          <div style={{ cursor: 'pointer' }} onClick={() => router.push('/safety')}>
            <Row
              label="Safety Card"
              action={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>Open</span>
                  <SettingsRowChevron />
                </div>
              }
            />
          </div>
          <div style={{ cursor: 'pointer' }} onClick={() => router.push('/account/safety-vault')}>
            <Row
              label="Document Vault"
              last
              action={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>Manage</span>
                  <SettingsRowChevron />
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
                  <SettingsRowChevron />
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
        <Card style={{ marginBottom: 12 }}>
          <Link href="/account/travelshield" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: prefRowPad,
                minHeight: prefRowMinH,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M12 3l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V7l8-4z"
                    stroke="#1e3a8a"
                    strokeWidth="1.7"
                    strokeLinejoin="round"
                  />
                </svg>
                <div>
                  <span style={{ fontSize: 14, color: '#444', fontWeight: 600 }}>TravelShield</span>
                  <p style={{ margin: '3px 0 0', fontSize: 12, color: '#9ca3af' }}>
                    Safety groups, QR invites, your own lock &amp; check-in prefs
                  </p>
                </div>
              </div>
              <SettingsRowChevron ariaHidden />
            </div>
          </Link>
        </Card>
        <Card style={{ marginBottom: 12 }}>
          <Link href="/account/preferences/notifications" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: prefRowPad,
                minHeight: prefRowMinH,
              }}
            >
              <div>
                <span style={{ fontSize: 14, color: '#444', fontWeight: 600 }}>Notifications</span>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: '#9ca3af' }}>
                  Push, email, SMS — per category opt-in (F-6.5.15)
                </p>
              </div>
              <SettingsRowChevron ariaHidden />
            </div>
          </Link>
        </Card>
        <Card style={{ marginBottom: 12 }}>
          <Link
            href="/account/preferences/contextual-intelligence"
            style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: prefRowPad,
                minHeight: prefRowMinH,
              }}
            >
              <div>
                <span style={{ fontSize: 14, color: '#444', fontWeight: 600 }}>Contextual intelligence</span>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: '#9ca3af' }}>
                  &quot;Right now&quot; trip prompts, evidence nudges, deadlines
                </p>
              </div>
              <SettingsRowChevron ariaHidden />
            </div>
          </Link>
        </Card>
        <Card style={{ marginBottom: 12 }}>
          <div
            role="button"
            tabIndex={0}
            onClick={() => setCreatorDiscoveryOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') setCreatorDiscoveryOpen(true);
            }}
            style={{ cursor: 'pointer' }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: prefRowPad,
                minHeight: prefRowMinH,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M4 19.5A2.5 2.5 0 016.5 17H20"
                    stroke="#7c3aed"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"
                    stroke="#7c3aed"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div>
                  <span style={{ fontSize: 14, color: '#444', fontWeight: 600 }}>Discovery Preferences</span>
                  <p style={{ margin: '3px 0 0', fontSize: 12, color: '#9ca3af' }}>
                    Travel profile &amp; style signals used for creator matching
                  </p>
                </div>
              </div>
              <SettingsRowChevron ariaHidden />
            </div>
          </div>
        </Card>
        <Card>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: prefRowPad,
            minHeight: prefRowMinH,
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
            padding: prefRowPad,
            minHeight: prefRowMinH,
            borderBottom: '1px solid #f5f5f5',
          }}>
            <div>
              <span style={{ fontSize: 14, color: '#444', fontWeight: 400 }}>Passport Country</span>
              <p style={{ fontSize: 11, color: '#bbb', margin: '2px 0 0' }}>
                Used for visa window reference checks (best-effort, not legal advice)
              </p>
            </div>
            <CountrySelect
              value={passportCountry}
              onChange={setPassportCountry}
              placeholder="Select passport"
            />
          </div>
          {passportCountry !== (((profile?.preferences as Record<string, unknown> | undefined)?.passport_country as string | undefined) || '') ? (
            <div style={{ padding: '10px 18px 14px', borderBottom: '1px solid #f5f5f5' }}>
              <button
                onClick={savePassportPrefs}
                style={{
                  width: '100%',
                  padding: '10px 0',
                  background: '#1A2B4A',
                  border: 'none',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'white',
                  cursor: 'pointer',
                }}
              >
                Save passport country
              </button>
            </div>
          ) : null}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: prefRowPad,
            minHeight: prefRowMinH,
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
            padding: prefRowPad,
            minHeight: prefRowMinH,
            borderBottom: prefsChanged ? '1px solid #f5f5f5' : 'none',
          }}>
            <div>
              <span style={{ fontSize: 14, color: '#444', fontWeight: 400 }}>Email notifications</span>
              <p style={{ fontSize: 11, color: '#bbb', margin: '2px 0 0' }}>Trip alerts and claim updates</p>
            </div>
            <button
              type="button"
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
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: prefRowPad,
            minHeight: prefRowMinH,
            borderBottom: '1px solid #f5f5f5',
            flexWrap: 'wrap',
            gap: 12,
          }}>
            <span style={{ fontSize: 14, color: '#444', fontWeight: 400 }}>Temperature Unit</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['F', 'C'] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => {
                    setTempUnitPref(u);
                    void savePreferencePatch({ temperature_unit: u });
                  }}
                  style={{
                    minWidth: 44,
                    minHeight: 44,
                    padding: '0 14px',
                    borderRadius: 10,
                    border: tempUnitPref === u ? '2px solid #1A2B4A' : '1px solid #e5e7eb',
                    background: tempUnitPref === u ? '#eff4fc' : 'white',
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: 'pointer',
                    color: '#1A2B4A',
                  }}
                >
                  °{u}
                </button>
              ))}
            </div>
          </div>
          <div style={{ padding: prefRowPad, borderBottom: '1px solid #f5f5f5' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M4 12h2l1-3 2 6 2-10 2 7 1-2h2l1-1h1" stroke="#dc2626" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{ fontSize: 14, color: '#444', fontWeight: 600 }}>Medical Info</span>
            </div>
            <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 8px', lineHeight: 1.45 }}>
              Optional notes for your safety card (stored in your profile preferences).
            </p>
            <textarea
              value={medicalInfoDraft}
              onChange={(e) => setMedicalInfoDraft(e.target.value)}
              rows={3}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '12px 14px',
                borderRadius: 10,
                border: '1px solid #e5e7eb',
                fontSize: 14,
                fontFamily: 'inherit',
                minHeight: isMobile ? 88 : 72,
              }}
            />
            <button
              type="button"
              disabled={savingMedical}
              onClick={() => {
                void (async () => {
                  setSavingMedical(true);
                  await savePreferencePatch({ medical_info: medicalInfoDraft.trim() || null });
                  setSavingMedical(false);
                })();
              }}
              style={{
                marginTop: 10,
                width: isMobile ? '100%' : 'auto',
                minHeight: isMobile ? 48 : 40,
                padding: isMobile ? '12px 16px' : '8px 16px',
                background: '#1A2B4A',
                color: 'white',
                border: 'none',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                cursor: savingMedical ? 'not-allowed' : 'pointer',
                opacity: savingMedical ? 0.7 : 1,
              }}
            >
              {savingMedical ? 'Saving…' : 'Save medical info'}
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
                padding: prefRowPad,
                minHeight: prefRowMinH,
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
              <SettingsRowChevron />
            </div>
          </div>
        </Card>
      </div>

      <div id="travel-profile" style={{ marginBottom: 24 }}>
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
                <SettingsRowChevron />
              </div>
            } />
          </div>
          <div
            style={{ cursor: 'pointer' }}
            onClick={() => router.push('/rights')}
          >
            <Row label="Legal references (passenger rights)" action={
              <SettingsRowChevron />
            } />
          </div>
          <div
            style={{ cursor: 'pointer' }}
            onClick={() => window.open('/privacy', '_blank', 'noopener,noreferrer')}
          >
            <Row label="Privacy Policy" action={
              <SettingsRowChevron />
            } />
          </div>
          <div
            style={{ cursor: 'pointer' }}
            onClick={() => window.open('/terms', '_blank', 'noopener,noreferrer')}
          >
            <Row label="Terms of Service" action={
              <SettingsRowChevron />
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
                <SettingsRowChevron />
              </div>
            } />
          </div>

          <div style={{ cursor: 'pointer' }} onClick={() => setShowFeedbackModal(true)}>
            <Row
              label="Send Feedback"
              action={
                <SettingsRowChevron ariaHidden />
              }
            />
          </div>

          <div style={{ cursor: 'pointer' }} onClick={() => router.push('/get-started')}>
            <Row
              label="Help & Support"
              action={
                <SettingsRowChevron ariaHidden />
              }
              last
            />
          </div>
        </Card>
      </div>

      <CreatorDiscoveryModal open={creatorDiscoveryOpen} onClose={() => setCreatorDiscoveryOpen(false)} />

      <button
        type="button"
        onClick={handleSignOut}
        disabled={signOutLoading}
        style={{
          width: '100%',
          padding: '14px 0',
          minHeight: isMobile ? 48 : undefined,
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

      <div style={{ marginTop: 16, marginBottom: 24 }}>
        <SectionLabel>Danger Zone</SectionLabel>
        <div style={{ background: 'white', border: '1px solid #fee2e2', borderRadius: 14, padding: 12 }}>
          <button
            type="button"
            onClick={() => {
              setDeleteError(null);
              setDeleteConfirmText('');
              setDeletePassword('');
              setShowDeleteModal(true);
            }}
            disabled={signOutLoading}
            style={{
              width: '100%',
              padding: isMobile ? '14px 0' : '12px 0',
              minHeight: isMobile ? 48 : 44,
              background: 'none',
              border: '1.5px solid #fca5a5',
              borderRadius: 14,
              fontSize: 14,
              fontWeight: 800,
              color: '#b91c1c',
              cursor: signOutLoading ? 'not-allowed' : 'pointer',
            }}
          >
            Delete account
          </button>
          <p style={{ margin: '10px 6px 0', fontSize: 12, color: '#991b1b', lineHeight: 1.5 }}>
            This starts GDPR erasure. You must confirm with the phrase and your password.
          </p>
        </div>
      </div>

      {showDeleteModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 110, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }}
            onClick={() => setShowDeleteModal(false)}
          />
          <div style={{ position: 'relative', background: 'white', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, padding: '24px 18px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
              <div>
                <p style={{ fontSize: 18, fontWeight: 900, color: '#1A2B4A', margin: '0 0 4px' }}>Delete account</p>
                <p style={{ fontSize: 13, color: '#6b7280', margin: 0, lineHeight: 1.5 }}>
                  Type <span style={{ fontFamily: 'monospace' }}>DELETE</span> and enter your password to confirm.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#9ca3af' }}
                aria-label="Close"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#374151' }}>Confirmation</span>
                <input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Type DELETE"
                  style={{ minHeight: 48, padding: '12px 14px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 14 }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#374151' }}>Password</span>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Your password"
                  style={{ minHeight: 48, padding: '12px 14px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 14 }}
                />
              </label>

              {deleteError ? (
                <p role="alert" style={{ margin: 0, fontSize: 12, color: '#dc2626' }}>
                  {deleteError}
                </p>
              ) : null}

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleteSending}
                  style={{ flex: 1, minHeight: 48, padding: '12px 14px', borderRadius: 10, border: '1px solid #e5e7eb', background: 'white', fontWeight: 800, cursor: deleteSending ? 'not-allowed' : 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeleteAccount()}
                  disabled={deleteSending || deleteConfirmText !== 'DELETE' || !deletePassword.trim()}
                  style={{
                    flex: 1,
                    minHeight: 48,
                    padding: '12px 14px',
                    borderRadius: 10,
                    border: 'none',
                    background: deleteSending ? '#fca5a5' : '#b91c1c',
                    color: 'white',
                    fontWeight: 900,
                    cursor: deleteSending ? 'not-allowed' : 'pointer',
                    opacity: deleteSending ? 0.8 : 1,
                  }}
                >
                  {deleteSending ? 'Deleting…' : 'Delete account'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showFeedbackModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 105, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }}
            onClick={() => setShowFeedbackModal(false)}
          />
          <div style={{ position: 'relative', background: 'white', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, padding: '24px 18px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
              <div>
                <p style={{ fontSize: 18, fontWeight: 900, color: '#1A2B4A', margin: '0 0 4px' }}>Send feedback</p>
                <p style={{ fontSize: 13, color: '#6b7280', margin: 0, lineHeight: 1.5 }}>
                  Share what you found. Screenshots are optional.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowFeedbackModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#9ca3af' }}
                aria-label="Close"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#374151' }}>Category</span>
                <select
                  value={feedbackCategory}
                  onChange={(e) => setFeedbackCategory(e.target.value as any)}
                  style={{ minHeight: 48, padding: '12px 14px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 14 }}
                >
                  <option value="bug">Bug</option>
                  <option value="feature">Feature request</option>
                  <option value="question">Question</option>
                  <option value="other">Other</option>
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#374151' }}>Message</span>
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  rows={4}
                  placeholder="What happened? What did you expect?"
                  style={{ minHeight: 120, padding: '12px 14px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 14, resize: 'vertical', fontFamily: 'inherit' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#374151' }}>Screenshot (optional)</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) {
                      setFeedbackScreenshotDataUrl(null);
                      return;
                    }
                    if (file.size > 2_000_000) {
                      setFeedbackError('Screenshot is too large (max 2MB).');
                      return;
                    }
                    setFeedbackError(null);
                    const reader = new FileReader();
                    reader.onloadend = () => setFeedbackScreenshotDataUrl(typeof reader.result === 'string' ? reader.result : null);
                    reader.readAsDataURL(file);
                  }}
                  style={{ minHeight: 48, padding: '12px 14px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 14 }}
                />
              </label>

              {feedbackError ? (
                <p role="alert" style={{ margin: 0, fontSize: 12, color: '#dc2626' }}>
                  {feedbackError}
                </p>
              ) : null}
              {feedbackSuccess ? (
                <p style={{ margin: 0, fontSize: 12, color: '#14532d' }}>{feedbackSuccess}</p>
              ) : null}

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowFeedbackModal(false)}
                  disabled={feedbackSending}
                  style={{ flex: 1, minHeight: 48, padding: '12px 14px', borderRadius: 10, border: '1px solid #e5e7eb', background: 'white', fontWeight: 800, cursor: feedbackSending ? 'not-allowed' : 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSubmitFeedback()}
                  disabled={feedbackSending || !feedbackText.trim()}
                  style={{
                    flex: 1,
                    minHeight: 48,
                    padding: '12px 14px',
                    borderRadius: 10,
                    border: 'none',
                    background: feedbackSending ? '#93c5fd' : '#1A2B4A',
                    color: 'white',
                    fontWeight: 900,
                    cursor: feedbackSending ? 'not-allowed' : 'pointer',
                    opacity: feedbackSending ? 0.85 : 1,
                  }}
                >
                  {feedbackSending ? 'Sending…' : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
