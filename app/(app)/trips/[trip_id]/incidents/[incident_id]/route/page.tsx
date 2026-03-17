'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/auth/supabase-client';

const RECIPIENT_TYPES = [
  { value: 'travel_insurer', label: 'Travel insurance provider' },
  { value: 'credit_card', label: 'Credit card benefit' },
  { value: 'airline', label: 'Airline / carrier' },
  { value: 'hotel', label: 'Hotel / accommodation' },
  { value: 'car_rental', label: 'Car rental company' },
  { value: 'other', label: 'Other' },
];

export default function ClaimRoutingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const tripId = params?.trip_id as string;
  const incidentId = params?.incident_id as string;

  const [incident, setIncident] = useState<any>(null);
  const [policies, setPolicies] = useState<any[]>([]);
  const [evidence, setEvidence] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedPolicyId, setSelectedPolicyId] = useState('');
  const [recipientType, setRecipientType] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [claimAmount, setClaimAmount] = useState('');
  const [claimCurrency, setClaimCurrency] = useState('USD');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!user || !incidentId) return;
    Promise.all([
      supabase.from('incidents').select('*').eq('id', incidentId).maybeSingle(),
      supabase.from('policies').select('policy_id, policy_label, provider_name').eq('trip_id', tripId),
      supabase.from('evidence').select('*').eq('incident_id', incidentId).order('created_at', { ascending: false }),
    ]).then(([incRes, polRes, evRes]) => {
      if (!incRes.data || incRes.data.canonical_status !== 'CLAIM_ROUTING_READY') {
        router.replace(`/trips/${tripId}/incidents/${incidentId}`);
        return;
      }
      setIncident(incRes.data);
      setPolicies(polRes.data || []);
      setEvidence(evRes.data || []);
      setLoading(false);
    });.catch((err) => { console.error("[fetch] error:", err); setLoading(false); });
  }, [user, incidentId, tripId]);

  const handleSubmit = async () => {
    if (!recipientType || !recipientName.trim()) {
      setError('Please fill in the claim recipient type and name.');
      return;
    }
    setError('');
    setSubmitting(true);

    const { error: rpcErr } = await supabase.rpc('change_incident_status', {
      p_incident_id: incidentId,
      p_new_status: 'SUBMITTED',
      p_actor_id: user!.id,
      p_reason: 'claim_routed',
    });

    if (rpcErr) {
      setError(rpcErr.message || 'Could not submit the claim. Please try again.');
      setSubmitting(false);
      return;
    }

    if (claimAmount) {
      await supabase.rpc('register_evidence', {
        p_incident_id: incidentId,
        p_type: 'claim_submission_record',
        p_name: `Claim filed with ${recipientName}`,
        p_description: `Recipient: ${recipientName} (${recipientType}). Amount: ${claimAmount} ${claimCurrency}. ${notes}`.trim(),
        p_actor_id: user!.id,
        p_idempotency_key: `claim-route-${Date.now()}`,
      });
    }

    setSubmitting(false);
    setSubmitted(true);
  };

  if (loading) {
    return (
      <div style={{ padding: '48px 0', textAlign: 'center' }}>
        <div style={{
          width: 28, height: 28, border: '2.5px solid #e5e5e5',
          borderTopColor: '#1A2B4A', borderRadius: '50%',
          margin: '0 auto', animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!incident) return null;

  if (submitted) {
    return (
      <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: 600 }}>
        <div style={{
          background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 16,
          padding: '48px 32px', textAlign: 'center',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: '#f0fdf4', border: '1.5px solid #bbf7d0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M9 12l2 2 4-4" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="12" cy="12" r="10" stroke="#16a34a" strokeWidth="1.5"/>
            </svg>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1A2B4A', margin: '0 0 10px', letterSpacing: '-0.3px' }}>
            Claim submitted
          </h2>
          <p style={{ fontSize: 14, color: '#666', margin: '0 0 8px', lineHeight: 1.6 }}>
            Your claim has been routed to <strong>{recipientName}</strong>. The incident status has been updated to Submitted.
          </p>
          <p style={{ fontSize: 13, color: '#999', margin: '0 0 32px', lineHeight: 1.5 }}>
            Keep all reference numbers and correspondence. Follow up if you don&apos;t hear back within the timeframe specified in your policy.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href={`/trips/${tripId}/incidents/${incidentId}`} style={{
              padding: '10px 22px', background: '#1A2B4A', color: 'white',
              borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 600,
            }}>
              View incident record
            </Link>
            <Link href={`/trips/${tripId}`} style={{
              padding: '10px 22px', background: 'white', color: '#1A2B4A',
              border: '1px solid #dbeafe', borderRadius: 8, textDecoration: 'none',
              fontSize: 13, fontWeight: 600,
            }}>
              Back to trip
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: 700 }}>
      <Link href={`/trips/${tripId}/incidents/${incidentId}`} style={{
        fontSize: 13, color: '#888', textDecoration: 'none',
        display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 24,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M19 12H5M12 19l-7-7 7-7" stroke="#aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Back to incident
      </Link>

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1A2B4A', margin: '0 0 6px', letterSpacing: '-0.4px' }}>
          Route this claim
        </h1>
        <p style={{ fontSize: 14, color: '#666', margin: 0, lineHeight: 1.6 }}>
          Tell us who you&apos;re filing with and we&apos;ll record this routing in your incident file.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {evidence.length > 0 && (
          <div style={{ background: '#f7f9fc', border: '1px solid #dbeafe', borderRadius: 12, padding: '16px 18px' }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#2E5FA3', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Evidence attached ({evidence.length} item{evidence.length !== 1 ? 's' : ''})
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {evidence.slice(0, 4).map((ev, i) => (
                <div key={ev.id || i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M9 12l2 2 4-4" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span style={{ fontSize: 12, color: '#555' }}>{ev.name || 'Document'}</span>
                </div>
              ))}
              {evidence.length > 4 && (
                <span style={{ fontSize: 12, color: '#999' }}>+{evidence.length - 4} more</span>
              )}
            </div>
          </div>
        )}

        <div style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '20px 22px' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A', margin: '0 0 16px' }}>
            Claim recipient
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#555', marginBottom: 6 }}>
                Recipient type
              </label>
              <select
                value={recipientType}
                onChange={(e) => setRecipientType(e.target.value)}
                style={{
                  width: '100%', padding: '9px 11px', fontSize: 13,
                  border: '1px solid #ddd', borderRadius: 8, outline: 'none',
                  color: recipientType ? '#111' : '#999', background: 'white',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
              >
                <option value="">Select type…</option>
                {RECIPIENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#555', marginBottom: 6 }}>
                Recipient name
              </label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="e.g. Allianz Travel Insurance"
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '9px 11px', fontSize: 13,
                  border: '1px solid #ddd', borderRadius: 8, outline: 'none', color: '#111',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
              />
            </div>

            {policies.length > 0 && (
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#555', marginBottom: 6 }}>
                  Policy being claimed (optional)
                </label>
                <select
                  value={selectedPolicyId}
                  onChange={(e) => setSelectedPolicyId(e.target.value)}
                  style={{
                    width: '100%', padding: '9px 11px', fontSize: 13,
                    border: '1px solid #ddd', borderRadius: 8, outline: 'none',
                    color: selectedPolicyId ? '#111' : '#999', background: 'white',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                  }}
                >
                  <option value="">Select policy…</option>
                  {policies.map((p) => (
                    <option key={p.policy_id} value={p.policy_id}>
                      {p.policy_label || p.provider_name || 'Unnamed policy'}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        <div style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '20px 22px' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A', margin: '0 0 16px' }}>
            Claim amount (optional)
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#555', marginBottom: 6 }}>
                Amount
              </label>
              <input
                type="number"
                value={claimAmount}
                onChange={(e) => setClaimAmount(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '9px 11px', fontSize: 13,
                  border: '1px solid #ddd', borderRadius: 8, outline: 'none', color: '#111',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#555', marginBottom: 6 }}>
                Currency
              </label>
              <select
                value={claimCurrency}
                onChange={(e) => setClaimCurrency(e.target.value)}
                style={{
                  width: '100%', padding: '9px 11px', fontSize: 13,
                  border: '1px solid #ddd', borderRadius: 8, outline: 'none',
                  color: '#111', background: 'white',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
              >
                {['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'SGD'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '20px 22px' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A', margin: '0 0 10px' }}>
            Additional notes (optional)
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Reference numbers, case IDs, contact names, or anything else to record with this filing."
            style={{
              width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: 13,
              border: '1px solid #ddd', borderRadius: 8, outline: 'none', color: '#111',
              resize: 'vertical', lineHeight: 1.6,
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          />
        </div>

        {error && (
          <p style={{ fontSize: 13, color: '#dc2626', margin: 0 }}>{error}</p>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              flex: 1, padding: '13px 0',
              background: submitting ? '#93afd4' : '#1A2B4A',
              color: 'white', border: 'none', borderRadius: 10,
              fontSize: 14, fontWeight: 700,
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            {submitting ? 'Submitting…' : 'Submit claim filing'}
          </button>
          <Link href={`/trips/${tripId}/incidents/${incidentId}`} style={{
            padding: '13px 20px',
            background: 'white', color: '#1A2B4A',
            border: '1px solid #e0e0e0',
            borderRadius: 10, textDecoration: 'none',
            fontSize: 14, fontWeight: 600,
            display: 'flex', alignItems: 'center',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}>
            Cancel
          </Link>
        </div>

        <p style={{ fontSize: 11, color: '#bbb', margin: '-8px 0 0', lineHeight: 1.5 }}>
          This records the claim routing in your incident file. It does not submit to any insurer on your behalf.
        </p>
      </div>
    </div>
  );
}
