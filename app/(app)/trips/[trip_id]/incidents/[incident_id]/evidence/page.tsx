'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/auth/supabase-client';

const INCIDENT_TYPES = [
  { id: 'flight_delay', label: 'Flight delay' },
  { id: 'flight_cancel', label: 'Flight cancellation' },
  { id: 'baggage_lost', label: 'Lost baggage' },
  { id: 'baggage_delayed', label: 'Delayed baggage' },
  { id: 'baggage_damaged', label: 'Damaged baggage' },
  { id: 'medical', label: 'Medical issue' },
  { id: 'accommodation', label: 'Accommodation problem' },
  { id: 'vehicle_rental', label: 'Vehicle rental issue' },
  { id: 'other', label: 'Other' },
];

const CARRIER_RESPONSES = [
  { id: 'rebooking', label: 'Rebooking' },
  { id: 'refund', label: 'Refund' },
  { id: 'voucher', label: 'Travel voucher' },
  { id: 'nothing', label: 'Nothing offered' },
  { id: 'other', label: 'Other' },
];

export default function EvidenceCapturePage() {
  const { trip_id, incident_id } = useParams<{ trip_id: string; incident_id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [incidentType, setIncidentType] = useState('');
  const [occurredAt, setOccurredAt] = useState('');
  const [carrierOffer, setCarrierOffer] = useState('');
  const [carrierAmount, setCarrierAmount] = useState('');
  const [accepted, setAccepted] = useState<string>('');
  const [carrierRef, setCarrierRef] = useState('');
  const [voiceNote, setVoiceNote] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [incident, setIncident] = useState<any>(null);

  useEffect(() => {
    if (!user || !incident_id) return;
    (async () => {
      const { data } = await supabase.from('incidents').select('*').eq('id', incident_id).maybeSingle();
      if (data) {
        setIncident(data);
        if (data.incident_type) setIncidentType(data.incident_type);
      }
    })();
  }, [user, incident_id]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(Array.from(e.target.files));
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    setError('');

    const evidencePayload = {
      incident_type: incidentType || null,
      occurred_at: occurredAt || null,
      carrier_response: carrierOffer || null,
      carrier_amount: carrierAmount || null,
      carrier_offer_accepted: accepted || null,
      carrier_reference: carrierRef || null,
      voice_note: voiceNote || null,
      file_count: files.length,
    };

    const { error: rpcErr } = await supabase.rpc('register_evidence', {
      p_incident_id: incident_id,
      p_actor_id: user.id,
      p_evidence_type: 'structured_capture',
      p_payload: evidencePayload,
      p_idempotency_key: `evidence-${incident_id}-${Date.now()}`,
    });

    if (rpcErr) {
      setError(rpcErr.message || 'Could not save evidence.');
      setSaving(false);
      return;
    }

    router.push(`/trips/${trip_id}/incidents/${incident_id}`);
  };

  return (
    <div style={{ maxWidth: 680, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <Link
        href={`/trips/${trip_id}/incidents/${incident_id}`}
        style={{ fontSize: 13, color: '#888', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 16 }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 19l-7-7 7-7" stroke="#aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        Back to incident
      </Link>

      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A2B4A', margin: '0 0 4px' }}>Capture evidence</h1>
      <p style={{ fontSize: 13, color: '#888', margin: '0 0 24px', lineHeight: 1.55 }}>
        Documenting now preserves your options later, even if you are unsure about filing.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* What happened */}
        <div style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '18px 20px' }}>
          <h2 style={{ fontSize: 11, fontWeight: 700, color: '#2E5FA3', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 10px' }}>
            What happened
          </h2>
          <select
            value={incidentType}
            onChange={(e) => setIncidentType(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, background: '#f7f8fa', marginBottom: 12 }}
          >
            <option value="">Select incident type</option>
            {INCIDENT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>

          <label style={{ fontSize: 11, fontWeight: 600, color: '#888', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            When it happened
          </label>
          <input
            type="datetime-local"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
          />
        </div>

        {/* Carrier response */}
        <div style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '18px 20px' }}>
          <h2 style={{ fontSize: 11, fontWeight: 700, color: '#2E5FA3', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 10px' }}>
            Carrier response
          </h2>

          <label style={{ fontSize: 11, fontWeight: 600, color: '#888', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            What did the carrier offer?
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {CARRIER_RESPONSES.map((cr) => (
              <button
                key={cr.id}
                onClick={() => setCarrierOffer(cr.id)}
                style={{
                  padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                  background: carrierOffer === cr.id ? '#eff4fc' : 'white',
                  border: carrierOffer === cr.id ? '1.5px solid #2E5FA3' : '1px solid #e2e8f0',
                  color: carrierOffer === cr.id ? '#2E5FA3' : '#555',
                  cursor: 'pointer', transition: 'all 0.12s ease',
                }}
              >
                {cr.label}
              </button>
            ))}
          </div>

          {carrierOffer && carrierOffer !== 'nothing' && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#888', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Amount offered (if applicable)
              </label>
              <input
                value={carrierAmount}
                onChange={(e) => setCarrierAmount(e.target.value)}
                placeholder="e.g. $200 voucher"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
              />
            </div>
          )}

          <label style={{ fontSize: 11, fontWeight: 600, color: '#888', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Did you accept?
          </label>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {[{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }, { id: 'pending', label: 'Pending' }].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setAccepted(opt.id)}
                style={{
                  padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                  background: accepted === opt.id ? '#eff4fc' : 'white',
                  border: accepted === opt.id ? '1.5px solid #2E5FA3' : '1px solid #e2e8f0',
                  color: accepted === opt.id ? '#2E5FA3' : '#555',
                  cursor: 'pointer',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <label style={{ fontSize: 11, fontWeight: 600, color: '#888', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Reference number from carrier
          </label>
          <input
            value={carrierRef}
            onChange={(e) => setCarrierRef(e.target.value)}
            placeholder="Optional"
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
          />
        </div>

        {/* File upload */}
        <div style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '18px 20px' }}>
          <h2 style={{ fontSize: 11, fontWeight: 700, color: '#2E5FA3', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 10px' }}>
            Upload files
          </h2>
          <p style={{ fontSize: 12, color: '#888', margin: '0 0 10px', lineHeight: 1.55 }}>
            Photos, screenshots, boarding passes, receipts, or any supporting documentation.
          </p>
          <input
            type="file"
            multiple
            onChange={handleFileChange}
            style={{ fontSize: 13 }}
          />
          {files.length > 0 && (
            <p style={{ fontSize: 12, color: '#555', margin: '8px 0 0' }}>
              {files.length} file{files.length !== 1 ? 's' : ''} selected
            </p>
          )}
        </div>

        {/* Voice note */}
        <div style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '18px 20px' }}>
          <h2 style={{ fontSize: 11, fontWeight: 700, color: '#2E5FA3', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 10px' }}>
            Voice note (optional)
          </h2>
          <textarea
            value={voiceNote}
            onChange={(e) => setVoiceNote(e.target.value)}
            placeholder="Describe what happened in your own words..."
            style={{
              width: '100%', minHeight: 80, padding: 12, borderRadius: 8,
              border: '1px solid #e2e8f0', fontSize: 13, resize: 'vertical',
              lineHeight: 1.55, fontFamily: 'inherit',
            }}
          />
        </div>
      </div>

      <div style={{ marginTop: 24, display: 'flex', gap: 10 }}>
        <button
          onClick={save}
          disabled={saving}
          style={{
            padding: '12px 24px', borderRadius: 10,
            background: saving ? '#e5e7eb' : 'linear-gradient(135deg, #2E5FA3, #1A2B4A)',
            border: 'none', color: 'white',
            fontSize: 14, fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Saving...' : 'Save & continue'}
        </button>
      </div>

      {error && <p style={{ fontSize: 12, color: '#dc2626', margin: '10px 0 0' }}>{error}</p>}

      <p style={{ fontSize: 11, color: '#aaa', margin: '32px 0 0', lineHeight: 1.55 }}>
        We cannot predict what will happen, but we can help you move through it with the least friction possible.
      </p>
    </div>
  );
}
