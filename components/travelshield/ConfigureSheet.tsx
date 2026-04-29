'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/auth/supabase-client';
import { presetForTrustLevel, type TrustLevel } from '@/lib/travelshield/trust-presets';

type Props = {
  open: boolean;
  groupId: string;
  onClose: () => void;
  onActivated?: () => void;
};

export default function ConfigureSheet({ open, groupId, onClose, onActivated }: Props) {
  const [trustLevel, setTrustLevel] = useState<TrustLevel>('custom');
  const [checkInHours, setCheckInHours] = useState(2);
  const [lockCode, setLockCode] = useState('');
  const [deactivationRequiresCode, setDeactivationRequiresCode] = useState(false);
  const [durationType, setDurationType] = useState<'time_bounded' | 'until_itinerary_ends' | 'indefinite'>(
    'time_bounded',
  );
  const [durationHours, setDurationHours] = useState<number | ''>(48);
  const [emergencyId, setEmergencyId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<{ contact_id: string; name: string | null }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const { data } = await supabase
        .from('contacts')
        .select('contact_id, name')
        .eq('contact_type', 'emergency')
        .order('name', { ascending: true });
      setContacts(data ?? []);
    })();
  }, [open]);

  useEffect(() => {
    const p = presetForTrustLevel(trustLevel);
    setCheckInHours(p.check_in_interval_hours);
    setDeactivationRequiresCode(p.deactivation_requires_code);
    if (p.clear_lock_code) setLockCode('');
  }, [trustLevel]);

  if (!open) return null;

  const activate = async () => {
    setSaving(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        trust_level: trustLevel,
        check_in_interval_hours: checkInHours,
        deactivation_requires_code: deactivationRequiresCode,
        duration_type: durationType,
        activate: true,
      };
      if (durationType === 'time_bounded') {
        body.duration_hours = durationHours === '' ? 48 : Number(durationHours);
      } else {
        body.duration_hours = null;
      }
      body.emergency_contact_id = emergencyId;
      if (lockCode.trim().length >= 4) {
        body.lock_code = lockCode.trim();
      } else if (trustLevel === 'just_met') {
        body.lock_code = null;
      }

      const res = await fetch(`/api/travelshield/${groupId}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((j as { error?: string }).error || 'Could not save settings');
        setSaving(false);
        return;
      }
      onActivated?.();
      onClose();
    } catch {
      setError('Network error');
    }
    setSaving(false);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 190,
        background: 'rgba(15,23,42,0.45)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
      role="dialog"
      aria-modal
      aria-label="TravelShield settings"
    >
      <div
        style={{
          background: 'white',
          borderRadius: '20px 20px 0 0',
          width: '100%',
          maxWidth: 520,
          maxHeight: '90vh',
          overflow: 'auto',
          padding: '22px 20px 28px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Your safety settings</h2>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 22, color: '#94a3b8', cursor: 'pointer' }}>
            ×
          </button>
        </div>
        <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 16px', lineHeight: 1.5 }}>
          These apply only to you — partners configure their own check-ins, lock codes, and emergency contacts.
        </p>

        <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>Trust level</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {(
            [
              ['close_friend', 'Close friend', 'Longer check-in interval; optional lock; you may want a contact on file.'],
              ['just_met', 'Just met', 'Shorter check-in interval; no lock by default; contact optional.'],
              ['custom', 'Custom', 'Set everything manually.'],
            ] as const
          ).map(([id, title, help]) => (
            <label
              key={id}
              style={{
                display: 'flex',
                gap: 10,
                padding: 10,
                borderRadius: 10,
                border: trustLevel === id ? '2px solid #1e3a8a' : '1px solid #e2e8f0',
                cursor: 'pointer',
                alignItems: 'flex-start',
              }}
            >
              <input
                type="radio"
                name="trust"
                checked={trustLevel === id}
                onChange={() => setTrustLevel(id)}
                style={{ marginTop: 3 }}
              />
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>{title}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, lineHeight: 1.4 }}>{help}</div>
              </div>
            </label>
          ))}
        </div>

        <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>
          Check-in interval (hours)
        </label>
        <input
          type="number"
          min={1}
          max={168}
          value={checkInHours}
          onChange={(e) => setCheckInHours(Number(e.target.value) || 1)}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: 10,
            borderRadius: 8,
            border: '1px solid #e2e8f0',
            marginBottom: 8,
            fontSize: 14,
          }}
        />
        <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 14px' }}>
          How often you want reminder-style check-ins in Phase 2. Only affects your device.
        </p>

        <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>
          Lock code (optional, 4–32 chars)
        </label>
        <input
          type="password"
          autoComplete="new-password"
          value={lockCode}
          onChange={(e) => setLockCode(e.target.value)}
          placeholder="Leave empty for none"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: 10,
            borderRadius: 8,
            border: '1px solid #e2e8f0',
            marginBottom: 8,
            fontSize: 14,
          }}
        />
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, fontSize: 13, color: '#334155' }}>
          <input
            type="checkbox"
            checked={deactivationRequiresCode}
            onChange={(e) => setDeactivationRequiresCode(e.target.checked)}
          />
          Require lock code to leave TravelShield
        </label>

        <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>
          Duration
        </label>
        <select
          value={durationType}
          onChange={(e) => setDurationType(e.target.value as typeof durationType)}
          style={{
            width: '100%',
            padding: 10,
            borderRadius: 8,
            border: '1px solid #e2e8f0',
            marginBottom: 10,
            fontSize: 14,
          }}
        >
          <option value="time_bounded">Time bounded</option>
          <option value="until_itinerary_ends">Until itinerary ends</option>
          <option value="indefinite">Indefinite</option>
        </select>
        {durationType === 'time_bounded' && (
          <input
            type="number"
            min={1}
            placeholder="Hours"
            value={durationHours}
            onChange={(e) => setDurationHours(e.target.value === '' ? '' : Number(e.target.value))}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: 10,
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              marginBottom: 14,
              fontSize: 14,
            }}
          />
        )}

        <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>
          Emergency contact (from your saved contacts)
        </label>
        <select
          value={emergencyId ?? ''}
          onChange={(e) => setEmergencyId(e.target.value || null)}
          style={{
            width: '100%',
            padding: 10,
            borderRadius: 8,
            border: '1px solid #e2e8f0',
            marginBottom: 6,
            fontSize: 14,
          }}
        >
          <option value="">None</option>
          {contacts.map((c) => (
            <option key={c.contact_id} value={c.contact_id}>
              {c.name || 'Unnamed contact'}
            </option>
          ))}
        </select>
        <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 18px' }}>
          Not shown to other group members. Used in Phase 2 for escalation.
        </p>

        {error ? (
          <p style={{ color: '#b91c1c', fontSize: 13, margin: '0 0 10px' }}>{error}</p>
        ) : null}

        <button
          type="button"
          disabled={saving}
          onClick={() => void activate()}
          style={{
            width: '100%',
            padding: '14px 0',
            borderRadius: 10,
            border: 'none',
            background: saving ? '#94a3b8' : '#1e3a8a',
            color: 'white',
            fontWeight: 700,
            fontSize: 15,
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Saving…' : 'Activate TravelShield'}
        </button>
      </div>
    </div>
  );
}
