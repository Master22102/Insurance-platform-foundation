'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/auth/supabase-client';
import { useAuth } from '@/lib/auth/auth-context';

const REGION_ZERO = '00000000-0000-0000-0000-000000000000';

type InboxItem = {
  item_id?: string;
  title?: string;
  body?: string;
  next_step_hint?: string;
  priority?: string;
  status?: string;
};

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'open', label: 'Open' },
  { value: 'snoozed', label: 'Snoozed' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
];

export default function FoclInboxPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [featureFilter, setFeatureFilter] = useState('');
  const [incidentFilter, setIncidentFilter] = useState('');
  const [assignedToMeOnly, setAssignedToMeOnly] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const pageSize = 20;

  const load = useCallback(
    async (startOffset: number, append: boolean) => {
      if (!user) {
        setLoading(false);
        setItems([]);
        return;
      }
      setError(null);
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      try {
        const featureTrim = featureFilter.trim();
        const incidentTrim = incidentFilter.trim();
        const uuidRe =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        const incidentUuid = uuidRe.test(incidentTrim) ? incidentTrim : null;

        const { data, error: rpcErr } = await supabase.rpc('list_action_inbox_items', {
          p_status: statusFilter || null,
          p_feature_id: featureTrim.length > 0 ? featureTrim : null,
          p_incident_id: incidentUuid,
          p_assigned_to: assignedToMeOnly && user?.id ? user.id : null,
          p_limit: pageSize,
          p_offset: startOffset,
        });
        if (rpcErr) {
          setError('Could not load the decision queue. Try again.');
          return;
        }
        const raw = (data as { items?: InboxItem[] })?.items ?? [];
        const list = Array.isArray(raw) ? raw : [];
        setHasMore(list.length === pageSize);
        setOffset(startOffset + list.length);
        setItems((prev) => (append ? [...prev, ...list] : list));
      } catch {
        setError('Could not load the decision queue.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [user, statusFilter, featureFilter, incidentFilter, assignedToMeOnly],
  );

  useEffect(() => {
    setOffset(0);
    void load(0, false);
  }, [load, user, statusFilter, featureFilter, incidentFilter, assignedToMeOnly]);

  const runMutation = async (itemId: string, op: () => Promise<{ error: { message?: string } | null }>) => {
    if (!user?.id) return;
    setActionKey(itemId);
    setError(null);
    try {
      const { error: rpcErr } = await op();
      if (rpcErr) {
        setError(rpcErr.message || 'Action failed.');
        return;
      }
      await load(0, false);
    } catch {
      setError('Action failed.');
    } finally {
      setActionKey(null);
    }
  };

  const snooze24h = (itemId: string) => {
    const until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    return runMutation(itemId, async () =>
      supabase.rpc('snooze_action_inbox_item', {
        p_item_id: itemId,
        p_snoozed_until: until,
        p_actor_id: user!.id,
        p_region_id: REGION_ZERO,
      }),
    );
  };

  const resolveItem = (itemId: string) =>
    runMutation(itemId, async () =>
      supabase.rpc('set_action_inbox_status', {
        p_item_id: itemId,
        p_new_status: 'resolved',
        p_reason_code: 'resolved_by_founder',
        p_actor_id: user!.id,
        p_region_id: REGION_ZERO,
      }),
    );

  const dismissItem = (itemId: string) =>
    runMutation(itemId, async () =>
      supabase.rpc('set_action_inbox_status', {
        p_item_id: itemId,
        p_new_status: 'dismissed',
        p_reason_code: 'dismissed_by_founder',
        p_actor_id: user!.id,
        p_region_id: REGION_ZERO,
      }),
    );

  const assignToMe = (itemId: string) =>
    runMutation(itemId, async () =>
      supabase.rpc('assign_action_inbox_item', {
        p_item_id: itemId,
        p_assign_to: user!.id,
        p_actor_id: user!.id,
        p_region_id: REGION_ZERO,
      }),
    );

  if (!user) {
    return (
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '18px 16px 28px' }}>
        <h1 style={{ margin: 0, fontSize: 22, color: '#111827' }}>Decision Queue</h1>
        <p style={{ marginTop: 12, fontSize: 13, color: '#6b7280' }}>Sign in to view founder queue items.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: '18px 16px 28px' }}>
      <h1 style={{ margin: 0, fontSize: 22, color: '#111827' }}>Decision Queue</h1>
      <p style={{ margin: '8px 0 14px', fontSize: 13, color: '#4b5563', lineHeight: 1.5 }}>
        Curated items that need founder review. Actions are attributed to your signed-in account.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <label style={{ fontSize: 12, color: '#374151', display: 'flex', alignItems: 'center', gap: 8 }}>
            Status
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: 12, color: '#374151', display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={assignedToMeOnly}
              onChange={(e) => setAssignedToMeOnly(e.target.checked)}
            />
            Assigned to me
          </label>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <label style={{ fontSize: 12, color: '#374151', display: 'flex', alignItems: 'center', gap: 8 }}>
            Feature id
            <input
              type="text"
              value={featureFilter}
              onChange={(e) => setFeatureFilter(e.target.value)}
              placeholder="e.g. governance"
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, minWidth: 160 }}
            />
          </label>
          <label style={{ fontSize: 12, color: '#374151', display: 'flex', alignItems: 'center', gap: 8 }}>
            Incident id
            <input
              type="text"
              value={incidentFilter}
              onChange={(e) => setIncidentFilter(e.target.value)}
              placeholder="UUID"
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, minWidth: 220 }}
            />
          </label>
        </div>
        {incidentFilter.trim().length > 0 &&
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(incidentFilter.trim()) ? (
          <p style={{ fontSize: 12, color: '#b45309', margin: 0 }}>Incident id must be a valid UUID to filter.</p>
        ) : null}
      </div>

      {error ? (
        <p role="alert" style={{ fontSize: 13, color: '#b91c1c', marginBottom: 12 }}>
          {error}
        </p>
      ) : null}

      {loading && items.length === 0 ? (
        <p style={{ fontSize: 13, color: '#6b7280' }}>Loading queue...</p>
      ) : items.length === 0 ? (
        <p style={{ fontSize: 13, color: '#6b7280' }}>No items match this filter.</p>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map((item) => {
              const id = String(item.item_id ?? '');
              const busy = actionKey === id;
              return (
                <div
                  key={id}
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: 10,
                    padding: '12px 14px',
                    background: 'white',
                  }}
                >
                  <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: '#111827' }}>
                    {item.title || 'Action item'}
                  </p>
                  <p style={{ margin: '0 0 8px', fontSize: 12, color: '#4b5563', lineHeight: 1.5 }}>
                    {item.body || item.next_step_hint || 'Review and decide next action.'}
                  </p>
                  <p style={{ margin: '0 0 10px', fontSize: 11, color: '#6b7280' }}>
                    Priority: {String(item.priority || 'unknown')} · Status: {String(item.status || 'open')}
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => snooze24h(id)}
                      style={btnStyle}
                    >
                      Snooze 24h
                    </button>
                    <button type="button" disabled={busy} onClick={() => assignToMe(id)} style={btnStyle}>
                      Assign to me
                    </button>
                    <button type="button" disabled={busy} onClick={() => resolveItem(id)} style={btnStyle}>
                      Resolve
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => dismissItem(id)}
                      style={{ ...btnStyle, background: '#f9fafb', color: '#374151' }}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {hasMore ? (
            <button
              type="button"
              style={{ ...btnStyle, marginTop: 14, background: '#f3f4f6', color: '#111827' }}
              onClick={() => load(offset, true)}
              disabled={loadingMore}
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}

const btnStyle: import('react').CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  padding: '6px 12px',
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  background: '#1A2B4A',
  color: 'white',
  cursor: 'pointer',
};
