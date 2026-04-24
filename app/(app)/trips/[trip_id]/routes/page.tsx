'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/auth/supabase-client';

interface Segment {
  segment_id: string;
  segment_type: string;
  origin: string;
  destination: string;
  carrier: string | null;
  depart_at: string | null;
  arrive_at: string | null;
  sort_order: number;
  notes: string | null;
}

const TYPE_ICONS: Record<string, string> = {
  flight: 'F', train: 'T', bus: 'B', ferry: 'S', drive: 'D',
};
const TYPE_LABELS: Record<string, string> = {
  flight: 'Flight', train: 'Train', bus: 'Bus', ferry: 'Ferry', drive: 'Drive',
};

const EMPTY_FORM = { origin: '', destination: '', segment_type: 'flight', carrier: '', depart_at: '', arrive_at: '' };

export default function RouteSegmentsPage() {
  const { trip_id } = useParams<{ trip_id: string }>();
  const { user } = useAuth();
  const [trip, setTrip] = useState<any>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user || !trip_id) return;
    const [tripRes, segRes] = await Promise.all([
      supabase.from('trips').select('*').eq('trip_id', trip_id).maybeSingle(),
      supabase.from('route_segments').select('*').eq('trip_id', trip_id).order('sort_order'),
    ]);
    setTrip(tripRes.data);
    setSegments((segRes.data || []) as Segment[]);
    setLoading(false);
  }, [user, trip_id]);

  useEffect(() => { load(); }, [load]);

  const addSegment = async () => {
    if (!user || !form.origin.trim() || !form.destination.trim()) return;
    setSaving(true);
    setError('');
    const nextOrder = segments.length > 0 ? Math.max(...segments.map((s) => s.sort_order)) + 1 : 1;
    const { error: insertErr } = await supabase.from('route_segments').insert({
      trip_id,
      account_id: user.id,
      segment_type: form.segment_type,
      origin: form.origin.trim(),
      destination: form.destination.trim(),
      carrier: form.carrier.trim() || null,
      depart_at: form.depart_at || null,
      arrive_at: form.arrive_at || null,
      sort_order: nextOrder,
      created_by: user.id,
    });
    if (insertErr) {
      setError(insertErr.message);
      setSaving(false);
      return;
    }
    setForm(EMPTY_FORM);
    setShowForm(false);
    setSaving(false);
    await load();
  };

  const moveSegment = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= segments.length) return;
    const a = segments[idx];
    const b = segments[target];
    await Promise.all([
      supabase.from('route_segments').update({ sort_order: b.sort_order }).eq('segment_id', a.segment_id),
      supabase.from('route_segments').update({ sort_order: a.sort_order }).eq('segment_id', b.segment_id),
    ]);
    await load();
  };

  const grouped = new Map<string, Segment[]>();
  segments.forEach((s) => {
    const key = s.destination;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(s);
  });

  return (
    <div style={{ maxWidth: 820, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <Link href={`/trips/${trip_id}`} style={{ fontSize: 13, color: '#888', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 19l-7-7 7-7" stroke="#aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        Back to trip
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A2B4A', margin: '0 0 4px' }}>Route segments</h1>
          <p style={{ fontSize: 13, color: '#888', margin: 0 }}>
            {trip?.name || trip?.destination || 'Trip'} — {segments.length} segment{segments.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link
            href={`/api/voice/parse?context=trip_narration&trip_id=${trip_id}`}
            style={{
              padding: '8px 14px', borderRadius: 8,
              background: 'white', border: '1px solid #dbeafe',
              color: '#2E5FA3', fontSize: 12, fontWeight: 600, textDecoration: 'none',
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <rect x="9" y="2" width="6" height="11" rx="3" fill="#2E5FA3"/>
              <path d="M5 10a7 7 0 0014 0" stroke="#2E5FA3" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Narrate route
          </Link>
          <button
            onClick={() => setShowForm(!showForm)}
            style={{
              padding: '8px 14px', borderRadius: 8,
              background: 'linear-gradient(135deg, #2E5FA3, #1A2B4A)',
              border: 'none', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            + Add segment
          </button>
        </div>
      </div>

      {showForm && (
        <div style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '18px 20px', marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#888', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type</label>
              <select
                value={form.segment_type}
                onChange={(e) => setForm({ ...form, segment_type: e.target.value })}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #e2e8f0', fontSize: 13, background: '#f7f8fa' }}
              >
                <option value="flight">Flight</option>
                <option value="train">Train</option>
                <option value="bus">Bus</option>
                <option value="ferry">Ferry</option>
                <option value="drive">Drive</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#888', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Origin</label>
              <input value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} placeholder="e.g. JFK" style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #e2e8f0', fontSize: 13 }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#888', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Destination</label>
              <input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} placeholder="e.g. LHR" style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #e2e8f0', fontSize: 13 }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#888', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Carrier</label>
              <input value={form.carrier} onChange={(e) => setForm({ ...form, carrier: e.target.value })} placeholder="Optional" style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #e2e8f0', fontSize: 13 }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#888', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Departs</label>
              <input type="datetime-local" value={form.depart_at} onChange={(e) => setForm({ ...form, depart_at: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #e2e8f0', fontSize: 13 }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#888', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Arrives</label>
              <input type="datetime-local" value={form.arrive_at} onChange={(e) => setForm({ ...form, arrive_at: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #e2e8f0', fontSize: 13 }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={addSegment} disabled={saving || !form.origin.trim() || !form.destination.trim()} style={{
              padding: '9px 18px', borderRadius: 8,
              background: form.origin.trim() && form.destination.trim() && !saving ? 'linear-gradient(135deg, #2E5FA3, #1A2B4A)' : '#e5e7eb',
              border: 'none', color: 'white', fontSize: 13, fontWeight: 600,
              cursor: form.origin.trim() && form.destination.trim() && !saving ? 'pointer' : 'not-allowed',
            }}>
              {saving ? 'Saving...' : 'Add'}
            </button>
            <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }} style={{
              padding: '9px 18px', borderRadius: 8,
              background: 'white', border: '1px solid #e2e8f0',
              color: '#555', fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}>
              Cancel
            </button>
          </div>
          {error && <p style={{ fontSize: 12, color: '#dc2626', margin: '8px 0 0' }}>{error}</p>}
        </div>
      )}

      {loading ? (
        <p style={{ fontSize: 13, color: '#888' }}>Loading segments...</p>
      ) : segments.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', background: 'white', borderRadius: 12, border: '0.5px solid #e8e8e8' }}>
          <p style={{ fontSize: 14, color: '#555', margin: '0 0 6px' }}>No route segments yet.</p>
          <p style={{ fontSize: 12, color: '#888', margin: 0 }}>Add segments to define your travel route and trigger coverage checks.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 16 }}>
          {/* Timeline rail */}
          <div style={{ width: 3, background: '#e2e8f0', borderRadius: 2, flexShrink: 0, position: 'relative', minHeight: 60 }}>
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#2E5FA3', position: 'absolute', top: 0, left: -3 }} />
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#2E5FA3', position: 'absolute', bottom: 0, left: -3 }} />
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {segments.map((seg, idx) => (
              <div key={seg.segment_id} style={{
                background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 10,
                padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <span style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: '#eff4fc', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700, color: '#2E5FA3', flexShrink: 0,
                }}>
                  {TYPE_ICONS[seg.segment_type] || '?'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#1A2B4A', margin: 0 }}>
                    {seg.origin} → {seg.destination}
                  </p>
                  <p style={{ fontSize: 12, color: '#888', margin: '2px 0 0' }}>
                    {TYPE_LABELS[seg.segment_type] || seg.segment_type}
                    {seg.carrier ? ` — ${seg.carrier}` : ''}
                    {seg.depart_at ? ` — ${new Date(seg.depart_at).toLocaleString()}` : ''}
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <button
                    onClick={() => moveSegment(idx, -1)}
                    disabled={idx === 0}
                    style={{ width: 24, height: 20, border: 'none', background: idx === 0 ? 'transparent' : '#f7f8fa', borderRadius: 4, cursor: idx === 0 ? 'default' : 'pointer', fontSize: 10, color: '#888' }}
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveSegment(idx, 1)}
                    disabled={idx === segments.length - 1}
                    style={{ width: 24, height: 20, border: 'none', background: idx === segments.length - 1 ? 'transparent' : '#f7f8fa', borderRadius: 4, cursor: idx === segments.length - 1 ? 'default' : 'pointer', fontSize: 10, color: '#888' }}
                  >
                    ↓
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {segments.length > 0 && (
        <p style={{ fontSize: 12, color: '#888', margin: '16px 0 0' }}>
          Coverage and readiness checks will update based on your route.
        </p>
      )}
    </div>
  );
}
