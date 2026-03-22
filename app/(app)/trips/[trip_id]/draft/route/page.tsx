'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/auth/supabase-client';
import DraftHomeStepShell from '@/components/draft-home/DraftHomeStepShell';
import { useParams, useRouter } from 'next/navigation';
import { ensureTripDraftVersion, syncTripDraftRouteSegments } from '@/lib/draft-home/draft-home-api';
import { validateRouteSegments } from '@/lib/route-validation';
import RouteValidationBanner from '@/components/trips/RouteValidationBanner';

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

function segmentTypeCfg(type: string) {
  return SEGMENT_TYPES.find((s) => s.value === type) || SEGMENT_TYPES[0];
}

export default function RouteEditorDraftStepPage() {
  const params = useParams();
  const tripId = params?.trip_id as string;
  const router = useRouter();
  const { user } = useAuth();

  const [trip, setTrip] = useState<any>(null);
  const [segments, setSegments] = useState<RouteSegment[]>([]);
  const [loadingSegs, setLoadingSegs] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    type: 'flight',
    from: '',
    to: '',
    date: '',
    endDate: '',
    reference: '',
    notes: '',
  });

  const [tripForm, setTripForm] = useState({
    trip_name: '',
    destination_summary: '',
    departure_date: '',
    return_date: '',
    travel_mode_primary: 'air',
  });
  const [tripSaveError, setTripSaveError] = useState('');
  const [tripSaving, setTripSaving] = useState(false);

  const readinessHints = useMemo(() => {
    const hasSegments = segments.length > 0;
    const hasDates = Boolean(tripForm.departure_date && tripForm.return_date);
    return { hasSegments, hasDates };
  }, [segments.length, tripForm.departure_date, tripForm.return_date]);

  const routeValidation = useMemo(() => {
    const inputs = segments.map((s) => ({
      segment_id: s.id,
      segment_type: s.type,
      origin: s.from,
      destination: s.to,
      depart_at: s.date ? `${s.date}T12:00:00.000Z` : null,
      arrive_at: s.endDate ? `${s.endDate}T12:00:00.000Z` : null,
    }));
    return validateRouteSegments(inputs, {
      tripDepartureDate: tripForm.departure_date || null,
      tripReturnDate: tripForm.return_date || null,
    });
  }, [segments, tripForm.departure_date, tripForm.return_date]);

  useEffect(() => {
    if (!tripId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('trips')
          .select('*')
          .eq('trip_id', tripId)
          .maybeSingle();
        if (cancelled) return;
        setTrip(data);
        setTripForm({
          trip_name: data?.trip_name || '',
          destination_summary: data?.destination_summary || '',
          departure_date: data?.departure_date ? new Date(data.departure_date).toISOString().slice(0, 10) : '',
          return_date: data?.return_date ? new Date(data.return_date).toISOString().slice(0, 10) : '',
          travel_mode_primary: data?.travel_mode_primary || 'air',
        });
      } catch {
        if (cancelled) return;
        setTrip(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  useEffect(() => {
    if (!tripId) return;
    setLoadingSegs(true);
    (async () => {
      try {
        const { data } = await supabase
          .from('route_segments')
          .select('*')
          .eq('trip_id', tripId)
          .order('sort_order', { ascending: true });
        const mapped: RouteSegment[] = (data || []).map((s: any) => ({
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
      } catch {
        setSegments([]);
      } finally {
        setLoadingSegs(false);
      }
    })();
  }, [tripId]);

  useEffect(() => {
    if (!tripId || !user) return;
    // Ensure we have an active draft version for route building.
    (async () => {
      try {
        await ensureTripDraftVersion({ tripId, actorId: user.id, draftState: 'route_building' });
      } catch {
        // Best-effort: if persistence isn't available yet, route edits still render.
      }
    })();
  }, [tripId, user]);

  async function syncDraftSegments() {
    if (!user || !tripId) return;
    const { data } = await supabase
      .from('route_segments')
      .select('segment_id')
      .eq('trip_id', tripId);
    const ids = (data || []).map((r: any) => r.segment_id).filter(Boolean);
    await syncTripDraftRouteSegments({
      tripId,
      actorId: user.id,
      routeSegmentIds: ids,
    });
  }

  async function handleAdd() {
    if (!user) return;
    if (!form.from.trim() && !form.to.trim() && !form.date) return;

    setSaving(true);
    try {
      const { data } = await supabase.rpc('upsert_route_segment', {
        p_trip_id: tripId,
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

      if (data?.success) {
        const newSeg: RouteSegment = { ...form, id: data.segment_id };
        setSegments((prev) => [...prev, newSeg]);
        setForm({ type: 'flight', from: '', to: '', date: '', endDate: '', reference: '', notes: '' });
        setAdding(false);
        await syncDraftSegments();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(id: string) {
    if (!user) return;
    setSaving(true);
    try {
      await supabase.rpc('upsert_route_segment', {
        p_trip_id: tripId,
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

      setSegments((prev) => prev.map((s) => (s.id === id ? { ...form, id } : s)));
      setEditingId(null);
      await syncDraftSegments();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!user) return;
    setSaving(true);
    try {
      await supabase.rpc('delete_route_segment', { p_segment_id: id, p_actor_id: user.id });
      setSegments((prev) => prev.filter((s) => s.id !== id));
      if (editingId === id) setEditingId(null);
      await syncDraftSegments();
    } finally {
      setSaving(false);
    }
  }

  function SegmentForm({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
    return (
      <div style={{ background: '#f7f9fc', border: '1px solid #dbeafe', borderRadius: 12, padding: '16px 18px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          {SEGMENT_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setForm((f) => ({ ...f, type: t.value }))}
              style={{
                padding: '5px 12px',
                fontSize: 12,
                fontWeight: form.type === t.value ? 600 : 400,
                border: `1px solid ${form.type === t.value ? '#2E5FA3' : '#ddd'}`,
                borderRadius: 6,
                background: form.type === t.value ? '#eff4fc' : 'white',
                color: form.type === t.value ? '#2E5FA3' : '#555',
                cursor: 'pointer',
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#666', marginBottom: 4 }}>
              {['hotel', 'car'].includes(form.type) ? 'Location' : 'From'}
            </label>
            <input
              value={form.from}
              onChange={(e) => setForm((f) => ({ ...f, from: e.target.value }))}
              placeholder={['hotel', 'car'].includes(form.type) ? 'e.g. Lisbon' : 'e.g. JFK'}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 10px',
                fontSize: 13,
                border: '1px solid #ddd',
                borderRadius: 7,
                outline: 'none',
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            />
          </div>

          {!['hotel', 'car'].includes(form.type) && (
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#666', marginBottom: 4 }}>
                To
              </label>
              <input
                value={form.to}
                onChange={(e) => setForm((f) => ({ ...f, to: e.target.value }))}
                placeholder="e.g. LHR"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '8px 10px',
                  fontSize: 13,
                  border: '1px solid #ddd',
                  borderRadius: 7,
                  outline: 'none',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
              />
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#666', marginBottom: 4 }}>
              {['hotel', 'car'].includes(form.type) ? 'Check-in / Start' : 'Date'}
            </label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 10px',
                fontSize: 13,
                border: '1px solid #ddd',
                borderRadius: 7,
                outline: 'none',
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            />
          </div>

          {['hotel', 'car'].includes(form.type) && (
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#666', marginBottom: 4 }}>
                Check-out / End
              </label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                min={form.date}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '8px 10px',
                  fontSize: 13,
                  border: '1px solid #ddd',
                  borderRadius: 7,
                  outline: 'none',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
              />
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#666', marginBottom: 4 }}>
              Reference (optional)
            </label>
            <input
              value={form.reference}
              onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
              placeholder="Booking ref, flight no…"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 10px',
                fontSize: 13,
                border: '1px solid #ddd',
                borderRadius: 7,
                outline: 'none',
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            />
          </div>
        </div>

        <input
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          placeholder="Notes (optional)"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '8px 10px',
            fontSize: 13,
            border: '1px solid #ddd',
            borderRadius: 7,
            outline: 'none',
            marginBottom: 12,
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        />

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onSave}
            style={{
              flex: 1,
              padding: '9px 0',
              background: '#1A2B4A',
              color: 'white',
              border: 'none',
              borderRadius: 7,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            {saving ? 'Saving…' : 'Save segment'}
          </button>
          <button
            onClick={onCancel}
            style={{
              padding: '9px 14px',
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: 7,
              fontSize: 13,
              color: '#666',
              cursor: 'pointer',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  function startEdit(seg: RouteSegment) {
    setForm({
      type: seg.type,
      from: seg.from,
      to: seg.to,
      date: seg.date,
      endDate: seg.endDate,
      reference: seg.reference,
      notes: seg.notes,
    });
    setEditingId(seg.id);
    setAdding(false);
  }

  async function handleTripSave() {
    if (!user) return;
    setTripSaveError('');
    if (!tripForm.trip_name.trim()) {
      setTripSaveError('Trip name is required.');
      return;
    }
    setTripSaving(true);
    try {
      const { data, error: rpcError } = await supabase.rpc('update_trip', {
        p_trip_id: tripId,
        p_trip_name: tripForm.trip_name.trim(),
        p_destination_summary: tripForm.destination_summary.trim() || null,
        p_departure_date: tripForm.departure_date || null,
        p_return_date: tripForm.return_date || null,
        p_travel_mode_primary: tripForm.travel_mode_primary,
      });
      if (rpcError || !data?.success) {
        setTripSaveError(rpcError?.message || data?.error || 'Failed to save trip.');
        return;
      }
      setTrip((prev: any) => ({
        ...prev,
        trip_name: tripForm.trip_name.trim(),
        destination_summary: tripForm.destination_summary.trim() || null,
        departure_date: tripForm.departure_date || null,
        return_date: tripForm.return_date || null,
        travel_mode_primary: tripForm.travel_mode_primary,
      }));
      await syncDraftSegments();
    } finally {
      setTripSaving(false);
    }
  }

  return (
    <DraftHomeStepShell
      screenId="S-DRAFT-004"
      tripId={tripId}
      title="Route editor"
      step={3}
      total={6}
      backHref={`/trips/${tripId}/draft`}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <RouteValidationBanner issues={routeValidation.issues} tripId={tripId} />
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 16px' }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#1A2B4A' }}>Trip basics</p>
          <p style={{ margin: '6px 0 12px', fontSize: 13, color: '#666', lineHeight: 1.6 }}>
            Add missing dates here so readiness can succeed.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#444', marginBottom: 6 }}>Trip name</label>
              <input
                value={tripForm.trip_name}
                onChange={(e) => setTripForm((f) => ({ ...f, trip_name: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #ddd',
                  borderRadius: 10,
                  outline: 'none',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  fontSize: 13,
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#444', marginBottom: 6 }}>
                Destination
              </label>
              <input
                value={tripForm.destination_summary}
                onChange={(e) => setTripForm((f) => ({ ...f, destination_summary: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #ddd',
                  borderRadius: 10,
                  outline: 'none',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  fontSize: 13,
                }}
                placeholder="e.g. Lisbon, Portugal"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#444', marginBottom: 6 }}>
                Departure date
              </label>
              <input
                type="date"
                value={tripForm.departure_date}
                onChange={(e) => setTripForm((f) => ({ ...f, departure_date: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #ddd',
                  borderRadius: 10,
                  outline: 'none',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  fontSize: 13,
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#444', marginBottom: 6 }}>Return date</label>
              <input
                type="date"
                value={tripForm.return_date}
                onChange={(e) => setTripForm((f) => ({ ...f, return_date: e.target.value }))}
                min={tripForm.departure_date || undefined}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #ddd',
                  borderRadius: 10,
                  outline: 'none',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  fontSize: 13,
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            {['air', 'rail', 'sea', 'road', 'mixed'].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setTripForm((f) => ({ ...f, travel_mode_primary: m }))}
                style={{
                  padding: '7px 12px',
                  borderRadius: 10,
                  border: `1px solid ${tripForm.travel_mode_primary === m ? '#2E5FA3' : '#e5e7eb'}`,
                  background: tripForm.travel_mode_primary === m ? '#eff4fc' : 'white',
                  color: tripForm.travel_mode_primary === m ? '#2E5FA3' : '#555',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
              >
                {m}
              </button>
            ))}
            <button
              type="button"
              onClick={handleTripSave}
              disabled={!user || tripSaving}
              style={{
                marginLeft: 'auto',
                padding: '10px 16px',
                borderRadius: 10,
                border: 'none',
                background: !user || tripSaving ? '#93afd4' : '#1A2B4A',
                color: 'white',
                fontSize: 13,
                fontWeight: 900,
                cursor: !user || tripSaving ? 'not-allowed' : 'pointer',
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            >
              {tripSaving ? 'Saving…' : 'Save trip basics'}
            </button>
          </div>

          {tripSaveError ? (
            <p style={{ margin: '10px 0 0', fontSize: 12, color: '#dc2626' }}>{tripSaveError}</p>
          ) : null}
        </div>

        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#1A2B4A' }}>Route segments</p>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: '#666' }}>
                {readinessHints.hasSegments ? 'You have segments saved.' : 'Add at least one segment to build your itinerary.'}
              </p>
            </div>
            {!adding && (
              <button
                type="button"
                onClick={() => {
                  setAdding(true);
                  setEditingId(null);
                  setForm({ type: 'flight', from: '', to: '', date: '', endDate: '', reference: '', notes: '' });
                }}
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  color: '#2E5FA3',
                  background: '#eff4fc',
                  border: '1px solid #bfdbfe',
                  borderRadius: 10,
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
              >
                + Add segment
              </button>
            )}
          </div>

          <div style={{ marginTop: 12 }}>
            {loadingSegs ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: '#888' }}>Loading segments…</div>
            ) : (
              <>
                {adding ? (
                  <SegmentForm onSave={handleAdd} onCancel={() => setAdding(false)} />
                ) : null}

                {segments.length === 0 && !adding ? (
                  <div style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '36px 24px', textAlign: 'center' }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>No route segments yet</p>
                    <p style={{ fontSize: 13, color: '#999', margin: '8px 0 18px', lineHeight: 1.6 }}>
                      Add flights, hotel stays, train legs, and car rentals to build your trip itinerary.
                    </p>
                    <button
                      type="button"
                      onClick={() => setAdding(true)}
                      style={{
                        padding: '10px 22px',
                        background: '#1A2B4A',
                        color: 'white',
                        border: 'none',
                        borderRadius: 10,
                        fontSize: 13,
                        fontWeight: 800,
                        cursor: 'pointer',
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                      }}
                    >
                      Add first segment
                    </button>
                  </div>
                ) : null}

                {segments.map((seg) => {
                  const cfg = segmentTypeCfg(seg.type);
                  const isEditing = editingId === seg.id;
                  return (
                    <div key={seg.id} style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12, overflow: 'hidden', marginTop: 10 }}>
                      {isEditing ? (
                        <div style={{ padding: '14px 18px' }}>
                          <SegmentForm onSave={() => handleUpdate(seg.id)} onCancel={() => setEditingId(null)} />
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 18px' }}>
                          <div style={{ width: 36, height: 36, borderRadius: 9, background: '#f7f8fa', border: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ fontSize: 16 }}>{cfg.icon}</span>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 13, fontWeight: 800, color: '#1A2B4A' }}>
                                {cfg.label}
                                {seg.from ? ` · ${seg.from}` : ''}
                                {seg.to ? ` → ${seg.to}` : ''}
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                              {seg.date ? (
                                <span style={{ fontSize: 11, color: '#888' }}>
                                  {new Date(seg.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  {seg.endDate ? ` – ${new Date(seg.endDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                                </span>
                              ) : null}
                              {seg.reference ? (
                                <span style={{ fontSize: 11, color: '#2E5FA3', background: '#eff4fc', borderRadius: 6, padding: '2px 8px' }}>
                                  {seg.reference}
                                </span>
                              ) : null}
                              {seg.notes ? <span style={{ fontSize: 11, color: '#999' }}>{seg.notes}</span> : null}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            <button
                              type="button"
                              onClick={() => startEdit(seg)}
                              style={{
                                background: 'none',
                                border: '1px solid #e5e7eb',
                                borderRadius: 8,
                                padding: '6px 12px',
                                fontSize: 11,
                                color: '#555',
                                cursor: 'pointer',
                                fontFamily: 'system-ui, -apple-system, sans-serif',
                                fontWeight: 800,
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(seg.id)}
                              style={{
                                background: 'none',
                                border: '1px solid #fee2e2',
                                borderRadius: 8,
                                padding: '6px 12px',
                                fontSize: 11,
                                color: '#dc2626',
                                cursor: 'pointer',
                                fontFamily: 'system-ui, -apple-system, sans-serif',
                                fontWeight: 800,
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {segments.length > 0 ? (
                  <p style={{ fontSize: 11, color: '#bbb', margin: '10px 0 0', lineHeight: 1.5 }}>
                    Segments are persisted in Supabase for this trip.
                  </p>
                ) : null}
              </>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
          <button
            type="button"
            onClick={() => router.push(`/trips/${tripId}/draft/activities`)}
            style={{
              flex: 1,
              padding: '12px 0',
              background: '#1A2B4A',
              color: 'white',
              border: 'none',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 900,
              cursor: 'pointer',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            Continue to activities
          </button>
          <button
            type="button"
            onClick={() => router.push(`/trips/${tripId}/draft/unresolved`)}
            style={{
              padding: '12px 16px',
              background: 'white',
              border: '1px solid #e5e7eb',
              color: '#555',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 800,
              cursor: 'pointer',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            Skip
          </button>
        </div>
      </div>
    </DraftHomeStepShell>
  );
}

