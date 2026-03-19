'use client';

import { useEffect, useMemo, useState } from 'react';

interface NotificationSettings {
  primary_ops_email: string;
  backup_emails: string[];
  weekly_digest_enabled: boolean;
  incident_alerts_enabled: boolean;
}

export default function FoclNotificationSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const [primaryOpsEmail, setPrimaryOpsEmail] = useState('');
  const [backupEmailsRaw, setBackupEmailsRaw] = useState('');
  const [weeklyDigestEnabled, setWeeklyDigestEnabled] = useState(true);
  const [incidentAlertsEnabled, setIncidentAlertsEnabled] = useState(true);
  const [initial, setInitial] = useState<NotificationSettings | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/focl/notification-settings', { method: 'GET' });
        if (!res.ok) throw new Error('Unable to load notification settings.');
        const data = await res.json();
        if (cancelled) return;
        const settings = data.settings as NotificationSettings;
        setPrimaryOpsEmail(settings.primary_ops_email || '');
        setBackupEmailsRaw((settings.backup_emails || []).join(', '));
        setWeeklyDigestEnabled(Boolean(settings.weekly_digest_enabled));
        setIncidentAlertsEnabled(Boolean(settings.incident_alerts_enabled));
        setInitial(settings);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load settings.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const normalizedBackupEmails = useMemo(
    () => backupEmailsRaw.split(',').map((s) => s.trim()).filter(Boolean),
    [backupEmailsRaw],
  );

  const dirty = useMemo(() => {
    if (!initial) return true;
    return (
      primaryOpsEmail !== initial.primary_ops_email ||
      normalizedBackupEmails.join('|') !== (initial.backup_emails || []).join('|') ||
      weeklyDigestEnabled !== initial.weekly_digest_enabled ||
      incidentAlertsEnabled !== initial.incident_alerts_enabled
    );
  }, [initial, primaryOpsEmail, normalizedBackupEmails, weeklyDigestEnabled, incidentAlertsEnabled]);

  async function save() {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const res = await fetch('/api/focl/notification-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primary_ops_email: primaryOpsEmail,
          backup_emails: normalizedBackupEmails,
          weekly_digest_enabled: weeklyDigestEnabled,
          incident_alerts_enabled: incidentAlertsEnabled,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Failed to save settings.');
      setSaved(true);
      setInitial({
        primary_ops_email: primaryOpsEmail,
        backup_emails: normalizedBackupEmails,
        weekly_digest_enabled: weeklyDigestEnabled,
        incident_alerts_enabled: incidentAlertsEnabled,
      });
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">FOCL Notification Destinations</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Configure the dedicated operations email and backup personal emails for founder alerts.
          </p>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-5 space-y-5">
          {loading && <p className="text-sm text-neutral-500">Loading settings...</p>}
          {!loading && (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-neutral-700" htmlFor="primary-ops-email">
                  Primary operations email (website-dedicated)
                </label>
                <input
                  id="primary-ops-email"
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  value={primaryOpsEmail}
                  onChange={(e) => setPrimaryOpsEmail(e.target.value)}
                  placeholder="ops@yourdomain.com"
                  type="email"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-neutral-700" htmlFor="backup-emails">
                  Backup personal emails (comma-separated)
                </label>
                <textarea
                  id="backup-emails"
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  value={backupEmailsRaw}
                  onChange={(e) => setBackupEmailsRaw(e.target.value)}
                  placeholder="you@gmail.com, you@outlook.com"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    checked={weeklyDigestEnabled}
                    onChange={(e) => setWeeklyDigestEnabled(e.target.checked)}
                  />
                  Send weekly FOCL digest emails
                </label>
                <label className="flex items-center gap-2 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    checked={incidentAlertsEnabled}
                    onChange={(e) => setIncidentAlertsEnabled(e.target.checked)}
                  />
                  Send high-priority incident alert emails
                </label>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}
              {saved && <p className="text-sm text-emerald-600">Notification settings saved.</p>}

              <button
                type="button"
                disabled={saving || !dirty}
                onClick={save}
                className="inline-flex items-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save settings'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
