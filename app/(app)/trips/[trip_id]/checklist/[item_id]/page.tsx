'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/auth/supabase-client';

const STATUS_STYLE: Record<string, { bg: string; border: string; fg: string; label: string }> = {
  not_started: { bg: '#f7f8fa', border: '#e5e7eb', fg: '#64748b', label: 'Not started' },
  uploaded:    { bg: '#eff6ff', border: '#bfdbfe', fg: '#1e40af', label: 'Uploaded' },
  verified:   { bg: '#f0fdf4', border: '#bbf7d0', fg: '#166534', label: 'Verified' },
  waived:     { bg: '#fef9f0', border: '#fde68a', fg: '#92400e', label: 'Waived' },
};

export default function ChecklistItemDetailPage() {
  const { trip_id, item_id } = useParams<{ trip_id: string; item_id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState('not_started');
  const [marking, setMarking] = useState(false);

  const markComplete = async () => {
    if (!user) return;
    setMarking(true);
    const { error } = await supabase
      .from('readiness_pin_states')
      .upsert({
        trip_id,
        item_key: item_id,
        status: 'uploaded',
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'trip_id,item_key' });
    if (!error) setStatus('uploaded');
    setMarking(false);
  };

  const st = STATUS_STYLE[status] || STATUS_STYLE.not_started;

  return (
    <div style={{ maxWidth: 620, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <Link
        href={`/trips/${trip_id}/checklist`}
        style={{ fontSize: 13, color: '#888', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 16 }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 19l-7-7 7-7" stroke="#aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        Back to checklist
      </Link>

      <div style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '20px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>Requirement detail</h1>
          <span style={{
            fontSize: 10, fontWeight: 700, color: st.fg,
            background: st.bg, border: `1px solid ${st.border}`,
            borderRadius: 20, padding: '3px 10px',
            textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap',
          }}>
            {st.label}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#888', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Item ID
            </p>
            <p style={{ fontSize: 14, color: '#1A2B4A', margin: 0 }}>{item_id}</p>
          </div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#888', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              What to do
            </p>
            <p style={{ fontSize: 13, color: '#555', margin: 0, lineHeight: 1.55 }}>
              Gather the required documentation for this item and upload it here, or navigate to the evidence vault from your incident workspace.
            </p>
          </div>
        </div>

        <div style={{
          padding: '16px 18px', borderRadius: 10,
          background: '#f7f8fa', border: '0.5px solid #e8e8e8',
          marginBottom: 20,
        }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A', margin: '0 0 6px' }}>
            Upload documentation
          </p>
          <p style={{ fontSize: 12, color: '#888', margin: '0 0 12px', lineHeight: 1.55 }}>
            Photos, screenshots, boarding passes, or receipts. Files are stored in your evidence vault.
          </p>
          <Link
            href={`/policies/upload?trip_id=${trip_id}&item_id=${item_id}`}
            style={{
              display: 'inline-block', padding: '8px 16px', borderRadius: 8,
              background: 'white', border: '1px solid #dbeafe',
              color: '#2E5FA3', fontSize: 12, fontWeight: 600, textDecoration: 'none',
            }}
          >
            Open evidence vault
          </Link>
        </div>

        {status === 'not_started' && (
          <button
            onClick={markComplete}
            disabled={marking}
            style={{
              padding: '11px 20px', borderRadius: 8,
              background: marking ? '#e5e7eb' : 'linear-gradient(135deg, #2E5FA3, #1A2B4A)',
              border: 'none', color: 'white',
              fontSize: 13, fontWeight: 600,
              cursor: marking ? 'not-allowed' : 'pointer',
            }}
          >
            {marking ? 'Saving...' : 'Mark complete'}
          </button>
        )}
      </div>

      <p style={{ fontSize: 11, color: '#aaa', margin: '24px 0 0', lineHeight: 1.55 }}>
        This requirement is based on publicly available entry rules. Verify with your embassy or consulate.
      </p>
    </div>
  );
}
