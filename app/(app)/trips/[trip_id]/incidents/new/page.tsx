'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/auth/supabase-client';
import VoiceNarrationPanel from '@/components/voice/VoiceNarrationPanel';
import AppPageRoot from '@/components/layout/AppPageRoot';

function mapVoiceDisruptionToKey(v: unknown): string {
  if (typeof v !== 'string') return '';
  const m: Record<string, string> = {
    delay: 'flight_delay',
    cancellation: 'flight_cancellation',
    missed_connection: 'missed_connection',
    denied_boarding: 'denied_boarding',
    baggage: 'baggage_issue',
    other: 'other',
  };
  return m[v.toLowerCase()] || '';
}

const DISRUPTION_TYPES = [
  {
    key: 'flight_delay',
    label: 'Flight delay',
    subtitle: 'Your flight was delayed',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7"/>
        <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    key: 'flight_cancellation',
    label: 'Flight cancellation',
    subtitle: 'Your flight was cancelled',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill="currentColor" opacity="0.15"/>
        <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    key: 'missed_connection',
    label: 'Missed connection',
    subtitle: 'You missed a connecting flight',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M3 17h4l3-10 4 14 3-8h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    key: 'denied_boarding',
    label: 'Denied boarding',
    subtitle: 'You were bumped from a flight',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M12 9v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        <circle cx="12" cy="17" r="1" fill="currentColor"/>
      </svg>
    ),
  },
  {
    key: 'baggage_issue',
    label: 'Baggage issue',
    subtitle: 'Lost, delayed, or damaged bags',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="6" y="8" width="12" height="13" rx="2" stroke="currentColor" strokeWidth="1.7"/>
        <path d="M9 8V6a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    key: 'other',
    label: 'Other',
    subtitle: 'Something else went wrong',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7"/>
        <path d="M9 9a3 3 0 015.83 1c0 2-3 3-3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
        <circle cx="12" cy="17" r="1" fill="currentColor"/>
      </svg>
    ),
  },
];

const PRE_FILL_TITLES: Record<string, string> = {
  flight_delay: 'Flight delay',
  flight_cancellation: 'Flight cancellation',
  missed_connection: 'Missed connection',
  denied_boarding: 'Denied boarding',
  baggage_issue: 'Baggage issue',
  other: 'Incident',
};

export default function NewIncidentPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const tripId = params?.trip_id as string;

  const [disruption, setDisruption] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceExtraMeta, setVoiceExtraMeta] = useState<Record<string, unknown>>({});

  const handleDisruptionSelect = (key: string) => {
    setDisruption(key);
    if (!title || Object.values(PRE_FILL_TITLES).includes(title)) {
      setTitle(PRE_FILL_TITLES[key] || '');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disruption) { setError('Please select a disruption type.'); return; }
    if (!title.trim()) { setError('Please give this incident a title.'); return; }
    setError('');
    setLoading(true);

    const { data, error: rpcError } = await supabase.rpc('create_incident', {
      p_trip_id: tripId,
      p_title: title.trim(),
      p_description: description.trim() || '',
      p_classification: 'External',
      p_control_type: 'External',
      // create_incident() stores disruption_type via metadata for the incident intake UI.
      p_metadata: { disruption_type: disruption || null, ...voiceExtraMeta },
      p_actor_id: user!.id,
      p_idempotency_key: `incident-${Date.now()}`,
    });

    setLoading(false);

    if (rpcError || !data?.success) {
      setError(data?.error || 'Something went wrong. Please try again.');
      return;
    }

    router.push(`/trips/${tripId}/incidents/${data.incident_id}`);
  };

  return (
    <AppPageRoot>
    <div style={{ maxWidth: 580, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <Link href={`/trips/${tripId}`} style={{
        fontSize: 13, color: '#888', textDecoration: 'none',
        display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 20,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M19 12H5M12 19l-7-7 7-7" stroke="#aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Back to trip
      </Link>

      <div style={{
        background: '#eff4fc', border: '1px solid #dbeafe',
        borderRadius: 10, padding: '12px 16px', marginBottom: 24,
        fontSize: 14, color: '#1e40af', lineHeight: 1.5,
      }}>
        We&apos;ll help you document this clearly and understand your options.
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A2B4A', margin: '0 0 12px', letterSpacing: '-0.3px' }}>
        What happened?
      </h1>
      <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 16px', lineHeight: 1.5 }}>
        Describe in your own words, or use voice — we&apos;ll show a draft you can edit before you continue.
      </p>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => user && setVoiceOpen(true)}
          disabled={!user}
          style={{
            padding: '10px 16px',
            borderRadius: 10,
            border: '1px solid #fecaca',
            background: '#fff1f2',
            color: '#9f1239',
            fontSize: 13,
            fontWeight: 600,
            cursor: user ? 'pointer' : 'not-allowed',
          }}
        >
          Narrate what happened
        </button>
        <span style={{ fontSize: 12, color: '#94a3b8', alignSelf: 'center' }}>or fill the form below</span>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 500, color: '#444', margin: '0 0 12px' }}>
            Select a disruption type
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
            {DISRUPTION_TYPES.map((d) => {
              const active = disruption === d.key;
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => handleDisruptionSelect(d.key)}
                  style={{
                    padding: '14px 14px', textAlign: 'left',
                    background: active ? '#eff4fc' : 'white',
                    border: `1px solid ${active ? '#2E5FA3' : '#e8e8e8'}`,
                    borderRadius: 10, cursor: 'pointer',
                    color: active ? '#2E5FA3' : '#555',
                    minHeight: 44,
                  }}
                >
                  <div style={{ marginBottom: 6 }}>{d.icon}</div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: active ? '#2E5FA3' : '#1A2B4A', margin: '0 0 2px' }}>
                    {d.label}
                  </p>
                  <p style={{ fontSize: 11, color: '#999', margin: 0, lineHeight: 1.4 }}>{d.subtitle}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#444', marginBottom: 6 }}>
            Incident title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Flight delay on Portugal trip"
            required
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '10px 12px', fontSize: 14,
              border: '1px solid #ddd', borderRadius: 8,
              outline: 'none', color: '#111', background: 'white',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#444', marginBottom: 6 }}>
            What happened? <span style={{ color: '#aaa', fontWeight: 400 }}>(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Tell us what happened — dates, times, airlines, what the carrier said. You can add more detail later."
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '10px 12px', fontSize: 14,
              border: '1px solid #ddd', borderRadius: 8,
              outline: 'none', color: '#111', background: 'white',
              resize: 'vertical', lineHeight: 1.6,
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          />
        </div>

        {error && (
          <div style={{
            padding: '10px 14px', background: '#fef9f0',
            border: '1px solid #fde68a', borderRadius: 8,
            fontSize: 13, color: '#92400e', lineHeight: 1.5,
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%', padding: '11px 0',
            background: loading ? '#93afd4' : '#1A2B4A',
            color: 'white', border: 'none', borderRadius: 8,
            fontSize: 14, fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Creating…' : 'Start documenting'}
        </button>
      </form>
    </div>

      {voiceOpen && user && (
        <>
          <div
            role="presentation"
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 70 }}
            onClick={() => setVoiceOpen(false)}
            onKeyDown={() => {}}
          />
          <VoiceNarrationPanel
            context="incident_create"
            accountId={user.id}
            tripId={tripId}
            onCancel={() => setVoiceOpen(false)}
            onFieldsConfirmed={(fields) => {
              const t = typeof fields.title === 'string' ? fields.title.trim() : '';
              const d = typeof fields.description === 'string' ? fields.description.trim() : '';
              if (t) setTitle(t);
              if (d) setDescription(d);
              const dt = mapVoiceDisruptionToKey(fields.disruption_type);
              if (dt) {
                setDisruption(dt);
                handleDisruptionSelect(dt);
              }
              const exp = fields.estimated_expenses;
              if (typeof exp === 'number' && Number.isFinite(exp)) {
                setVoiceExtraMeta({ estimated_expenses: exp });
              } else {
                setVoiceExtraMeta({});
              }
              setVoiceOpen(false);
            }}
          />
        </>
      )}
    </AppPageRoot>
  );
}
