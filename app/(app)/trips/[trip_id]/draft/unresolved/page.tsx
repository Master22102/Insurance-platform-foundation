'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DraftHomeStepShell from '@/components/draft-home/DraftHomeStepShell';
import { supabase } from '@/lib/auth/supabase-client';
import { useAuth } from '@/lib/auth/auth-context';
import { syncTripDraftUnresolvedItems } from '@/lib/draft-home/draft-home-api';

type DbItem = {
  item_id: string;
  item_type: string;
  source: string;
  title: string;
  description: string | null;
  is_resolved: boolean;
  external_key: string | null;
};

/** Sync stores checklist keys in `external_key` (e.g. `route.no_segments`, `trip.destination_missing`). */
function fixHrefForUnresolvedItem(tripId: string, externalKey: string | null): string {
  const base = `/trips/${tripId}/draft`;
  const k = (externalKey || '').toLowerCase();
  if (!k) return `${base}/route`;
  if (k.includes('destination')) return `${base}/route`;
  if (k.includes('dates') || k.startsWith('trip.')) return `${base}/route`;
  if (k.startsWith('route.')) return `${base}/route`;
  return `${base}/route`;
}

export default function UnresolvedItemsPanelPage() {
  const params = useParams();
  const tripId = params?.trip_id as string;
  const router = useRouter();
  const { user } = useAuth();

  const [trip, setTrip] = useState<any>(null);
  const [segments, setSegments] = useState<any[]>([]);
  const [items, setItems] = useState<DbItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newKind, setNewKind] = useState<'blocker' | 'warning'>('blocker');
  const [savingAdd, setSavingAdd] = useState(false);

  const inferredBlockers = useMemo(() => {
    const destOk = Boolean(trip?.destination_summary && String(trip.destination_summary).trim().length > 0);
    const datesOk = Boolean(trip?.departure_date && trip?.return_date);
    const hasSegments = segments.length > 0;
    const missingSegmentDates = segments.some((s: any) => {
      const departAt = s.depart_at ? new Date(s.depart_at) : null;
      if (!departAt) return true;
      const type = s.segment_type;
      const requiresEnd = type === 'hotel' || type === 'car';
      if (requiresEnd) {
        const arriveAt = s.arrive_at ? new Date(s.arrive_at) : null;
        if (!arriveAt) return true;
      }
      return false;
    });

    const list: Array<{
      key: string;
      item_title: string;
      description: string;
      severity: 'critical' | 'warning';
      fix_screen: string;
    }> = [];

    if (!hasSegments) {
      list.push({
        key: 'route.no_segments',
        item_title: 'No route segments yet',
        description: 'You need at least one leg to structure your itinerary.',
        severity: 'critical',
        fix_screen: `/trips/${tripId}/draft/route`,
      });
    }
    if (hasSegments && missingSegmentDates) {
      list.push({
        key: 'route.segment_missing_dates',
        item_title: 'Some segments are missing dates',
        description: 'Add departure/start dates for each leg (and end dates for hotel/car).',
        severity: 'critical',
        fix_screen: `/trips/${tripId}/draft/route`,
      });
    }
    if (!datesOk) {
      list.push({
        key: 'trip.dates_missing',
        item_title: 'Departure/return dates are missing',
        description: 'Set your overall trip window on the route step.',
        severity: 'critical',
        fix_screen: `/trips/${tripId}/draft/route`,
      });
    }
    if (!destOk) {
      list.push({
        key: 'trip.destination_missing',
        item_title: 'Destination is missing',
        description: 'Add destination text so the system can personalize your itinerary.',
        severity: 'warning',
        fix_screen: `/trips/${tripId}/draft/voice`,
      });
    }
    return list;
  }, [segments, trip, tripId]);

  async function reloadItems() {
    if (!tripId) return;
    const { data } = await supabase
      .from('unresolved_items')
      .select('item_id, item_type, source, title, description, is_resolved, external_key')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: true });
    setItems((data || []) as DbItem[]);
  }

  useEffect(() => {
    if (!tripId) return;
    let cancelled = false;
    Promise.all([
      supabase.from('trips').select('*').eq('trip_id', tripId).maybeSingle(),
      supabase.from('route_segments').select('*').eq('trip_id', tripId),
    ]).then(([tripRes, segRes]) => {
      if (cancelled) return;
      setTrip(tripRes.data);
      setSegments(segRes.data || []);
    });
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  useEffect(() => {
    if (!user || !tripId || !trip) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        await syncTripDraftUnresolvedItems({
          tripId,
          actorId: user.id,
          blockers: inferredBlockers.map((b) => ({
            item_type: b.key,
            item_title: b.item_title,
            description: b.description,
            severity: b.severity,
            fix_screen: b.fix_screen,
          })),
        });
        if (cancelled) return;
        await reloadItems();
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, tripId, trip, inferredBlockers]);

  const openItems = items.filter((i) => !i.is_resolved);
  const resolvedItems = items.filter((i) => i.is_resolved);
  const blockingCritical = openItems.some((i) => i.item_type === 'blocker');

  async function resolveById(itemId: string) {
    if (!user) return;
    await supabase.rpc('resolve_unresolved_item', {
      p_item_id: itemId,
      p_actor_id: user.id,
      p_note: 'marked_done',
    });
    await reloadItems();
  }

  async function addCustom() {
    if (!user || !newTitle.trim()) return;
    setSavingAdd(true);
    try {
      await supabase.rpc('add_unresolved_item', {
        p_trip_id: tripId,
        p_title: newTitle.trim(),
        p_description: newDesc.trim() || null,
        p_item_type: newKind,
        p_actor_id: user.id,
      });
      setNewTitle('');
      setNewDesc('');
      setShowAdd(false);
      await reloadItems();
    } finally {
      setSavingAdd(false);
    }
  }

  return (
    <DraftHomeStepShell
      screenId="S-DRAFT-007"
      tripId={tripId}
      title="Unresolved blockers"
      step={5}
      total={6}
      backHref={`/trips/${tripId}/draft/activities`}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 16px' }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 900, color: '#1A2B4A' }}>Resolve before readiness</p>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#666', lineHeight: 1.6 }}>
            {loading
              ? 'Syncing checklist…'
              : blockingCritical
                ? 'Open blockers remain. Fix trip data or clear user blockers before confirming readiness.'
                : 'No open blockers in this list. Server readiness may still require dates, destination, and valid route timing.'}
          </p>
        </div>

        {openItems.length === 0 && !loading ? (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '18px 16px' }}>
            <p style={{ margin: 0, fontWeight: 900, color: '#14532d' }}>No open items in this list</p>
          </div>
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {openItems.map((b) => {
            const isCrit = b.item_type === 'blocker';
            return (
              <div
                key={b.item_id}
                style={{
                  background: 'white',
                  border: `1px solid ${isCrit ? '#fde68a' : '#e5e7eb'}`,
                  borderRadius: 12,
                  padding: '14px 16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 900,
                      color: isCrit ? '#92400e' : '#6b7280',
                      background: isCrit ? '#fffbeb' : '#f5f5f5',
                      border: `1px solid ${isCrit ? '#fde68a' : '#e5e7eb'}`,
                      borderRadius: 999,
                      padding: '4px 10px',
                    }}
                  >
                    {isCrit ? '⛔ Blocker' : '⚠ Warning'}
                  </span>
                  {b.source === 'user' ? (
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#6b7280' }}>You added</span>
                  ) : (
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#6b7280' }}>System</span>
                  )}
                </div>
                <p style={{ margin: '10px 0 0', fontSize: 14, fontWeight: 900, color: '#1A2B4A' }}>{b.title}</p>
                {b.description ? (
                  <p style={{ margin: '6px 0 0', fontSize: 13, color: '#666', lineHeight: 1.6 }}>{b.description}</p>
                ) : null}
                <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => router.push(fixHrefForUnresolvedItem(tripId, b.external_key))}
                    style={{
                      padding: '10px 14px',
                      minHeight: 44,
                      borderRadius: 10,
                      background: '#eff4fc',
                      border: '1px solid #bfdbfe',
                      color: '#2E5FA3',
                      fontSize: 13,
                      fontWeight: 900,
                      cursor: 'pointer',
                    }}
                  >
                    Fix now
                  </button>
                  <button
                    type="button"
                    onClick={() => resolveById(b.item_id)}
                    disabled={!user || (isCrit && b.source === 'system')}
                    style={{
                      padding: '10px 14px',
                      minHeight: 44,
                      borderRadius: 10,
                      border: '1px solid #bbf7d0',
                      background: isCrit && b.source === 'system' ? '#f5f5f5' : '#f0fdf4',
                      color: isCrit && b.source === 'system' ? '#9ca3af' : '#14532d',
                      fontSize: 13,
                      fontWeight: 900,
                      cursor: !user || (isCrit && b.source === 'system') ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isCrit && b.source === 'system' ? 'Fix data first' : 'Mark done'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setShowAdd((s) => !s)}
          style={{
            padding: '10px 14px',
            minHeight: 44,
            borderRadius: 10,
            border: '1px dashed #cbd5e1',
            background: 'white',
            fontWeight: 900,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          + Add your own item
        </button>

        {showAdd ? (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Title (e.g. Book hotel)"
              style={{ width: '100%', padding: 10, minHeight: 48, marginBottom: 8, borderRadius: 8, border: '1px solid #ddd' }}
            />
            <textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Details (optional)"
              rows={3}
              style={{ width: '100%', padding: 10, minHeight: 48, marginBottom: 8, borderRadius: 8, border: '1px solid #ddd' }}
            />
            <select
              value={newKind}
              onChange={(e) => setNewKind(e.target.value as 'blocker' | 'warning')}
              style={{ marginBottom: 8, padding: 8, minHeight: 48, borderRadius: 8 }}
            >
              <option value="blocker">Blocker</option>
              <option value="warning">Warning</option>
            </select>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                disabled={savingAdd || !newTitle.trim()}
                onClick={() => addCustom()}
                style={{
                  padding: '10px 16px',
                  minHeight: 44,
                  background: '#1A2B4A',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 900,
                  cursor: savingAdd ? 'wait' : 'pointer',
                }}
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                style={{ padding: '10px 16px', minHeight: 44, borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', fontWeight: 900, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {resolvedItems.length > 0 ? (
          <details style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 800, color: '#6b7280' }}>
              Resolved ({resolvedItems.length})
            </summary>
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {resolvedItems.map((r) => (
                <div key={r.item_id} style={{ fontSize: 12, color: '#9ca3af', textDecoration: 'line-through' }}>
                  {r.title}
                </div>
              ))}
            </div>
          </details>
        ) : null}

        <button
          type="button"
          onClick={() => router.push(`/trips/${tripId}/draft/readiness`)}
          style={{
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
          Continue to readiness
        </button>
      </div>
    </DraftHomeStepShell>
  );
}
