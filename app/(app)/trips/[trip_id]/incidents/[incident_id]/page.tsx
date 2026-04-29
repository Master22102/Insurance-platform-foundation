'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/auth/supabase-client';
import EvidenceUpload from '@/components/evidence/EvidenceUpload';
import VoiceNarrationPanel from '@/components/voice/VoiceNarrationPanel';
import ResolutionTracker from '@/components/disruption/ResolutionTracker';
import DisruptionOptionsPanel from '@/components/disruption/DisruptionOptionsPanel';
import AppPageRoot from '@/components/layout/AppPageRoot';

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  OPEN:                  { bg: '#eff4fc', border: '#bfdbfe', text: '#2E5FA3' },
  EVIDENCE_GATHERING:    { bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
  REVIEW_PENDING:        { bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
  CLAIM_ROUTING_READY:   { bg: '#f0fdf4', border: '#bbf7d0', text: '#16a34a' },
  SUBMITTED:             { bg: '#eff4fc', border: '#bfdbfe', text: '#2E5FA3' },
  CLOSED:                { bg: '#f5f5f5', border: '#e0e0e0', text: '#777' },
  DISPUTED:              { bg: '#fef2f2', border: '#fecaca', text: '#dc2626' },
};

const CARRIER_ACTION_TYPES: Array<{ value: string; label: string }> = [
  { value: 'rebooking_offered', label: 'Rebooking offered' },
  { value: 'rebooking_completed', label: 'Rebooking completed' },
  { value: 'rebooking_declined_by_carrier', label: 'Alternative travel not offered by carrier' },
  { value: 'rebooking_declined_by_traveler', label: 'Traveler declined offered alternative' },
  { value: 'voucher_issued', label: 'Voucher issued' },
  { value: 'meal_voucher_issued', label: 'Meal voucher issued' },
  { value: 'hotel_accommodation_offered', label: 'Hotel accommodation offered' },
  { value: 'hotel_accommodation_denied', label: 'Hotel accommodation not offered' },
  { value: 'cash_compensation_offered', label: 'Cash compensation offered' },
  { value: 'refund_offered', label: 'Refund offered' },
  { value: 'denied_boarding_compensation', label: 'Denied boarding — compensation discussed' },
  { value: 'baggage_claim_filed', label: 'Baggage claim filed' },
  { value: 'baggage_delivery_arranged', label: 'Baggage delivery arranged' },
  { value: 'no_response', label: 'No response yet from carrier' },
  { value: 'other', label: 'Other (describe in notes)' },
];

function defaultLabelForAction(actionType: string): string {
  return CARRIER_ACTION_TYPES.find((x) => x.value === actionType)?.label || 'Carrier action';
}

const STATUS_NEXT_STEPS: Record<string, string> = {
  OPEN: 'Add your initial description and any evidence you already have.',
  EVIDENCE_GATHERING: 'Upload supporting documents — receipts, confirmation emails, photos.',
  REVIEW_PENDING: 'Your documentation is being reviewed. Add anything you missed.',
  CLAIM_ROUTING_READY: 'Your incident record is ready for the next filing step. Use the options below.',
  SUBMITTED: 'Your claim routing details were saved. Follow up with the provider directly.',
  CLOSED: 'This incident is closed.',
  DISPUTED: 'This claim is under dispute. Continue documenting.',
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_COLORS[status] || STATUS_COLORS.OPEN;
  const label =
    status === 'CLAIM_ROUTING_READY'
      ? 'Routing ready'
      : status === 'SUBMITTED'
        ? 'Routing recorded'
        : status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span style={{
      fontSize: 12, fontWeight: 600, color: cfg.text,
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      borderRadius: 20, padding: '4px 11px',
    }}>
      {label}
    </span>
  );
}

function buildNoteFromVoiceFields(
  fields: Record<string, unknown>,
  fallbackTranscript: string,
): string {
  const parts: string[] = [];
  const add = typeof fields.additional_details === 'string' ? fields.additional_details.trim() : '';
  if (add) parts.push(add);
  const evs = fields.timeline_events;
  if (Array.isArray(evs)) {
    for (const ev of evs) {
      if (ev && typeof ev === 'object') {
        const o = ev as Record<string, unknown>;
        const t = typeof o.time === 'string' ? o.time : '';
        const d = typeof o.description === 'string' ? o.description : '';
        if (t || d) parts.push(`• ${t} ${d}`.trim());
      }
    }
  }
  const res = typeof fields.resolution_info === 'string' ? fields.resolution_info.trim() : '';
  if (res) parts.push(res);
  const ne = fields.new_expenses;
  if (typeof ne === 'number' && Number.isFinite(ne)) parts.push(`Expenses mentioned: $${ne}`);
  const joined = parts.join('\n\n').trim();
  return joined || fallbackTranscript.trim();
}

function NarrationPanel({
  incidentId,
  tripId,
  accountId,
  onAdded,
}: {
  incidentId: string;
  tripId: string;
  accountId: string;
  onAdded: (ev: any) => void;
}) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSave = async () => {
    if (!text.trim()) return;
    setSaving(true);
    setError('');

    const { error: rpcError } = await supabase.rpc('register_evidence', {
      p_incident_id: incidentId,
      p_type: 'other',
      p_name: 'Narrated note',
      p_description: text.trim(),
      p_metadata: { category: 'narrative_note' },
      p_actor_id: user!.id,
      p_idempotency_key: `note-type-${incidentId}-${Date.now()}`,
    });

    setSaving(false);

    if (rpcError) {
      setError('Could not save note. Please try again.');
      return;
    }

    onAdded({ name: 'Narrated note', category: 'narrative_note', created_at: new Date().toISOString() });
    setText('');
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <div style={{
      background: '#f7f9fc', border: '1px solid #dbeafe',
      borderRadius: 12, padding: '16px 18px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <p style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A', margin: '0 0 10px' }}>
        Add more detail
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setVoiceOpen(true)}
          style={{
            padding: '7px 12px',
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 8,
            border: '1px solid #fecaca',
            background: '#fff1f2',
            color: '#9f1239',
            cursor: 'pointer',
          }}
        >
          Narrate update
        </button>
        <span style={{ fontSize: 11, color: '#94a3b8', alignSelf: 'center' }}>or type below</span>
      </div>
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder="Describe what happened — what the carrier said, what you were told, any reference numbers, times, or other details. This will be stored with your incident record."
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: '10px 12px', fontSize: 13,
          border: '1px solid #ddd', borderRadius: 8,
          outline: 'none', color: '#111', background: 'white',
          resize: 'vertical', lineHeight: 1.6,
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      />
      {error && (
        <p style={{ fontSize: 12, color: '#dc2626', margin: '8px 0 0' }}>{error}</p>
      )}
      {success && (
        <p style={{ fontSize: 12, color: '#16a34a', margin: '8px 0 0' }}>Note saved successfully.</p>
      )}
      <button
        onClick={handleSave}
        disabled={saving || !text.trim()}
        style={{
          marginTop: 10, padding: '8px 18px',
          background: (saving || !text.trim()) ? '#93afd4' : '#1A2B4A',
          color: 'white', border: 'none', borderRadius: 7,
          fontSize: 13, fontWeight: 600,
          cursor: (saving || !text.trim()) ? 'not-allowed' : 'pointer',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {saving ? 'Saving…' : 'Save note'}
      </button>

      {voiceOpen && (
        <>
          <div
            role="presentation"
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 70 }}
            onClick={() => setVoiceOpen(false)}
          />
          <VoiceNarrationPanel
            context="incident_update"
            accountId={accountId}
            tripId={tripId}
            incidentId={incidentId}
            onCancel={() => setVoiceOpen(false)}
            onFieldsConfirmed={async (fields, meta) => {
              const body = buildNoteFromVoiceFields(fields, meta.transcriptRaw);
              if (!body.trim()) {
                setVoiceOpen(false);
                return;
              }
              setSaving(true);
              setError('');
              const { error: rpcError } = await supabase.rpc('register_evidence', {
                p_incident_id: incidentId,
                p_type: 'other',
                p_name: 'Narrated note',
                p_description: body.trim(),
                p_metadata: {
                  category: 'narrative_note',
                  transcript_raw: meta.transcriptRaw,
                  voice_parse: meta.parseAttempt,
                },
                p_actor_id: user!.id,
                p_idempotency_key: `note-voice-${incidentId}-${Date.now()}`,
              });
              setSaving(false);
              setVoiceOpen(false);
              if (rpcError) {
                setError('Could not save note. Please try again.');
                return;
              }
              onAdded({ name: 'Narrated note', category: 'narrative_note', created_at: new Date().toISOString() });
              setSuccess(true);
              setTimeout(() => setSuccess(false), 3000);
            }}
          />
        </>
      )}
    </div>
  );
}

export default function IncidentDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const tripId = params?.trip_id as string;
  const incidentId = params?.incident_id as string;

  const [incident, setIncident] = useState<any>(null);
  const [evidence, setEvidence] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [showNarration, setShowNarration] = useState(false);
  const [showOptionsSheet, setShowOptionsSheet] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [advanceError, setAdvanceError] = useState('');
  const [carrierResponses, setCarrierResponses] = useState<any[]>([]);
  const [showCarrierForm, setShowCarrierForm] = useState(false);
  const [carrierSaving, setCarrierSaving] = useState(false);
  const [carrierError, setCarrierError] = useState('');
  const [carrierForm, setCarrierForm] = useState({
    action_type: 'no_response',
    action_label: '',
    value_amount: '',
    carrier_ref: '',
    new_flight: '',
    new_departure: '',
    notes: '',
  });
  const [carrierVoiceOpen, setCarrierVoiceOpen] = useState(false);

  useEffect(() => {
    if (!user || !incidentId) return;

    Promise.all([
      supabase.from('incidents').select('*').eq('id', incidentId).maybeSingle(),
      supabase.from('evidence').select('*').eq('incident_id', incidentId).order('created_at', { ascending: false }),
      supabase.from('event_ledger').select('*').eq('scope_id', incidentId).order('created_at', { ascending: true }).limit(30),
    ]).then(([incRes, evRes, ledgerRes]) => {
      if (!incRes.data) { router.replace(`/trips/${tripId}`); return; }
      setIncident(incRes.data);
      setEvidence(evRes.data || []);
      setEvents(ledgerRes.data || []);
      setLoading(false);
      supabase
        .from('carrier_responses')
        .select('*')
        .eq('incident_id', incidentId)
        .order('created_at', { ascending: true })
        .then(({ data, error }) => {
          if (!error) setCarrierResponses(data || []);
        });
    }).catch((err) => { console.error("[fetch] error:", err); setLoading(false); });
  }, [user, incidentId, tripId, router]);

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

  const status = incident.canonical_status || 'OPEN';
  const nextStep = STATUS_NEXT_STEPS[status];
  const canRoute = status === 'CLAIM_ROUTING_READY';
  const canAdvance = ['OPEN', 'EVIDENCE_GATHERING', 'REVIEW_PENDING'].includes(status) && evidence.length > 0;

  const handleAdvanceStatus = async () => {
    if (!canAdvance || advancing) return;
    setAdvanceError('');
    setAdvancing(true);

    const nextStatus = status === 'OPEN' ? 'EVIDENCE_GATHERING'
      : status === 'EVIDENCE_GATHERING' ? 'REVIEW_PENDING'
      : 'CLAIM_ROUTING_READY';

    const { data: rpcData, error: rpcErr } = await supabase.rpc('change_incident_status', {
      p_incident_id: incidentId,
      p_new_status: nextStatus,
      p_actor_id: user!.id,
      p_reason_code: 'user_manual_advance',
    });

    setAdvancing(false);

    if (!rpcErr && rpcData?.success) {
      setIncident((prev: any) => ({ ...prev, canonical_status: nextStatus }));
      setEvents((prev) => [...prev, { event_type: 'status_changed', created_at: new Date().toISOString() }]);
      return;
    }
    setAdvanceError(String(rpcData?.error || rpcErr?.message || 'We could not advance this incident right now.'));
  };

  const saveCarrierResponse = async () => {
    if (!user) return;
    setCarrierError('');
    const label = (carrierForm.action_label || '').trim() || defaultLabelForAction(carrierForm.action_type);
    const amt = carrierForm.value_amount.trim() ? Number(carrierForm.value_amount) : null;
    if (carrierForm.value_amount.trim() && (amt == null || Number.isNaN(amt))) {
      setCarrierError('Enter a valid amount or leave it blank.');
      return;
    }
    setCarrierSaving(true);
    const { data, error } = await supabase.rpc('add_carrier_response', {
      p_incident_id: incidentId,
      p_action_type: carrierForm.action_type,
      p_action_label: label,
      p_value_amount: amt,
      p_currency_code: 'USD',
      p_carrier_name: null,
      p_carrier_ref: carrierForm.carrier_ref.trim() || null,
      p_new_flight: ['rebooking_offered', 'rebooking_completed'].includes(carrierForm.action_type)
        ? (carrierForm.new_flight.trim() || null)
        : null,
      p_new_departure: carrierForm.new_departure
        ? new Date(carrierForm.new_departure).toISOString()
        : null,
      p_notes: carrierForm.notes.trim() || null,
      p_action_occurred_at: null,
      p_evidence_id: null,
      p_actor_id: user.id,
    });
    setCarrierSaving(false);
    if (error || !(data as { ok?: boolean })?.ok) {
      setCarrierError('Could not save this carrier action. If this is new, apply the latest database migration and try again.');
      return;
    }
    const { data: rows } = await supabase
      .from('carrier_responses')
      .select('*')
      .eq('incident_id', incidentId)
      .order('created_at', { ascending: true });
    setCarrierResponses(rows || []);
    setShowCarrierForm(false);
    setCarrierForm({
      action_type: 'no_response',
      action_label: '',
      value_amount: '',
      carrier_ref: '',
      new_flight: '',
      new_departure: '',
      notes: '',
    });
  };

  return (
    <AppPageRoot style={{ fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: 900 }}>
      <Link href={`/trips/${tripId}`} style={{
        fontSize: 13, color: '#888', textDecoration: 'none',
        display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 20,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M19 12H5M12 19l-7-7 7-7" stroke="#aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Back to trip
      </Link>

      {!canRoute && status !== 'CLOSED' && status !== 'SUBMITTED' && status !== 'DISPUTED' ? (
        <div
          style={{
            marginBottom: 16,
            padding: '14px 16px',
            background: evidence.length === 0 ? '#fffbeb' : '#eff6ff',
            border: `1px solid ${evidence.length === 0 ? '#fde68a' : '#bfdbfe'}`,
            borderRadius: 12,
            fontSize: 13,
            color: '#334155',
            lineHeight: 1.55,
          }}
        >
          <strong style={{ color: '#1A2B4A', display: 'block', marginBottom: 6 }}>
            {evidence.length === 0 ? 'Evidence needed before claim routing' : 'Ready to move toward routing?'}
          </strong>
          {evidence.length === 0
            ? 'Upload a document or add a narrated note in the sections below. At least one evidence item is required before you can advance this incident toward structured claim routing.'
            : canAdvance
              ? 'You have evidence on file. Scroll to Actions and tap “Mark as ready to review” when you want to advance status toward routing.'
              : 'Keep building your record with carrier actions and documentation, then use Actions when routing becomes available.'}
        </div>
      ) : null}

      <ResolutionTracker
        tripId={tripId}
        incidentId={incidentId}
        disruptionType={incident.disruption_type}
        incidentCreatedAt={incident.created_at}
        evidence={evidence}
        carrierResponses={carrierResponses}
        onOpenEvidenceUpload={() => { setShowUpload(true); setShowNarration(false); }}
        onOpenCarrierForm={() => { setShowCarrierForm(true); setCarrierError(''); }}
        onOpenClaimRouting={() => router.push(`/trips/${tripId}/incidents/${incidentId}/route`)}
        onOpenCoverageTab={() => router.push(`/trips/${tripId}?tab=Coverage`)}
      />

      <DisruptionOptionsPanel
        tripId={tripId}
        disruptionType={incident.disruption_type}
      />

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A2B4A', margin: 0, letterSpacing: '-0.3px', flex: 1, minWidth: 0 }}>
            {incident.title}
          </h1>
          <StatusBadge status={status} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {incident.disruption_type && (
            <span style={{
              display: 'inline-block', fontSize: 11, fontWeight: 500, color: '#888',
              background: '#f5f5f5', border: '1px solid #e8e8e8',
              borderRadius: 20, padding: '3px 9px',
            }}>
              {incident.disruption_type.replace(/_/g, ' ')}
            </span>
          )}
          <span style={{ fontSize: 11, color: '#bbb' }}>
            {new Date(incident.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
      </div>

      {nextStep && (
        <div style={{
          padding: '12px 16px', background: '#f7f9fc',
          border: '1px solid #e0e8f4', borderRadius: 10, marginBottom: 20,
          fontSize: 13, color: '#444', lineHeight: 1.5,
        }}>
          <strong style={{ color: '#1A2B4A' }}>Next step: </strong>{nextStep}
        </div>
      )}

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20,
      }}
        className="incident-grid"
      >
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#999', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Timeline
          </p>
          <div style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '16px 18px', marginBottom: 12 }}>
            {events.length === 0 ? (
              <p style={{ fontSize: 13, color: '#aaa', margin: 0, lineHeight: 1.6 }}>
                Your incident timeline will build as you add documentation.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {events.map((ev, i) => (
                  <div key={ev.id || i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: '#2E5FA3', flexShrink: 0, marginTop: 4,
                    }} />
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 500, color: '#1A2B4A', margin: '0 0 2px' }}>
                        {ev.event_type?.replace(/_/g, ' ') || 'Event'}
                      </p>
                      <p style={{ fontSize: 11, color: '#aaa', margin: 0 }}>
                        {new Date(ev.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => { setShowNarration(!showNarration); setShowUpload(false); }}
              style={{
                flex: 1, padding: '9px 0',
                background: showNarration ? '#1A2B4A' : 'white',
                color: showNarration ? 'white' : '#1A2B4A',
                border: '1px solid #dbeafe', borderRadius: 8,
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            >
              {showNarration ? 'Close narration' : '+ Add narration'}
            </button>
          </div>

          {showNarration && (
            <div style={{ marginTop: 12 }}>
              <NarrationPanel
                incidentId={incidentId}
                tripId={tripId}
                accountId={user!.id}
                onAdded={(ev) => {
                  setEvidence((prev) => [{ ...ev }, ...prev]);
                  setEvents((prev) => [...prev, { event_type: 'narrative_note_added', created_at: new Date().toISOString() }]);
                }}
              />
            </div>
          )}
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#999', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Evidence
            </p>
            <button
              onClick={() => { setShowUpload(!showUpload); setShowNarration(false); }}
              style={{
                fontSize: 12, fontWeight: 600, color: '#2E5FA3',
                background: '#eff4fc', border: '1px solid #bfdbfe',
                borderRadius: 8, padding: '5px 12px', cursor: 'pointer',
              }}
            >
              {showUpload ? 'Cancel' : 'Add evidence'}
            </button>
          </div>

          {showUpload && (
            <div style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '16px 18px', marginBottom: 12 }}>
              <EvidenceUpload
                incidentId={incidentId}
                tripId={tripId}
                accountId={user!.id}
                onUploaded={(ev) => {
                  setEvidence((prev) => [{ ...ev, created_at: new Date().toISOString() }, ...prev]);
                  setShowUpload(false);
                }}
              />
            </div>
          )}

          <div style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '16px 18px' }}>
            {evidence.length === 0 ? (
              <p style={{ fontSize: 13, color: '#aaa', margin: 0, lineHeight: 1.6 }}>
                No evidence attached yet. Add narration or upload documents above.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {evidence.map((ev, i) => (
                  <div key={ev.id || i} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 12px', background: '#f9f9f9',
                    border: '1px solid #f0f0f0', borderRadius: 8,
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                      <rect x="3" y="3" width="18" height="18" rx="2" stroke="#888" strokeWidth="1.5"/>
                      <path d="M8 12h8M8 8h5" stroke="#888" strokeWidth="1.3" strokeLinecap="round"/>
                    </svg>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 500, color: '#333', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ev.name || ev.p_name || 'Document'}
                      </p>
                    </div>
                    {ev.category && (
                      <span style={{
                        fontSize: 10, fontWeight: 600, color: '#2E5FA3',
                        background: '#eff4fc', border: '1px solid #bfdbfe',
                        borderRadius: 20, padding: '2px 7px', whiteSpace: 'nowrap',
                      }}>
                        {ev.category.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#999', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Carrier responses
          </p>
          <button
            type="button"
            onClick={() => { setShowCarrierForm((s) => !s); setCarrierError(''); }}
            style={{
              fontSize: 12, fontWeight: 600, color: '#2E5FA3',
              background: '#eff4fc', border: '1px solid #bfdbfe',
              borderRadius: 8, padding: '5px 12px', cursor: 'pointer',
            }}
          >
            {showCarrierForm ? 'Close' : 'Add carrier action'}
          </button>
        </div>
        <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px', lineHeight: 1.55, maxWidth: 720 }}>
          Record what the airline or carrier communicated (offers, vouchers, or no reply). This stays factual and helps
          with your filing packet.
        </p>

        {showCarrierForm && (
          <div style={{
            background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12,
            padding: '14px 16px', marginBottom: 14,
          }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              <button
                type="button"
                onClick={() => setCarrierVoiceOpen(true)}
                style={{
                  padding: '8px 14px',
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 8,
                  border: '1px solid #fecaca',
                  background: '#fff1f2',
                  color: '#9f1239',
                  cursor: 'pointer',
                }}
              >
                Tell me what happened (voice)
              </button>
              <span style={{ fontSize: 11, color: '#94a3b8', alignSelf: 'center' }}>or choose fields below</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>Action type</label>
              <select
                value={carrierForm.action_type}
                onChange={(e) => {
                  const v = e.target.value;
                  setCarrierForm((f) => ({
                    ...f,
                    action_type: v,
                    action_label: f.action_label || defaultLabelForAction(v),
                  }));
                }}
                style={{ padding: 8, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
              >
                {CARRIER_ACTION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>Short label (editable)</label>
              <input
                value={carrierForm.action_label}
                onChange={(e) => setCarrierForm((f) => ({ ...f, action_label: e.target.value }))}
                placeholder={defaultLabelForAction(carrierForm.action_type)}
                style={{ padding: 8, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
              />
              {['rebooking_offered', 'rebooking_completed'].includes(carrierForm.action_type) && (
                <>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>New flight (optional)</label>
                  <input
                    value={carrierForm.new_flight}
                    onChange={(e) => setCarrierForm((f) => ({ ...f, new_flight: e.target.value }))}
                    placeholder="e.g. AC782"
                    style={{ padding: 8, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                  />
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>New departure (optional)</label>
                  <input
                    type="datetime-local"
                    value={carrierForm.new_departure}
                    onChange={(e) => setCarrierForm((f) => ({ ...f, new_departure: e.target.value }))}
                    style={{ padding: 8, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                  />
                </>
              )}
              <label style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>Value (optional)</label>
              <input
                value={carrierForm.value_amount}
                onChange={(e) => setCarrierForm((f) => ({ ...f, value_amount: e.target.value }))}
                placeholder="USD amount"
                style={{ padding: 8, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
              />
              <label style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>Carrier reference (optional)</label>
              <input
                value={carrierForm.carrier_ref}
                onChange={(e) => setCarrierForm((f) => ({ ...f, carrier_ref: e.target.value }))}
                placeholder="PNR / file reference"
                style={{ padding: 8, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
              />
              <label style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>Notes (optional)</label>
              <textarea
                value={carrierForm.notes}
                onChange={(e) => setCarrierForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
                style={{ padding: 8, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, resize: 'vertical' }}
              />
              {carrierError ? <p style={{ fontSize: 12, color: '#b91c1c', margin: 0 }}>{carrierError}</p> : null}
              <button
                type="button"
                disabled={carrierSaving}
                onClick={saveCarrierResponse}
                style={{
                  alignSelf: 'flex-start',
                  padding: '9px 18px',
                  background: carrierSaving ? '#93afd4' : '#1A2B4A',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: carrierSaving ? 'not-allowed' : 'pointer',
                }}
              >
                {carrierSaving ? 'Saving…' : 'Save carrier action'}
              </button>
            </div>
          </div>
        )}

        <div style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '14px 16px' }}>
          {carrierResponses.length === 0 ? (
            <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>No carrier actions recorded yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {carrierResponses.map((cr: any) => (
                <div
                  key={cr.response_id}
                  style={{
                    padding: '10px 12px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 10,
                  }}
                >
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1A2B4A' }}>{cr.action_label}</p>
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: '#64748b' }}>
                    {cr.action_type?.replace(/_/g, ' ')}
                    {cr.value_amount != null ? ` · ${cr.currency_code || 'USD'} ${cr.value_amount}` : ''}
                    {cr.carrier_ref ? ` · Ref ${cr.carrier_ref}` : ''}
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: '#94a3b8' }}>
                    {cr.created_at ? new Date(cr.created_at).toLocaleString() : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{
        marginTop: 24, paddingTop: 20, borderTop: '1px solid #f0f0f0',
      }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#999', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Actions
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowOptionsSheet(true)}
            style={{
              padding: '10px 20px',
              background: 'white', color: '#1A2B4A',
              border: '1px solid #dbeafe',
              borderRadius: 8, fontSize: 13, fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            Explore your options
          </button>
          {canRoute ? (
            <button
              onClick={() => router.push(`/trips/${tripId}/incidents/${incidentId}/route`)}
              style={{
                padding: '10px 20px',
                background: '#1A2B4A', color: 'white',
                border: '1px solid #1A2B4A',
                borderRadius: 8, fontSize: 13, fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            >
              Route this claim
            </button>
          ) : canAdvance ? (
            <button
              onClick={handleAdvanceStatus}
              disabled={advancing}
              style={{
                padding: '10px 20px',
                background: advancing ? '#93afd4' : '#1A2B4A',
                color: 'white',
                border: 'none',
                borderRadius: 8, fontSize: 13, fontWeight: 600,
                cursor: advancing ? 'not-allowed' : 'pointer',
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            >
              {advancing ? 'Advancing…' : 'Mark as ready to review'}
            </button>
          ) : null}
        </div>
        {advanceError && (
          <p style={{ fontSize: 12, color: '#dc2626', margin: '10px 0 0', lineHeight: 1.5 }}>
            {advanceError}
          </p>
        )}
        {!canRoute && !canAdvance && status !== 'CLOSED' && status !== 'SUBMITTED' && (
          <p style={{ fontSize: 12, color: '#aaa', margin: '10px 0 0', lineHeight: 1.5 }}>
            Add evidence or a narration above to advance this incident toward claim routing.
          </p>
        )}
      </div>

      {showOptionsSheet && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          <div
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }}
            onClick={() => setShowOptionsSheet(false)}
          />
          <div style={{
            position: 'relative', background: 'white',
            borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 520,
            padding: '28px 24px 40px', zIndex: 1,
            animation: 'slideUp 0.25s cubic-bezier(0.32, 0.72, 0, 1)',
            maxHeight: '80vh', overflowY: 'auto',
          }}>
            <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <p style={{ fontSize: 18, fontWeight: 700, color: '#1A2B4A', margin: '0 0 2px' }}>Your options</p>
                <p style={{ fontSize: 13, color: '#888', margin: 0 }}>What you can do from here</p>
              </div>
              <button onClick={() => setShowOptionsSheet(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#aaa' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {[
              {
                title: 'File directly with your airline',
                desc: 'For flight delays, cancellations, and denied boarding, you can submit a claim directly on the carrier\'s website. Have your booking reference and flight details ready.',
                icon: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" stroke="#2E5FA3" strokeWidth="1.5"/>
                  </svg>
                ),
              },
              {
                title: 'File with your travel insurer',
                desc: 'If you have travel insurance, contact your provider directly. Most require you to file within 30–90 days of the incident. Gather receipts, booking confirmations, and airline notifications.',
                icon: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L4 6v6c0 5 3.6 9.7 8 11 4.4-1.3 8-6 8-11V6L12 2z" stroke="#16a34a" strokeWidth="1.5" fill="none"/>
                  </svg>
                ),
              },
              {
                title: 'Use your credit card benefits',
                desc: 'Many cards offer trip delay, cancellation, and baggage coverage. Call the number on the back of your card or check your card\'s benefit guide to initiate a claim.',
                icon: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <rect x="2" y="5" width="20" height="14" rx="2" stroke="#92400e" strokeWidth="1.5"/>
                    <path d="M2 10h20" stroke="#92400e" strokeWidth="1.5"/>
                  </svg>
                ),
              },
              {
                title: 'File an EU261 complaint (if applicable)',
                desc: 'If your flight departed from or arrived in the EU on an EU carrier, you may be entitled to compensation of €250–€600 under EU Regulation 261/2004.',
                icon: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="#0369a1" strokeWidth="1.5"/>
                    <path d="M12 16v-4M12 8h.01" stroke="#0369a1" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                ),
              },
            ].map((opt, i) => (
              <div key={i} style={{
                display: 'flex', gap: 14, padding: '14px 0',
                borderBottom: i < 3 ? '1px solid #f5f5f5' : 'none',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                  background: '#f7f8fa', border: '1px solid #f0f0f0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {opt.icon}
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#1A2B4A', margin: '0 0 4px' }}>{opt.title}</p>
                  <p style={{ fontSize: 12, color: '#666', margin: 0, lineHeight: 1.6 }}>{opt.desc}</p>
                </div>
              </div>
            ))}

            <p style={{ fontSize: 11, color: '#bbb', margin: '16px 0 0', lineHeight: 1.5 }}>
              This is general guidance. Specific entitlements depend on your policy terms and the applicable jurisdiction.
            </p>
          </div>
        </div>
      )}

      {carrierVoiceOpen && user && showCarrierForm && (
        <>
          <div
            role="presentation"
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 85 }}
            onClick={() => setCarrierVoiceOpen(false)}
          />
          <VoiceNarrationPanel
            context="carrier_response"
            accountId={user.id}
            tripId={tripId}
            incidentId={incidentId}
            onCancel={() => setCarrierVoiceOpen(false)}
            onFieldsConfirmed={(fields) => {
              const at = typeof fields.action_type === 'string' ? fields.action_type : '';
              const valid = CARRIER_ACTION_TYPES.some((x) => x.value === at);
              setCarrierForm((f) => ({
                ...f,
                action_type: valid ? at : f.action_type,
                action_label:
                  typeof fields.action_label === 'string' && fields.action_label.trim()
                    ? fields.action_label.trim()
                    : valid
                      ? defaultLabelForAction(at)
                      : f.action_label,
                value_amount:
                  typeof fields.value_amount === 'number' && Number.isFinite(fields.value_amount)
                    ? String(fields.value_amount)
                    : f.value_amount,
                new_flight: typeof fields.new_flight === 'string' ? fields.new_flight : f.new_flight,
                new_departure: typeof fields.new_departure === 'string' ? fields.new_departure : f.new_departure,
                notes: typeof fields.notes === 'string' ? fields.notes : f.notes,
              }));
              setCarrierVoiceOpen(false);
            }}
          />
        </>
      )}

      <style>{`
        @media (max-width: 700px) {
          .incident-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </AppPageRoot>
  );
}
