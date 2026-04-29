'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import {
  DEFAULT_NOTIFICATION_PREFS,
  NOTIFICATION_CATEGORIES,
  mergeNotificationPrefs,
  type NotificationPrefs,
} from '@/lib/notifications/prefs';
import { subscribeToPush, unsubscribeFromPush } from '@/lib/notifications/push-client';
import AppPageRoot from '@/components/layout/AppPageRoot';

const CATEGORY_LABELS: Record<string, string> = {
  travelshield_checkin: 'TravelShield check-in',
  travelshield_emergency: 'TravelShield emergency',
  presence_alert: 'Trip Presence alerts',
  presence_border: 'Border crossing',
  filing_deadline: 'Filing deadlines',
  coverage_gap: 'Coverage gaps',
  disruption_detected: 'Disruptions',
  evidence_reminder: 'Evidence reminders',
  system_announcement: 'System announcements',
  trip_update: 'Trip updates',
};

export default function NotificationPreferencesPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushMsg, setPushMsg] = useState('');

  const load = useCallback(async () => {
    const res = await fetch('/api/notifications/preferences', { credentials: 'include' });
    if (res.ok) {
      const j = (await res.json()) as { notifications?: unknown };
      setPrefs(mergeNotificationPrefs(j.notifications));
    } else {
      const raw =
        profile?.preferences && typeof profile.preferences === 'object'
          ? (profile.preferences as Record<string, unknown>).notifications
          : undefined;
      setPrefs(mergeNotificationPrefs(raw));
    }
    setLoading(false);
  }, [profile?.preferences]);

  useEffect(() => {
    void load();
  }, [load]);

  const persist = async (next: NotificationPrefs) => {
    if (!user) return;
    setSaving(true);
    const res = await fetch('/api/notifications/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ notifications: next }),
    });
    setSaving(false);
    if (res.ok) {
      const j = (await res.json()) as { notifications: NotificationPrefs };
      setPrefs(j.notifications);
      await refreshProfile();
    }
  };

  const toggleMaster = (key: 'push_enabled' | 'email_enabled' | 'sms_enabled') => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    void persist(next);
  };

  const toggleCatChannel = (cat: string, ch: 'push' | 'email' | 'sms') => {
    const row = { ...(prefs.categories[cat] || { push: false, email: false, sms: false }) };
    row[ch] = !row[ch];
    const next = {
      ...prefs,
      categories: { ...prefs.categories, [cat]: row },
    };
    setPrefs(next);
    void persist(next);
  };

  return (
    <AppPageRoot style={{ maxWidth: 720, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <Link href="/account" style={{ fontSize: 13, color: '#1d4ed8', textDecoration: 'none' }}>
        ← Account
      </Link>
      <h1 style={{ fontSize: 22, margin: '16px 0 8px', color: '#0f172a' }}>Notifications</h1>
      <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5, marginBottom: 24 }}>
        Opt in per channel and category. Nothing is sent until you enable it here. Push uses the Web Push standard (VAPID).
      </p>

      {loading ? <p style={{ color: '#64748b' }}>Loading…</p> : null}

      <section
        style={{
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: 16,
          marginBottom: 20,
          background: '#fff',
        }}
      >
        <h2 style={{ fontSize: 14, margin: '0 0 12px', color: '#334155' }}>Channels</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(
            [
              ['push_enabled', 'Push notifications'],
              ['email_enabled', 'Email'],
              ['sms_enabled', 'SMS (requires phone below)'],
            ] as const
          ).map(([k, label]) => (
            <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={prefs[k]}
                disabled={saving}
                onChange={() => toggleMaster(k)}
              />
              {label}
            </label>
          ))}
        </div>
        <div style={{ marginTop: 14 }}>
          <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>SMS phone (E.164)</label>
          <input
            type="tel"
            value={prefs.sms_phone_e164 || ''}
            disabled={saving}
            placeholder="+15551234567"
            onChange={(e) => setPrefs({ ...prefs, sms_phone_e164: e.target.value })}
            onBlur={() => persist({ ...prefs })}
            style={{ width: '100%', maxWidth: 320, padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1' }}
          />
        </div>
        <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            data-testid="notif-enable-push-device"
            disabled={saving}
            onClick={async () => {
              setPushMsg('');
              const r = await subscribeToPush();
              setPushMsg(r.ok ? 'Push subscription saved.' : r.error || 'Failed');
            }}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: 'none',
              background: '#1e3a8a',
              color: 'white',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Enable push on this device
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              setPushMsg('');
              const r = await unsubscribeFromPush();
              setPushMsg(r.ok ? 'Unsubscribed this device.' : r.error || 'Failed');
            }}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              background: 'white',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Remove this device
          </button>
        </div>
        {pushMsg ? <p style={{ marginTop: 10, fontSize: 12, color: '#475569' }}>{pushMsg}</p> : null}
      </section>

      <section style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, background: '#fff' }}>
        <h2 style={{ fontSize: 14, margin: '0 0 12px', color: '#334155' }}>Categories × channel</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#64748b' }}>
                <th style={{ padding: '8px 6px' }}>Category</th>
                <th style={{ padding: '8px 6px' }}>Push</th>
                <th style={{ padding: '8px 6px' }}>Email</th>
                <th style={{ padding: '8px 6px' }}>SMS</th>
              </tr>
            </thead>
            <tbody>
              {NOTIFICATION_CATEGORIES.map((cat) => {
                const row = prefs.categories[cat] || { push: false, email: false, sms: false };
                return (
                  <tr key={cat} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 6px', fontWeight: 500 }}>{CATEGORY_LABELS[cat] || cat}</td>
                    {(['push', 'email', 'sms'] as const).map((ch) => (
                      <td key={ch} style={{ padding: '10px 6px' }}>
                        <input
                          type="checkbox"
                          checked={row[ch]}
                          disabled={saving}
                          data-testid={`notif-cat-${cat}-${ch}`}
                          onChange={() => toggleCatChannel(cat, ch)}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {saving ? <p style={{ marginTop: 12, fontSize: 12, color: '#64748b' }}>Saving…</p> : null}
    </AppPageRoot>
  );
}
