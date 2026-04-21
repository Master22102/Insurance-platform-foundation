'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/auth/supabase-client';
import DeepScanPanel from '@/components/DeepScanPanel';

const COUNTRY_NAME_MAP: Record<string, string> = {
  US: 'United States', GB: 'United Kingdom', CA: 'Canada', AU: 'Australia',
  DE: 'Germany', FR: 'France', IT: 'Italy', ES: 'Spain', NL: 'Netherlands',
  CH: 'Switzerland', SE: 'Sweden', NO: 'Norway', DK: 'Denmark', FI: 'Finland',
  JP: 'Japan', KR: 'South Korea', CN: 'China', IN: 'India', SG: 'Singapore',
  HK: 'Hong Kong', NZ: 'New Zealand', ZA: 'South Africa', BR: 'Brazil',
  MX: 'Mexico', AR: 'Argentina', CL: 'Chile', AE: 'United Arab Emirates',
  SA: 'Saudi Arabia', IL: 'Israel', TR: 'Turkey', RU: 'Russia', PL: 'Poland',
  PT: 'Portugal', AT: 'Austria', BE: 'Belgium', IE: 'Ireland', GR: 'Greece',
  CZ: 'Czech Republic', HU: 'Hungary', RO: 'Romania', TH: 'Thailand',
  MY: 'Malaysia', ID: 'Indonesia', PH: 'Philippines', VN: 'Vietnam',
  EG: 'Egypt', NG: 'Nigeria', KE: 'Kenya',
};

function countryName(code: string) {
  return COUNTRY_NAME_MAP[code] ?? code;
}

function UnlockPaymentModal({ tripId, onSuccess, onClose }: { tripId: string; onSuccess: () => void; onClose: () => void }) {
  const { user } = useAuth();
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [name, setName] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const formatCardNumber = (v: string) => v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
  const formatExpiry = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 4);
    if (d.length >= 3) return `${d.slice(0, 2)}/${d.slice(2)}`;
    return d;
  };

  const handlePay = async () => {
    if (!name.trim() || cardNumber.replace(/\s/g, '').length < 16 || expiry.length < 5 || cvc.length < 3) {
      setError('Please fill in all card details.');
      return;
    }
    setError('');
    setProcessing(true);

    const paymentRef = `card-${Date.now()}`;
    const { data, error: rpcErr } = await supabase.rpc('unlock_trip', {
      p_trip_id: tripId,
      p_actor_id: user!.id,
      p_credits_to_add: 2,
      p_payment_ref: paymentRef,
    });

    setProcessing(false);

    if (rpcErr || !data?.success) {
      setError(rpcErr?.message || data?.error || 'Payment failed. Please try again.');
      return;
    }

    setDone(true);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }}
        onClick={onClose}
      />
      <div style={{
        position: 'relative', background: 'white',
        borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480,
        padding: '28px 28px 40px', zIndex: 1,
        animation: 'slideUp 0.25s cubic-bezier(0.32, 0.72, 0, 1)',
      }}>
        <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <p style={{ fontSize: 18, fontWeight: 700, color: '#1A2B4A', margin: '0 0 2px' }}>Unlock this trip</p>
            <p style={{ fontSize: 13, color: '#888', margin: 0 }}>One-time payment — $14.99</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#aaa' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {done ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: '#f0fdf4', border: '1px solid #bbf7d0',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M9 12l2 2 4-4" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#1A2B4A', margin: '0 0 4px' }}>Trip unlocked!</p>
            <p style={{ fontSize: 13, color: '#888', margin: '0 0 20px' }}>2 deep scan credits have been added.</p>
            <button onClick={() => { onSuccess(); onClose(); }} style={{
              width: '100%', padding: '12px 0',
              background: '#1A2B4A', color: 'white',
              border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>
              Continue
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#555', marginBottom: 5 }}>Cardholder name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Smith"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '10px 12px', fontSize: 14,
                    border: '1px solid #ddd', borderRadius: 8, outline: 'none', color: '#111',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#555', marginBottom: 5 }}>Card number</label>
                <input
                  type="text"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                  placeholder="1234 5678 9012 3456"
                  maxLength={19}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '10px 12px', fontSize: 14,
                    border: '1px solid #ddd', borderRadius: 8, outline: 'none', color: '#111',
                    letterSpacing: '0.08em',
                  }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#555', marginBottom: 5 }}>Expiry</label>
                  <input
                    type="text"
                    value={expiry}
                    onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                    placeholder="MM/YY"
                    maxLength={5}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '10px 12px', fontSize: 14,
                      border: '1px solid #ddd', borderRadius: 8, outline: 'none', color: '#111',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#555', marginBottom: 5 }}>CVC</label>
                  <input
                    type="text"
                    value={cvc}
                    onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="123"
                    maxLength={4}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '10px 12px', fontSize: 14,
                      border: '1px solid #ddd', borderRadius: 8, outline: 'none', color: '#111',
                    }}
                  />
                </div>
              </div>
            </div>

            {error && (
              <p style={{ fontSize: 12, color: '#dc2626', margin: '0 0 12px' }}>{error}</p>
            )}

            <div style={{ marginBottom: 14 }}>
              {['Deep coverage scan', 'Claim routing engine', 'Evidence packet builder', 'Priority documentation'].map((item) => (
                <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                    <path d="M9 12l2 2 4-4" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="12" cy="12" r="10" stroke="#16a34a" strokeWidth="1.5"/>
                  </svg>
                  <span style={{ fontSize: 12, color: '#555' }}>{item}</span>
                </div>
              ))}
            </div>

            <button
              onClick={handlePay}
              disabled={processing}
              style={{
                width: '100%', padding: '13px 0',
                background: processing ? '#93afd4' : '#1A2B4A',
                color: 'white', border: 'none', borderRadius: 10,
                fontSize: 15, fontWeight: 700,
                cursor: processing ? 'not-allowed' : 'pointer',
              }}
            >
              {processing ? 'Processing…' : 'Pay $14.99'}
            </button>
            <p style={{ fontSize: 11, color: '#bbb', textAlign: 'center', margin: '10px 0 0', lineHeight: 1.4 }}>
              Payment processing is in beta. Card data is not stored on our servers. By continuing, you agree to our terms.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

const MATURITY_COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
  DRAFT:                      { bg: '#f5f5f5', border: '#e0e0e0', text: '#777', label: 'Draft' },
  PRE_TRIP_STRUCTURED:        { bg: '#eff4fc', border: '#bfdbfe', text: '#2E5FA3', label: 'Planning' },
  INCIDENT_OPEN:              { bg: '#fffbeb', border: '#fde68a', text: '#92400e', label: 'Incident open' },
  DOCUMENTATION_IN_PROGRESS:  { bg: '#fffbeb', border: '#fde68a', text: '#92400e', label: 'In progress' },
  CLAIM_ROUTING_LOCKED:       { bg: '#fff7ed', border: '#fdba74', text: '#c2410c', label: 'Claim routing' },
  CLAIM_SUBMITTED:            { bg: '#eff4fc', border: '#bfdbfe', text: '#2E5FA3', label: 'Submitted' },
  POST_TRIP_RESOLVED:         { bg: '#f0fdf4', border: '#bbf7d0', text: '#16a34a', label: 'Resolved' },
  ARCHIVED:                   { bg: '#f5f5f5', border: '#e0e0e0', text: '#aaa', label: 'Archived' },
};

const TRAVEL_MODES = ['air', 'rail', 'sea', 'road', 'mixed'];
const TABS = ['Overview', 'Route', 'Coverage', 'Incidents', 'Claims'];

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '8px 10px',
  fontSize: 13,
  border: '1px solid #ddd',
  borderRadius: 6,
  outline: 'none',
  color: '#111',
  background: 'white',
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

function MaturityBadge({ state }: { state: string }) {
  const cfg = MATURITY_COLORS[state] || MATURITY_COLORS.DRAFT;
  return (
    <span style={{
      fontSize: 12, fontWeight: 600, color: cfg.text,
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      borderRadius: 20, padding: '4px 11px', whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  );
}

function formatDate(d?: string) {
  if (!d) return null;
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysBetween(a?: string, b?: string) {
  if (!a || !b) return null;
  const diff = new Date(b).getTime() - new Date(a).getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function daysUntil(d?: string) {
  if (!d) return null;
  const diff = new Date(d + 'T12:00:00').getTime() - Date.now();
  const days = Math.round(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return null;
  return days;
}

function StatChip({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{
      background: '#f7f8fa', border: '0.5px solid #e8e8e8',
      borderRadius: 10, padding: '12px 16px', flex: 1, minWidth: 100,
    }}>
      <p style={{ fontSize: 11, color: '#999', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        {label}
      </p>
      <p style={{ fontSize: 18, fontWeight: 700, color: '#1A2B4A', margin: 0, letterSpacing: '-0.3px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        {value}
      </p>
    </div>
  );
}

interface ArchiveResult {
  retention_days: number;
  legal_citation: string | null;
  eligible_for_hard_delete_at: string;
  jurisdiction: string;
  policy_name: string;
}

function EditTripPanel({ trip, onSaved, onCancel, onArchived }: { trip: any; onSaved: (updated: any) => void; onCancel: () => void; onArchived: (result: ArchiveResult) => void }) {
  const [name, setName] = useState(trip.trip_name || '');
  const [destination, setDestination] = useState(trip.destination_summary || '');
  const [departureDate, setDepartureDate] = useState(trip.departure_date || '');
  const [returnDate, setReturnDate] = useState(trip.return_date || '');
  const [travelMode, setTravelMode] = useState(trip.travel_mode_primary || 'air');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [archiving, setArchiving] = useState(false);

  async function handleSave() {
    if (!name.trim()) { setError('Trip name is required.'); return; }
    if (departureDate && returnDate && new Date(returnDate) <= new Date(departureDate)) {
      setError('Return date must be after departure date.');
      return;
    }
    setError('');
    setSaving(true);

    const { data, error: rpcError } = await supabase.rpc('update_trip', {
      p_trip_id: trip.trip_id,
      p_trip_name: name.trim(),
      p_destination_summary: destination.trim() || null,
      p_departure_date: departureDate || null,
      p_return_date: returnDate || null,
      p_travel_mode_primary: travelMode,
    });

    setSaving(false);

    if (rpcError || !data?.success) {
      setError(rpcError?.message || data?.error || 'Failed to save. Please try again.');
      return;
    }

    onSaved({
      ...trip,
      trip_name: name.trim(),
      destination_summary: destination.trim() || null,
      departure_date: departureDate || null,
      return_date: returnDate || null,
      travel_mode_primary: travelMode,
    });
  }

  return (
    <div style={{
      background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12,
      padding: '20px 20px', marginBottom: 24,
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <p style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A', margin: '0 0 16px' }}>Edit trip details</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#555', marginBottom: 4 }}>Trip name *</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#555', marginBottom: 4 }}>Destination</label>
          <input type="text" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="e.g. Lisbon, Portugal" style={inputStyle} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#555', marginBottom: 4 }}>Departure</label>
            <input type="date" value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#555', marginBottom: 4 }}>Return</label>
            <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} min={departureDate || undefined} style={inputStyle} />
          </div>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#555', marginBottom: 6 }}>Travel mode</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {TRAVEL_MODES.map((m) => (
              <button
                key={m}
                onClick={() => setTravelMode(m)}
                style={{
                  padding: '5px 12px',
                  border: `1px solid ${travelMode === m ? '#2E5FA3' : '#ddd'}`,
                  borderRadius: 6,
                  background: travelMode === m ? '#eff4fc' : 'white',
                  color: travelMode === m ? '#2E5FA3' : '#555',
                  fontSize: 12,
                  fontWeight: travelMode === m ? 600 : 400,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p style={{ fontSize: 12, color: '#b91c1c', margin: 0 }}>{error}</p>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 1, padding: '9px 0',
              background: saving ? '#93afd4' : '#1A2B4A',
              color: 'white', border: 'none', borderRadius: 7,
              fontSize: 13, fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button
            onClick={onCancel}
            style={{
              padding: '9px 16px',
              background: 'white', border: '1px solid #e5e7eb',
              borderRadius: 7, fontSize: 13, color: '#666',
              cursor: 'pointer', fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            Cancel
          </button>
        </div>

        <div style={{ borderTop: '1px solid #f5f5f5', paddingTop: 14, marginTop: 4 }}>
          {!showArchiveConfirm ? (
            <button
              onClick={() => setShowArchiveConfirm(true)}
              style={{
                width: '100%', padding: '9px 0',
                background: 'none', border: '1px solid #fee2e2',
                borderRadius: 7, fontSize: 13, fontWeight: 500, color: '#dc2626',
                cursor: 'pointer', fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            >
              Archive trip
            </button>
          ) : (
            <div style={{ background: '#fff7f7', border: '1px solid #fee2e2', borderRadius: 10, padding: '14px 16px' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#991b1b', margin: '0 0 6px' }}>
                Archive this trip?
              </p>
              <p style={{ fontSize: 12, color: '#b91c1c', margin: '0 0 14px', lineHeight: 1.6 }}>
                The trip will be removed from your active trips list. Your data will be retained for a jurisdiction-specific retention period before permanent deletion. An erasure record will be created.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={async () => {
                    setArchiving(true);
                    const { data, error: rpcErr } = await supabase.rpc('archive_trip', {
                      p_trip_id: trip.trip_id,
                      p_reason: 'user_requested',
                      p_jurisdiction: 'DEFAULT',
                    });
                    setArchiving(false);
                    if (rpcErr || !data?.success) {
                      setError(rpcErr?.message || data?.error || 'Archive failed. Please try again.');
                      setShowArchiveConfirm(false);
                      return;
                    }
                    onArchived(data as ArchiveResult);
                  }}
                  disabled={archiving}
                  style={{
                    flex: 1, padding: '9px 0',
                    background: archiving ? '#fca5a5' : '#dc2626',
                    color: 'white', border: 'none', borderRadius: 7,
                    fontSize: 13, fontWeight: 600,
                    cursor: archiving ? 'not-allowed' : 'pointer',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                  }}
                >
                  {archiving ? 'Archiving…' : 'Confirm archive'}
                </button>
                <button
                  onClick={() => setShowArchiveConfirm(false)}
                  style={{
                    padding: '9px 14px',
                    background: 'white', border: '1px solid #e5e7eb',
                    borderRadius: 7, fontSize: 13, color: '#666',
                    cursor: 'pointer', fontFamily: 'system-ui, -apple-system, sans-serif',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const VISA_ADVISORY_RULES: Array<{
  nationalities: string[];
  destinationKeywords: string[];
  message: string;
  severity: 'warn' | 'info';
}> = [
  {
    nationalities: ['US'],
    destinationKeywords: ['israel', 'tel aviv', 'jerusalem'],
    message: 'US passport holders typically require no advance visa for Israel (up to 90 days), but should carry proof of onward travel. Entry can be denied at border discretion.',
    severity: 'info',
  },
  {
    nationalities: ['US', 'GB', 'CA', 'AU'],
    destinationKeywords: ['russia', 'moscow', 'saint petersburg'],
    message: 'This destination may require an e-Visa or advance visa application. Apply at least 3–4 weeks before departure.',
    severity: 'warn',
  },
  {
    nationalities: ['US', 'GB', 'CA', 'AU', 'DE', 'FR'],
    destinationKeywords: ['india', 'delhi', 'mumbai', 'bangalore', 'kolkata'],
    message: 'An e-Visa (e-Tourist) is required for most western passport holders traveling to India. Apply online before departure.',
    severity: 'warn',
  },
  {
    nationalities: ['US', 'GB', 'CA', 'AU', 'DE', 'FR'],
    destinationKeywords: ['china', 'beijing', 'shanghai', 'guangzhou', 'chengdu'],
    message: 'A visa is generally required for China. Transit visa-free policies apply at some airports — confirm before flying.',
    severity: 'warn',
  },
  {
    nationalities: ['US', 'GB', 'CA', 'AU'],
    destinationKeywords: ['vietnam', 'hanoi', 'ho chi minh', 'saigon'],
    message: 'Vietnam offers e-Visa on arrival for many nationalities. Confirm your eligibility and apply online before your trip.',
    severity: 'info',
  },
  {
    nationalities: ['US', 'GB', 'CA', 'AU', 'DE', 'FR'],
    destinationKeywords: ['kenya', 'nairobi', 'mombasa'],
    message: 'Kenya requires an Electronic Travel Authorization (ETA) for most passport holders. Apply at least 72 hours in advance.',
    severity: 'warn',
  },
];

function getVisaAdvisories(
  travelers: Array<{ nationality: string }>,
  destination: string | null,
  profileNationality?: string | null,
) {
  if (!destination) return [];
  const dest = destination.toLowerCase();
  const advisories: Array<{ message: string; severity: 'warn' | 'info' }> = [];
  const seen = new Set<string>();

  const effectiveTravelers = travelers.length > 0
    ? travelers
    : profileNationality
      ? [{ nationality: profileNationality }]
      : [];

  if (!effectiveTravelers.length) return [];

  for (const rule of VISA_ADVISORY_RULES) {
    const matchesDest = rule.destinationKeywords.some((kw) => dest.includes(kw));
    if (!matchesDest) continue;
    const matchedNats = effectiveTravelers.filter((t) => t.nationality && rule.nationalities.includes(t.nationality));
    if (matchedNats.length > 0 && !seen.has(rule.message)) {
      advisories.push({ message: rule.message, severity: rule.severity });
      seen.add(rule.message);
    }
  }
  return advisories;
}

function OverviewTab({ trip, incidents, onEditClick, onUnlock, profileNationality }: { trip: any; incidents: any[]; onEditClick: () => void; onUnlock: () => void; profileNationality?: string | null }) {
  const duration = daysBetween(trip.departure_date, trip.return_date);
  const until = daysUntil(trip.departure_date);

  const travelers: Array<{ name: string; nationality: string }> = trip.metadata?.travelers || [];
  const visaAdvisories = getVisaAdvisories(travelers, trip.destination_summary, profileNationality);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {until !== null && <StatChip label="Days until departure" value={until} />}
        {duration !== null && <StatChip label="Trip duration" value={`${duration} days`} />}
        <StatChip label="Incidents" value={incidents.length} />
        <StatChip label="Coverage" value={trip.paid_unlock ? 'Active' : 'Basic'} />
      </div>

      {visaAdvisories.map((advisory, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'flex-start', gap: 12,
          background: advisory.severity === 'warn' ? '#fffbeb' : '#f0f9ff',
          border: `1px solid ${advisory.severity === 'warn' ? '#fde68a' : '#bae6fd'}`,
          borderRadius: 10, padding: '12px 16px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
            {advisory.severity === 'warn' ? (
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" stroke="#92400e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            ) : (
              <>
                <circle cx="12" cy="12" r="10" stroke="#0369a1" strokeWidth="1.7"/>
                <path d="M12 16v-4M12 8h.01" stroke="#0369a1" strokeWidth="2" strokeLinecap="round"/>
              </>
            )}
          </svg>
          <div>
            <p style={{
              fontSize: 12, fontWeight: 600, margin: '0 0 3px',
              color: advisory.severity === 'warn' ? '#92400e' : '#0369a1',
            }}>
              Visa advisory
            </p>
            <p style={{
              fontSize: 12, color: advisory.severity === 'warn' ? '#92400e' : '#0c4a6e',
              margin: 0, lineHeight: 1.55,
            }}>
              {advisory.message}
            </p>
          </div>
        </div>
      ))}

      {travelers.length > 0 && (
        <div style={{
          background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12,
          padding: '16px 20px', fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A', margin: '0 0 12px' }}>
            Travelers ({travelers.length})
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {travelers.map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: '#333' }}>{t.name || `Traveler ${i + 1}`}</span>
                {t.nationality && (
                  <span style={{
                    fontSize: 11, fontWeight: 500, color: '#2E5FA3',
                    background: '#eff4fc', border: '1px solid #bfdbfe',
                    borderRadius: 20, padding: '2px 8px',
                  }}>
                    {countryName(t.nationality)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{
        background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12,
        padding: '16px 20px', fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A', margin: 0 }}>Trip details</p>
          <button
            onClick={onEditClick}
            style={{
              background: 'none', border: '1px solid #e5e7eb', borderRadius: 6,
              padding: '5px 12px', fontSize: 12, fontWeight: 500, color: '#555',
              cursor: 'pointer', fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            Edit
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { label: 'Destination', value: trip.destination_summary },
            { label: 'Departure', value: formatDate(trip.departure_date) },
            { label: 'Return', value: formatDate(trip.return_date) },
            { label: 'Travel mode', value: trip.travel_mode_primary ? (trip.travel_mode_primary.charAt(0).toUpperCase() + trip.travel_mode_primary.slice(1)) : null },
            { label: 'Type', value: trip.is_group_trip ? 'Group trip' : 'Solo trip' },
          ].map((row) => row.value ? (
            <div key={row.label} style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
              <span style={{ fontSize: 12, color: '#aaa', minWidth: 90, fontFamily: 'system-ui, -apple-system, sans-serif' }}>{row.label}</span>
              <span style={{ fontSize: 13, color: '#333', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{row.value}</span>
            </div>
          ) : null)}
        </div>
        {!trip.destination_summary && !trip.departure_date && (
          <p style={{ fontSize: 12, color: '#bbb', margin: '8px 0 0', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            No details added yet. Click Edit to fill in destination and dates.
          </p>
        )}
      </div>

      {!trip.paid_unlock && (
        <div style={{
          background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '20px 24px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: '#f0f4ff', border: '1px solid #dbeafe',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <rect x="5" y="11" width="14" height="10" rx="2" stroke="#2E5FA3" strokeWidth="1.8"/>
                <path d="M8 11V7a4 4 0 018 0v4" stroke="#2E5FA3" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#1A2B4A', margin: '0 0 4px' }}>Unlock this trip</p>
              <p style={{ fontSize: 13, color: '#666', margin: 0, lineHeight: 1.5 }}>
                Get deep coverage analysis, claim routing guidance, and a ready-to-file packet.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 18 }}>
            {[
              'Deep coverage scan across all your policies',
              'Claim routing engine — know exactly what to file',
              'Ready-to-file evidence packet builder',
              'Priority incident documentation assistance',
            ].map((item) => (
              <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
                  <path d="M9 12l2 2 4-4" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="12" cy="12" r="10" stroke="#16a34a" strokeWidth="1.5"/>
                </svg>
                <span style={{ fontSize: 13, color: '#555' }}>{item}</span>
              </div>
            ))}
          </div>
          <button
            onClick={onUnlock}
            style={{
            width: '100%', padding: '11px 0',
            background: '#1A2B4A', color: 'white',
            border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'system-ui, -apple-system, sans-serif',
          }}>
            Unlock this trip — $14.99
          </button>
        </div>
      )}

      {trip.paid_unlock && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: '#f0fdf4', border: '1px solid #bbf7d0',
          borderRadius: 10, padding: '12px 16px',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M9 12l2 2 4-4" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="12" cy="12" r="10" stroke="#16a34a" strokeWidth="1.5"/>
          </svg>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#16a34a', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            Trip unlocked
          </span>
          {trip.deep_scan_credits_remaining > 0 && (
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#16a34a' }}>
              {trip.deep_scan_credits_remaining} deep scan {trip.deep_scan_credits_remaining === 1 ? 'credit' : 'credits'} remaining
            </span>
          )}
        </div>
      )}
    </div>
  );
}

const SEGMENT_TYPES = [
  { value: 'flight', label: 'Flight', icon: '✈' },
  { value: 'hotel', label: 'Hotel stay', icon: '🏨' },
  { value: 'train', label: 'Train / bus', icon: '🚂' },
  { value: 'car', label: 'Car rental', icon: '🚗' },
  { value: 'ferry', label: 'Ferry / cruise', icon: '⛴' },
  { value: 'other', label: 'Other', icon: '📍' },
];

interface RouteSegment {
  id: string;
  type: string;
  from: string;
  to: string;
  date: string;
  endDate: string;
  reference: string;
  notes: string;
}

function RouteTab({ trip }: { trip: any }) {
  const { user } = useAuth();
  const [segments, setSegments] = useState<RouteSegment[]>([]);
  const [loadingSegs, setLoadingSegs] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ type: 'flight', from: '', to: '', date: '', endDate: '', reference: '', notes: '' });

  // Load segments from Supabase
  useEffect(() => {
    supabase
      .from('route_segments')
      .select('*')
      .eq('trip_id', trip.trip_id)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        const mapped = (data || []).map((s: any) => ({
          id: s.segment_id,
          type: s.segment_type,
          from: s.origin || '',
          to: s.destination || '',
          date: s.depart_at ? s.depart_at.slice(0, 10) : '',
          endDate: s.arrive_at ? s.arrive_at.slice(0, 10) : '',
          reference: s.reference || '',
          notes: s.notes || '',
        }));
        setSegments(mapped);
        setLoadingSegs(false);
      });
  }, [trip.trip_id]);

  const handleAdd = async () => {
    if (!user || (!form.from.trim() && !form.to.trim() && !form.date)) return;
    setSaving(true);
    const { data } = await supabase.rpc('upsert_route_segment', {
      p_trip_id: trip.trip_id,
      p_segment_type: form.type,
      p_origin: form.from || null,
      p_destination: form.to || null,
      p_depart_at: form.date ? new Date(form.date).toISOString() : null,
      p_arrive_at: form.endDate ? new Date(form.endDate).toISOString() : null,
      p_reference: form.reference || null,
      p_notes: form.notes || null,
      p_sort_order: segments.length,
      p_actor_id: user.id,
    });
    setSaving(false);
    if (data?.success) {
      const newSeg: RouteSegment = { ...form, id: data.segment_id };
      setSegments((prev) => [...prev, newSeg]);
      setForm({ type: 'flight', from: '', to: '', date: '', endDate: '', reference: '', notes: '' });
      setAdding(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!user) return;
    setSaving(true);
    await supabase.rpc('upsert_route_segment', {
      p_trip_id: trip.trip_id,
      p_segment_id: id,
      p_segment_type: form.type,
      p_origin: form.from || null,
      p_destination: form.to || null,
      p_depart_at: form.date ? new Date(form.date).toISOString() : null,
      p_arrive_at: form.endDate ? new Date(form.endDate).toISOString() : null,
      p_reference: form.reference || null,
      p_notes: form.notes || null,
      p_actor_id: user.id,
    });
    setSaving(false);
    setSegments((prev) => prev.map((s) => s.id === id ? { ...form, id } : s));
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    await supabase.rpc('delete_route_segment', { p_segment_id: id, p_actor_id: user.id });
    setSegments((prev) => prev.filter((s) => s.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const startEdit = (seg: RouteSegment) => {
    setForm({ type: seg.type, from: seg.from, to: seg.to, date: seg.date, endDate: seg.endDate, reference: seg.reference, notes: seg.notes });
    setEditingId(seg.id);
    setAdding(false);
  };

  const segmentTypeCfg = (type: string) => SEGMENT_TYPES.find((s) => s.value === type) || SEGMENT_TYPES[0];

  const SegmentForm = ({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) => {
    return (
    <div style={{ background: '#f7f9fc', border: '1px solid #dbeafe', borderRadius: 12, padding: '16px 18px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {SEGMENT_TYPES.map((t) => (
          <button key={t.value} onClick={() => setForm((f) => ({ ...f, type: t.value }))} style={{
            padding: '5px 12px', fontSize: 12, fontWeight: form.type === t.value ? 600 : 400,
            border: `1px solid ${form.type === t.value ? '#2E5FA3' : '#ddd'}`,
            borderRadius: 6, background: form.type === t.value ? '#eff4fc' : 'white',
            color: form.type === t.value ? '#2E5FA3' : '#555', cursor: 'pointer',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#666', marginBottom: 4 }}>
            {['hotel', 'car'].includes(form.type) ? 'Location' : 'From'}
          </label>
          <input value={form.from} onChange={(e) => setForm((f) => ({ ...f, from: e.target.value }))}
            placeholder={['hotel', 'car'].includes(form.type) ? 'e.g. Lisbon' : 'e.g. JFK'}
            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 13, border: '1px solid #ddd', borderRadius: 7, outline: 'none', fontFamily: 'system-ui, -apple-system, sans-serif' }} />
        </div>
        {!['hotel', 'car'].includes(form.type) && (
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#666', marginBottom: 4 }}>To</label>
            <input value={form.to} onChange={(e) => setForm((f) => ({ ...f, to: e.target.value }))}
              placeholder="e.g. LHR"
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 13, border: '1px solid #ddd', borderRadius: 7, outline: 'none', fontFamily: 'system-ui, -apple-system, sans-serif' }} />
          </div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#666', marginBottom: 4 }}>
            {['hotel', 'car'].includes(form.type) ? 'Check-in / Start' : 'Date'}
          </label>
          <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 13, border: '1px solid #ddd', borderRadius: 7, outline: 'none', fontFamily: 'system-ui, -apple-system, sans-serif' }} />
        </div>
        {['hotel', 'car'].includes(form.type) && (
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#666', marginBottom: 4 }}>Check-out / End</label>
            <input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} min={form.date}
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 13, border: '1px solid #ddd', borderRadius: 7, outline: 'none', fontFamily: 'system-ui, -apple-system, sans-serif' }} />
          </div>
        )}
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#666', marginBottom: 4 }}>Reference (optional)</label>
          <input value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
            placeholder="Booking ref, flight no…"
            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 13, border: '1px solid #ddd', borderRadius: 7, outline: 'none', fontFamily: 'system-ui, -apple-system, sans-serif' }} />
        </div>
      </div>
      <input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
        placeholder="Notes (optional)"
        style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 13, border: '1px solid #ddd', borderRadius: 7, outline: 'none', marginBottom: 12, fontFamily: 'system-ui, -apple-system, sans-serif' }} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onSave} style={{
          flex: 1, padding: '9px 0', background: '#1A2B4A', color: 'white',
          border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>Save segment</button>
        <button onClick={onCancel} style={{
          padding: '9px 14px', background: 'white', border: '1px solid #e5e7eb',
          borderRadius: 7, fontSize: 13, color: '#666', cursor: 'pointer',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>Cancel</button>
      </div>
    </div>
    );
  };

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {loadingSegs ? (
        <div style={{ padding: '32px 0', textAlign: 'center' }}>
          <div style={{ width: 24, height: 24, border: '2px solid #e5e5e5', borderTopColor: '#1A2B4A', borderRadius: '50%', margin: '0 auto', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : (<>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#999', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {segments.length} segment{segments.length !== 1 ? 's' : ''}
        </p>
        {!adding && (
          <button onClick={() => { setAdding(true); setEditingId(null); setForm({ type: 'flight', from: '', to: '', date: '', endDate: '', reference: '', notes: '' }); }} style={{
            fontSize: 12, fontWeight: 600, color: '#2E5FA3',
            background: '#eff4fc', border: '1px solid #bfdbfe',
            borderRadius: 8, padding: '5px 12px', cursor: 'pointer',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}>
            + Add segment
          </button>
        )}
      </div>

      {adding && <SegmentForm onSave={handleAdd} onCancel={() => setAdding(false)} />}

      {segments.length === 0 && !adding && (
        <div style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '36px 24px', textAlign: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#f0f4ff', border: '1px solid #dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="#2E5FA3" strokeWidth="1.7" fill="none"/>
              <circle cx="12" cy="9" r="2.5" fill="#2E5FA3"/>
            </svg>
          </div>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#1A2B4A', margin: '0 0 6px' }}>No route segments yet</p>
          <p style={{ fontSize: 13, color: '#999', margin: '0 0 18px', lineHeight: 1.6 }}>
            Add flights, hotel stays, train legs, and car rentals to build your trip itinerary.
          </p>
          <button onClick={() => setAdding(true)} style={{
            padding: '9px 22px', background: '#1A2B4A', color: 'white',
            border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}>
            Add first segment
          </button>
        </div>
      )}

      {segments.map((seg, idx) => {
        const cfg = segmentTypeCfg(seg.type);
        const isEditing = editingId === seg.id;
        return (
          <div key={seg.id} style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12, overflow: 'hidden' }}>
            {isEditing ? (
              <div style={{ padding: '14px 18px' }}>
                <SegmentForm onSave={() => handleUpdate(seg.id)} onCancel={() => setEditingId(null)} />
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 18px' }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: '#f7f8fa', border: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16 }}>
                  {cfg.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A' }}>
                      {cfg.label}
                      {seg.from && ` · ${seg.from}`}
                      {seg.to && ` → ${seg.to}`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {seg.date && (
                      <span style={{ fontSize: 11, color: '#888' }}>
                        {new Date(seg.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {seg.endDate && ` – ${new Date(seg.endDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                      </span>
                    )}
                    {seg.reference && (
                      <span style={{ fontSize: 11, color: '#2E5FA3', background: '#eff4fc', borderRadius: 4, padding: '1px 6px' }}>
                        {seg.reference}
                      </span>
                    )}
                    {seg.notes && <span style={{ fontSize: 11, color: '#999' }}>{seg.notes}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => startEdit(seg)} style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: '#666', cursor: 'pointer', fontFamily: 'system-ui, -apple-system, sans-serif' }}>Edit</button>
                  <button onClick={() => handleDelete(seg.id)} style={{ background: 'none', border: '1px solid #fee2e2', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: '#dc2626', cursor: 'pointer', fontFamily: 'system-ui, -apple-system, sans-serif' }}>Remove</button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {segments.length > 0 && (
        <p style={{ fontSize: 11, color: '#bbb', margin: '4px 0 0', lineHeight: 1.5 }}>
          Route segments are saved locally on this device and attached to this trip for reference.
        </p>
      )}
    </>
    )}
    </div>
  );
}

const CLAUSE_FAMILY_LABELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  medical:            { label: 'Medical',            color: '#0369a1', bg: '#f0f9ff', border: '#bae6fd' },
  cancellation:       { label: 'Cancellation',       color: '#92400e', bg: '#fffbeb', border: '#fde68a' },
  delay:              { label: 'Delay',               color: '#92400e', bg: '#fffbeb', border: '#fde68a' },
  baggage:            { label: 'Baggage',             color: '#6b21a8', bg: '#faf5ff', border: '#e9d5ff' },
  liability:          { label: 'Liability',           color: '#1e40af', bg: '#eff6ff', border: '#bfdbfe' },
  evacuation:         { label: 'Evacuation',          color: '#065f46', bg: '#f0fdf4', border: '#bbf7d0' },
  interruption:       { label: 'Interruption',        color: '#9a3412', bg: '#fff7ed', border: '#fed7aa' },
  default:            { label: 'Coverage',            color: '#374151', bg: '#f9fafb', border: '#e5e7eb' },
};

function clauseFamilyConfig(family: string) {
  const key = (family || '').toLowerCase().split('_')[0];
  return CLAUSE_FAMILY_LABELS[key] || CLAUSE_FAMILY_LABELS.default;
}

function CoverageTab({ trip, onUnlock }: { trip: any; onUnlock: () => void }) {
  const [policies, setPolicies] = useState<any[]>([]);
  const [clausesByPolicy, setClausesByPolicy] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedPolicy, setExpandedPolicy] = useState<string | null>(null);

  useEffect(() => {
    if (!trip.paid_unlock) { setLoading(false); return; }

    supabase
      .from('policies')
      .select('policy_id, policy_label, provider_name, lifecycle_state, active_version_id, created_at')
      .eq('trip_id', trip.trip_id)
      .is('archived_at', null)
      .then(async ({ data: pols }) => {
        if (!pols || pols.length === 0) { setPolicies([]); setLoading(false); return; }
        setPolicies(pols);

        const versionIds = pols.map((p: any) => p.active_version_id).filter(Boolean);
        if (versionIds.length === 0) { setLoading(false); return; }

        const { data: clauses } = await supabase
          .from('policy_clauses')
          .select('clause_id, policy_version_id, clause_type, family_code, canonical_text, confidence_label, extraction_status')
          .in('policy_version_id', versionIds)
          .eq('extraction_status', 'AUTO_ACCEPTED')
          .order('family_code', { ascending: true });

        const map: Record<string, any[]> = {};
        for (const pol of pols) {
          if (pol.active_version_id) {
            map[pol.policy_id] = (clauses || []).filter((c: any) => c.policy_version_id === pol.active_version_id);
          }
        }
        setClausesByPolicy(map);
        if (pols.length > 0) setExpandedPolicy(pols[0].policy_id);
        setLoading(false);
      });
  }, [trip.trip_id, trip.paid_unlock]);

  if (!trip.paid_unlock) {
    return (
      <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <div style={{
          background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12,
          padding: '40px 24px', textAlign: 'center',
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: '#f0f4ff', border: '1px solid #dbeafe',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L4 6v6c0 5 3.6 9.7 8 11 4.4-1.3 8-6 8-11V6L12 2z" stroke="#2E5FA3" strokeWidth="1.7" fill="none"/>
              <path d="M9 12l2 2 4-4" stroke="#2E5FA3" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#1A2B4A', margin: '0 0 8px' }}>
            Coverage analysis requires an unlocked trip
          </p>
          <p style={{ fontSize: 13, color: '#888', margin: '0 0 24px', lineHeight: 1.6, maxWidth: 340, marginLeft: 'auto', marginRight: 'auto' }}>
            Unlock this trip to run a deep scan across your policies and see exactly what's covered.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20, textAlign: 'left', maxWidth: 300, margin: '0 auto 20px' }}>
            {['Per-policy coverage breakdown', 'Clause-level detail and limits', 'Gap analysis and recommendations'].map((item) => (
              <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M9 12l2 2 4-4" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="12" cy="12" r="10" stroke="#16a34a" strokeWidth="1.5"/>
                </svg>
                <span style={{ fontSize: 13, color: '#555' }}>{item}</span>
              </div>
            ))}
          </div>
          <button onClick={onUnlock} style={{
            padding: '10px 24px', background: '#1A2B4A', color: 'white',
            border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'system-ui, -apple-system, sans-serif',
          }}>
            Unlock trip — $14.99
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '48px 0', textAlign: 'center' }}>
        <div style={{
          width: 24, height: 24, border: '2.5px solid #e5e5e5',
          borderTopColor: '#1A2B4A', borderRadius: '50%',
          margin: '0 auto', animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (policies.length === 0) {
    return (
      <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <div style={{
          background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12,
          padding: '40px 24px', textAlign: 'center',
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: '#f0f4ff', border: '1px solid #dbeafe',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L4 6v6c0 5 3.6 9.7 8 11 4.4-1.3 8-6 8-11V6L12 2z" stroke="#2E5FA3" strokeWidth="1.7" fill="none"/>
            </svg>
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#1A2B4A', margin: '0 0 8px' }}>No policies attached yet</p>
          <p style={{ fontSize: 13, color: '#888', margin: '0 0 20px', lineHeight: 1.6 }}>
            Upload your travel insurance, credit card benefit guide, or airline contract to see your coverage breakdown here.
          </p>
          <Link href={`/policies/upload?trip=${trip.trip_id}`} style={{
            display: 'inline-block', padding: '10px 24px',
            background: '#1A2B4A', color: 'white',
            borderRadius: 8, fontSize: 14, fontWeight: 600,
            textDecoration: 'none', fontFamily: 'system-ui, -apple-system, sans-serif',
          }}>
            Upload a policy
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#999', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {policies.length} {policies.length === 1 ? 'policy' : 'policies'}
        </p>
        <Link href={`/policies/upload?trip=${trip.trip_id}`} style={{
          fontSize: 12, fontWeight: 600, color: '#2E5FA3',
          background: '#eff4fc', border: '1px solid #bfdbfe',
          borderRadius: 8, padding: '5px 12px', textDecoration: 'none',
        }}>
          + Add policy
        </Link>
      </div>

      {policies.map((pol) => {
        const clauses = clausesByPolicy[pol.policy_id] || [];
        const isExpanded = expandedPolicy === pol.policy_id;
        const hasVersion = !!pol.active_version_id;
        const families = Array.from(new Set(clauses.map((c: any) => c.family_code).filter(Boolean)));

        return (
          <div key={pol.policy_id} style={{
            background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12, overflow: 'hidden',
          }}>
            <button
              onClick={() => setExpandedPolicy(isExpanded ? null : pol.policy_id)}
              style={{
                width: '100%', padding: '14px 18px',
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                textAlign: 'left',
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#1A2B4A', margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {pol.policy_label || pol.provider_name || 'Policy'}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {pol.provider_name && pol.provider_name !== pol.policy_label && (
                    <span style={{ fontSize: 11, color: '#888' }}>{pol.provider_name}</span>
                  )}
                  {hasVersion ? (
                    <span style={{
                      fontSize: 10, fontWeight: 600, color: '#16a34a',
                      background: '#f0fdf4', border: '1px solid #bbf7d0',
                      borderRadius: 20, padding: '1px 7px',
                    }}>
                      {clauses.length > 0 ? `${clauses.length} clause${clauses.length !== 1 ? 's' : ''}` : 'Processed'}
                    </span>
                  ) : (
                    <span style={{
                      fontSize: 10, fontWeight: 600, color: '#92400e',
                      background: '#fffbeb', border: '1px solid #fde68a',
                      borderRadius: 20, padding: '1px 7px',
                    }}>
                      Pending extraction
                    </span>
                  )}
                </div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{
                flexShrink: 0, transition: 'transform 0.2s ease',
                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              }}>
                <path d="M6 9l6 6 6-6" stroke="#bbb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {isExpanded && (
              <div style={{ borderTop: '1px solid #f5f5f5', padding: '14px 18px' }}>
                {!hasVersion ? (
                  <p style={{ fontSize: 13, color: '#aaa', margin: 0, lineHeight: 1.5 }}>
                    This policy is still being processed. Check back shortly for extracted clauses.
                  </p>
                ) : clauses.length === 0 ? (
                  <div>
                    <p style={{ fontSize: 13, color: '#aaa', margin: '0 0 10px', lineHeight: 1.5 }}>
                      No clauses have been extracted from this policy yet. This can happen if the document was not machine-readable or the extraction is still in progress.
                    </p>
                    <Link href={`/policies/upload?trip=${trip.trip_id}`} style={{
                      fontSize: 12, fontWeight: 600, color: '#2E5FA3', textDecoration: 'none',
                    }}>
                      Re-upload this policy
                    </Link>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {families.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {families.map((f) => {
                          const cfg = clauseFamilyConfig(f as string);
                          return (
                            <span key={f as string} style={{
                              fontSize: 11, fontWeight: 600, color: cfg.color,
                              background: cfg.bg, border: `1px solid ${cfg.border}`,
                              borderRadius: 20, padding: '3px 9px',
                            }}>
                              {cfg.label}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {clauses.map((clause: any) => {
                        const cfg = clauseFamilyConfig(clause.family_code);
                        return (
                          <div key={clause.clause_id} style={{
                            background: '#f9fafb', border: '1px solid #f0f0f0',
                            borderRadius: 8, padding: '10px 12px',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <span style={{
                                fontSize: 10, fontWeight: 700, color: cfg.color,
                                background: cfg.bg, border: `1px solid ${cfg.border}`,
                                borderRadius: 20, padding: '2px 8px', whiteSpace: 'nowrap',
                              }}>
                                {cfg.label}
                              </span>
                              {clause.clause_type && clause.clause_type !== clause.family_code && (
                                <span style={{ fontSize: 10, color: '#aaa' }}>
                                  {(clause.clause_type as string).replace(/_/g, ' ')}
                                </span>
                              )}
                            </div>
                            <p style={{ fontSize: 12, color: '#444', margin: 0, lineHeight: 1.6 }}>
                              {clause.canonical_text}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <div style={{
        padding: '12px 16px', background: '#f7f8fa',
        border: '0.5px solid #e8e8e8', borderRadius: 10,
        fontSize: 12, color: '#888', lineHeight: 1.5,
      }}>
        Clauses shown are auto-accepted extractions. Coverage amounts and conditions depend on your specific policy terms.
      </div>

      <DeepScanPanel
        trip={trip}
        onUnlock={onUnlock}
      />
    </div>
  );
}

function ClaimsTab({ trip }: { trip: any }) {
  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{
        background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12,
        padding: '40px 24px', textAlign: 'center',
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: '#f0fdf4', border: '1px solid #bbf7d0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M9 11l3 3L22 4" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </div>
        <p style={{ fontSize: 15, fontWeight: 600, color: '#1A2B4A', margin: '0 0 8px' }}>
          No claims filed
        </p>
        <p style={{ fontSize: 13, color: '#888', margin: '0 0 20px', lineHeight: 1.6, maxWidth: 340, marginLeft: 'auto', marginRight: 'auto' }}>
          If something goes wrong, start by reporting an incident. The claim routing engine will guide you on what to file and where.
        </p>
        <Link
          href={`/trips/${trip.trip_id}/incidents/new`}
          style={{
            display: 'inline-block',
            padding: '10px 24px',
            background: '#1A2B4A', color: 'white',
            borderRadius: 8, fontSize: 14, fontWeight: 600,
            textDecoration: 'none', fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          Report an incident
        </Link>
      </div>
    </div>
  );
}

function IncidentsTab({ trip, incidents }: { trip: any; incidents: any[] }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Link href={`/trips/${trip.trip_id}/incidents/new`} style={{
          padding: '8px 16px', background: '#1A2B4A', color: 'white',
          borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 600,
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          Report an incident
        </Link>
      </div>
      {incidents.length === 0 ? (
        <div style={{ padding: '48px 0', textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: '#888', margin: '0 0 6px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            No incidents recorded.
          </p>
          <p style={{ fontSize: 13, color: '#aaa', margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            If something goes wrong on this trip, start here.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {incidents.map((inc) => (
            <Link key={inc.id} href={`/trips/${trip.trip_id}/incidents/${inc.id}`} style={{ textDecoration: 'none' }}>
              <div style={{
                background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 10, padding: '14px 16px',
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#1A2B4A', margin: '0 0 4px' }}>{inc.title}</p>
                <p style={{ fontSize: 12, color: '#aaa', margin: 0 }}>
                  {new Date(inc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function TripDetailPageInner() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const tripId = params?.trip_id as string;

  const [trip, setTrip] = useState<any>(null);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(() => {
    const tab = searchParams?.get('tab');
    return TABS.includes(tab || '') ? tab! : 'Overview';
  });
  const [editing, setEditing] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [archiveResult, setArchiveResult] = useState<ArchiveResult | null>(null);

  useEffect(() => {
    if (!user || !tripId) return;

    Promise.all([
      supabase
        .from('trips')
        .select('*')
        .eq('trip_id', tripId)
        .eq('created_by', user.id)
        .maybeSingle(),
      supabase
        .from('incidents')
        .select('id, title, canonical_status, disruption_type, created_at')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false }),
    ]).then(([tripRes, incRes]) => {
      if (!tripRes.data) { router.replace('/trips'); return; }
      setTrip(tripRes.data);
      setIncidents(incRes.data || []);
      setLoading(false);
    }).catch((err) => {
      console.error('[trip-detail] fetch failed:', err);
      setLoading(false);
    });
  }, [user, tripId]);

  if (loading) {
    return (
      <div style={{ padding: '48px 0', textAlign: 'center' }}>
        <div style={{
          width: 28, height: 28, border: '2.5px solid #e5e5e5',
          borderTopColor: '#1A2B4A', borderRadius: '50%',
          margin: '0 auto',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!trip) return null;

  const departure = formatDate(trip.departure_date);
  const returnDate = formatDate(trip.return_date);
  const dateRange = departure && returnDate ? `${departure} – ${returnDate}` : departure;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Link href="/trips" style={{
          fontSize: 13, color: '#888', textDecoration: 'none',
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          marginBottom: 16,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 19l-7-7 7-7" stroke="#aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          All trips
        </Link>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1A2B4A', margin: '0 0 8px', letterSpacing: '-0.4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
              {trip.trip_name}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <MaturityBadge state={trip.maturity_state || 'DRAFT'} />
              {trip.destination_summary && (
                <span style={{ fontSize: 13, color: '#666', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                  {trip.destination_summary}
                </span>
              )}
              {dateRange && (
                <span style={{ fontSize: 13, color: '#aaa', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                  {dateRange}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => { setEditing(!editing); setActiveTab('Overview'); }}
            style={{
              padding: '7px 14px',
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: 7,
              fontSize: 13, fontWeight: 500, color: '#555',
              cursor: 'pointer', fontFamily: 'system-ui, -apple-system, sans-serif',
              flexShrink: 0,
            }}
          >
            {editing ? 'Cancel edit' : 'Edit trip'}
          </button>
        </div>
      </div>

      {archiveResult && (
        <div style={{
          background: '#fff7ed', border: '1px solid #fed7aa',
          borderRadius: 12, padding: '16px 18px', marginBottom: 20,
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#92400e', margin: '0 0 6px' }}>
            Trip archived
          </p>
          <p style={{ fontSize: 13, color: '#92400e', margin: '0 0 4px', lineHeight: 1.6 }}>
            Your data will be retained until{' '}
            <strong>{new Date(archiveResult.eligible_for_hard_delete_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong>{' '}
            ({archiveResult.retention_days} days), then permanently deleted.
          </p>
          {archiveResult.legal_citation && (
            <p style={{ fontSize: 11, color: '#b45309', margin: '4px 0 0' }}>{archiveResult.legal_citation}</p>
          )}
          <button
            onClick={() => router.push('/trips')}
            style={{
              marginTop: 12, padding: '8px 16px',
              background: '#1A2B4A', color: 'white',
              border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            Back to trips
          </button>
        </div>
      )}

      {editing && !archiveResult && (
        <EditTripPanel
          trip={trip}
          onSaved={(updated) => { setTrip(updated); setEditing(false); }}
          onCancel={() => setEditing(false)}
          onArchived={(result) => { setArchiveResult(result); setEditing(false); }}
        />
      )}

      <div style={{
        display: 'flex', borderBottom: '1px solid #eaeaea', marginBottom: 24, gap: 0,
        overflowX: 'auto',
      }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 16px', background: 'none', border: 'none',
              cursor: 'pointer', fontSize: 14, fontWeight: activeTab === tab ? 600 : 400,
              color: activeTab === tab ? '#1A2B4A' : '#888',
              borderBottom: `2px solid ${activeTab === tab ? '#1A2B4A' : 'transparent'}`,
              marginBottom: -1, whiteSpace: 'nowrap',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Overview' && <OverviewTab trip={trip} incidents={incidents} onEditClick={() => setEditing(true)} onUnlock={() => setShowPayModal(true)} profileNationality={profile?.primary_nationality} />}
      {activeTab === 'Route' && <RouteTab trip={trip} />}
      {activeTab === 'Coverage' && <CoverageTab trip={trip} onUnlock={() => setShowPayModal(true)} />}
      {activeTab === 'Incidents' && <IncidentsTab trip={trip} incidents={incidents} />}
      {activeTab === 'Claims' && <ClaimsTab trip={trip} />}

      {showPayModal && (
        <UnlockPaymentModal
          tripId={trip.trip_id}
          onSuccess={() => setTrip({ ...trip, paid_unlock: true, deep_scan_credits_remaining: 2 })}
          onClose={() => setShowPayModal(false)}
        />
      )}
    </div>
  );
}

export default function TripDetailPage() {
  return (
    <Suspense>
      <TripDetailPageInner />
    </Suspense>
  );
}
