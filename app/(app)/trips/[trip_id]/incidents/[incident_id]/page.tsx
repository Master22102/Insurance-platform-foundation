'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/auth/supabase-client';
import EvidenceUpload from '@/components/evidence/EvidenceUpload';

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  OPEN:                  { bg: '#eff4fc', border: '#bfdbfe', text: '#2E5FA3' },
  EVIDENCE_GATHERING:    { bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
  REVIEW_PENDING:        { bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
  CLAIM_ROUTING_READY:   { bg: '#f0fdf4', border: '#bbf7d0', text: '#16a34a' },
  SUBMITTED:             { bg: '#eff4fc', border: '#bfdbfe', text: '#2E5FA3' },
  CLOSED:                { bg: '#f5f5f5', border: '#e0e0e0', text: '#777' },
  DISPUTED:              { bg: '#fef2f2', border: '#fecaca', text: '#dc2626' },
};

const STATUS_NEXT_STEPS: Record<string, string> = {
  OPEN: 'Add your initial description and any evidence you already have.',
  EVIDENCE_GATHERING: 'Upload supporting documents — receipts, confirmation emails, photos.',
  REVIEW_PENDING: 'Your documentation is being reviewed. Add anything you missed.',
  CLAIM_ROUTING_READY: 'Your incident is ready to route to a claim. Use the options below.',
  SUBMITTED: 'Your claim has been submitted. Keep this record for follow-up.',
  CLOSED: 'This incident is closed.',
  DISPUTED: 'This claim is under dispute. Continue documenting.',
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_COLORS[status] || STATUS_COLORS.OPEN;
  const label = status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
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

function NarrationPanel({ incidentId, onAdded }: { incidentId: string; onAdded: (ev: any) => void }) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSave = async () => {
    if (!text.trim()) return;
    setSaving(true);
    setError('');

    const { error: rpcError } = await supabase.rpc('register_evidence', {
      p_incident_id: incidentId,
      p_type: 'narrative_note',
      p_name: 'Narrated note',
      p_description: text.trim(),
      p_actor_id: user!.id,
      p_idempotency_key: `note-${Date.now()}`,
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
    }).catch((err) => { console.error("[fetch] error:", err); setLoading(false); });
  }, [user, incidentId]);

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
    setAdvancing(true);

    const nextStatus = status === 'OPEN' ? 'EVIDENCE_GATHERING'
      : status === 'EVIDENCE_GATHERING' ? 'REVIEW_PENDING'
      : 'CLAIM_ROUTING_READY';

    const { error: rpcErr } = await supabase.rpc('change_incident_status', {
      p_incident_id: incidentId,
      p_new_status: nextStatus,
      p_actor_id: user!.id,
      p_reason: 'user_manual_advance',
    });

    setAdvancing(false);

    if (!rpcErr) {
      setIncident((prev: any) => ({ ...prev, canonical_status: nextStatus }));
      setEvents((prev) => [...prev, { event_type: 'status_changed', created_at: new Date().toISOString() }]);
    }
  };

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: 900 }}>
      <Link href={`/trips/${tripId}`} style={{
        fontSize: 13, color: '#888', textDecoration: 'none',
        display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 20,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M19 12H5M12 19l-7-7 7-7" stroke="#aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Back to trip
      </Link>

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

      <div style={{
        marginTop: 24, paddingTop: 20, borderTop: '1px solid #f0f0f0',
      }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#999', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Actions
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link
            href={`/trips/${tripId}/incidents/${incidentId}/action-ladder`}
            style={{
              padding: '10px 20px',
              background: 'white', color: '#1A2B4A',
              border: '1px solid #dbeafe',
              borderRadius: 8, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', textDecoration: 'none',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            Open action ladder
          </Link>
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

      <style>{`
        @media (max-width: 700px) {
          .incident-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
