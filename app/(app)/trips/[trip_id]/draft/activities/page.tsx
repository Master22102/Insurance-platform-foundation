'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DraftHomeStepShell from '@/components/draft-home/DraftHomeStepShell';
import { supabase } from '@/lib/auth/supabase-client';
import { useAuth } from '@/lib/auth/auth-context';
import CreatorDiscoveryModal from '@/components/creators/CreatorDiscoveryModal';

type Row = {
  candidate_id: string;
  activity_name: string;
  activity_type: string | null;
  city: string | null;
  estimated_cost: number | null;
  currency_code: string | null;
  source: string;
  status: string;
  date_hint: string | null;
  booking_url: string | null;
  notes: string | null;
};

export default function ActivitySuggestionsPanelPage() {
  const params = useParams();
  const tripId = params?.trip_id as string;
  const router = useRouter();
  const { user } = useAuth();

  const [trip, setTrip] = useState<any>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [showDiscover, setShowDiscover] = useState(false);
  const [form, setForm] = useState({
    activity_name: '',
    city: '',
    activity_type: 'sightseeing',
    estimated_cost: '',
    date_hint: '',
    booking_url: '',
    notes: '',
  });

  const templateSuggestions = useMemo(() => {
    const dest = (trip?.destination_summary || '').trim() || 'your destination';
    return [
      { activity_name: `Local food highlight in ${dest}`, activity_type: 'dining', sort_order: 0 },
      { activity_name: 'Top landmarks + a hidden gem stop', activity_type: 'sightseeing', sort_order: 1 },
      { activity_name: 'Museum / cultural immersion', activity_type: 'cultural', sort_order: 2 },
    ];
  }, [trip?.destination_summary]);

  const loadRows = useCallback(async () => {
    if (!tripId) return;
    const { data, error } = await supabase
      .from('activity_candidates')
      .select(
        'candidate_id, activity_name, activity_type, city, estimated_cost, currency_code, source, status, date_hint, booking_url, notes',
      )
      .eq('trip_id', tripId)
      .order('sort_order', { ascending: true });
    if (error) {
      setRows([]);
      return;
    }
    setRows((data || []) as Row[]);
  }, [tripId]);

  useEffect(() => {
    if (!tripId) return;
    (async () => {
      const { data } = await supabase
        .from('trips')
        .select('trip_id, destination_summary, departure_date, return_date, travel_mode_primary')
        .eq('trip_id', tripId)
        .maybeSingle();
      setTrip(data);
    })();
  }, [tripId]);

  useEffect(() => {
    if (!tripId || !user || !trip) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      await loadRows();
      if (cancelled) return;
      const { count } = await supabase
        .from('activity_candidates')
        .select('candidate_id', { count: 'exact', head: true })
        .eq('trip_id', tripId);
      if (cancelled) return;
      if ((count ?? 0) === 0 && templateSuggestions.length > 0) {
        await supabase.from('activity_candidates').insert(
          templateSuggestions.map((t) => ({
            trip_id: tripId,
            activity_name: t.activity_name,
            activity_type: t.activity_type,
            source: 'ai_suggested',
            status: 'suggested',
            sort_order: t.sort_order,
            currency_code: 'USD',
          })),
        );
        await loadRows();
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tripId, user, trip, templateSuggestions, loadRows]);

  async function setStatus(candidateId: string, status: 'accepted' | 'rejected' | 'deferred') {
    if (!user) return;
    setSavingId(candidateId);
    try {
      await supabase.from('activity_candidates').update({ status, updated_at: new Date().toISOString() }).eq('candidate_id', candidateId);
      await loadRows();
    } finally {
      setSavingId(null);
    }
  }

  async function addManual() {
    if (!user || !form.activity_name.trim()) return;
    setSavingId('new');
    try {
      await supabase.from('activity_candidates').insert({
        trip_id: tripId,
        activity_name: form.activity_name.trim(),
        activity_type: form.activity_type,
        city: form.city.trim() || null,
        estimated_cost: form.estimated_cost ? Number(form.estimated_cost) : null,
        date_hint: form.date_hint.trim() || null,
        booking_url: form.booking_url.trim() || null,
        notes: form.notes.trim() || null,
        source: 'user_added',
        status: 'suggested',
        currency_code: 'USD',
        sort_order: rows.length,
      });
      setForm({
        activity_name: '',
        city: '',
        activity_type: 'sightseeing',
        estimated_cost: '',
        date_hint: '',
        booking_url: '',
        notes: '',
      });
      setShowAdd(false);
      await loadRows();
    } finally {
      setSavingId(null);
    }
  }

  async function removeRow(candidateId: string, source: string) {
    if (source !== 'user_added') return;
    await supabase.from('activity_candidates').delete().eq('candidate_id', candidateId);
    await loadRows();
  }

  return (
    <DraftHomeStepShell
      screenId="S-DRAFT-006"
      tripId={tripId}
      title="Activity suggestions"
      step={4}
      total={6}
      backHref={`/trips/${tripId}/draft/route`}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 16px' }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 900, color: '#1A2B4A' }}>
            Activities for {trip?.destination_summary || 'your trip'}
          </p>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#666', lineHeight: 1.6 }}>
            Accept, reject, or defer suggestions. User-added activities can be removed. (AI OpenRouter suggestions are a future enhancement.)
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
            <button
              onClick={() => setShowDiscover(true)}
              style={{
                border: '1px solid #111827',
                background: '#111827',
                color: 'white',
                borderRadius: 10,
                padding: '10px 12px',
                minHeight: 44,
                fontWeight: 950,
                fontSize: 12,
              }}
            >
              Discover activities (creators)
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 16, color: '#888' }}>Loading activities…</div>
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((s) => {
            const accepted = s.status === 'accepted';
            const rejected = s.status === 'rejected';
            const deferred = s.status === 'deferred';
            return (
              <div
                key={s.candidate_id}
                style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '14px 16px' }}
              >
                <p style={{ margin: 0, fontSize: 14, fontWeight: 900, color: '#1A2B4A' }}>{s.activity_name}</p>
                <p style={{ margin: '6px 0 0', fontSize: 12, color: '#666' }}>
                  {[s.activity_type, s.city, s.date_hint].filter(Boolean).join(' · ') || '—'}
                  {s.estimated_cost != null ? ` · ${s.currency_code || 'USD'} ${s.estimated_cost}` : ''}
                </p>
                <p style={{ margin: '8px 0 0' }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: '#6b7280',
                      background: '#f9fafb',
                      border: '1px solid #e5e7eb',
                      borderRadius: 999,
                      padding: '4px 10px',
                    }}
                  >
                    {s.status} · {s.source === 'ai_suggested' ? 'Suggested' : 'Yours'}
                  </span>
                </p>
                <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    disabled={!user || savingId === s.candidate_id}
                    onClick={() => setStatus(s.candidate_id, 'accepted')}
                    style={{
                      padding: '10px 14px',
                      minHeight: 44,
                      borderRadius: 10,
                      border: `1px solid ${accepted ? '#bbf7d0' : '#e5e7eb'}`,
                      background: accepted ? '#f0fdf4' : 'white',
                      fontWeight: 900,
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    disabled={!user || savingId === s.candidate_id}
                    onClick={() => setStatus(s.candidate_id, 'rejected')}
                    style={{
                      padding: '10px 14px',
                      minHeight: 44,
                      borderRadius: 10,
                      border: `1px solid ${rejected ? '#fee2e2' : '#e5e7eb'}`,
                      background: rejected ? '#fef2f2' : 'white',
                      fontWeight: 900,
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    disabled={!user || savingId === s.candidate_id}
                    onClick={() => setStatus(s.candidate_id, 'deferred')}
                    style={{
                      padding: '10px 14px',
                      minHeight: 44,
                      borderRadius: 10,
                      border: '1px solid #e5e7eb',
                      background: deferred ? '#f9fafb' : 'white',
                      fontWeight: 800,
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    Defer
                  </button>
                  {s.source === 'user_added' ? (
                    <button
                      type="button"
                      onClick={() => removeRow(s.candidate_id, s.source)}
                      style={{ padding: '10px 14px', minHeight: 44, borderRadius: 10, border: '1px solid #fecaca', background: '#fff', color: '#b91c1c' }}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setShowAdd((x) => !x)}
          style={{ padding: '10px 14px', minHeight: 44, borderRadius: 10, border: '1px dashed #cbd5e1', background: 'white', fontWeight: 900 }}
        >
          + Add activity
        </button>

        {showAdd ? (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              placeholder="Activity name *"
              value={form.activity_name}
              onChange={(e) => setForm((f) => ({ ...f, activity_name: e.target.value }))}
              style={{ padding: 10, minHeight: 48, borderRadius: 8, border: '1px solid #ddd' }}
            />
            <input
              placeholder="City"
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              style={{ padding: 10, minHeight: 48, borderRadius: 8, border: '1px solid #ddd' }}
            />
            <select
              value={form.activity_type}
              onChange={(e) => setForm((f) => ({ ...f, activity_type: e.target.value }))}
              style={{ padding: 10, minHeight: 48 }}
            >
              {['dining', 'sightseeing', 'adventure', 'cultural', 'wellness', 'transport', 'other'].map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
            <input
              placeholder="Estimated cost (optional)"
              value={form.estimated_cost}
              onChange={(e) => setForm((f) => ({ ...f, estimated_cost: e.target.value }))}
              style={{ padding: 10, minHeight: 48, borderRadius: 8, border: '1px solid #ddd' }}
            />
            <input
              placeholder="Date hint (e.g. Day 3)"
              value={form.date_hint}
              onChange={(e) => setForm((f) => ({ ...f, date_hint: e.target.value }))}
              style={{ padding: 10, minHeight: 48, borderRadius: 8, border: '1px solid #ddd' }}
            />
            <input
              placeholder="Booking URL"
              value={form.booking_url}
              onChange={(e) => setForm((f) => ({ ...f, booking_url: e.target.value }))}
              style={{ padding: 10, minHeight: 48, borderRadius: 8, border: '1px solid #ddd' }}
            />
            <textarea
              placeholder="Notes"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              style={{ padding: 10, minHeight: 48, borderRadius: 8, border: '1px solid #ddd' }}
            />
            <button
              type="button"
              disabled={savingId === 'new' || !form.activity_name.trim()}
              onClick={() => addManual()}
              style={{ padding: 12, minHeight: 48, background: '#1A2B4A', color: 'white', border: 'none', borderRadius: 10, fontWeight: 900 }}
            >
              Save activity
            </button>
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
          <button
            type="button"
            onClick={() => router.push(`/trips/${tripId}/draft/unresolved`)}
            style={{
              flex: 1,
              padding: '12px 0',
              minHeight: 48,
              background: '#1A2B4A',
              color: 'white',
              border: 'none',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            Continue to blockers
          </button>
        </div>
      </div>

      <CreatorDiscoveryModal open={showDiscover} onClose={() => setShowDiscover(false)} tripId={tripId} />
    </DraftHomeStepShell>
  );
}
