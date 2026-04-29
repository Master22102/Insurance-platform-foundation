'use client';

import type { CSSProperties, FormEvent } from 'react';
import type { ActivityZoneToggles } from '@/lib/presence/alert-engine';

export type PresenceSettingsForm = {
  enabled: boolean;
  activity_zones_enabled: boolean;
  border_crossings_enabled: boolean;
  missed_connection_enabled: boolean;
  risk_alerts_enabled: boolean;
  daily_summary_enabled: boolean;
  daily_summary_time: string;
  snooze_default_hours: number;
  activity_zone_toggles: ActivityZoneToggles;
};

export default function PresenceSettingsSheet({
  open,
  onClose,
  initial,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  initial: PresenceSettingsForm;
  onSave: (next: PresenceSettingsForm) => Promise<void> | void;
}) {
  if (!open) return null;

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const toggles: ActivityZoneToggles = {
      ski_resorts: formData.get('ski_resorts') === 'on',
      dive_centers: formData.get('dive_centers') === 'on',
      climbing_areas: formData.get('climbing_areas') === 'on',
      motorbike_rental: formData.get('motorbike_rental') === 'on',
      water_sports: formData.get('water_sports') === 'on',
      high_altitude: formData.get('high_altitude') === 'on',
    };
    await onSave({
      enabled: formData.get('enabled') === 'on',
      activity_zones_enabled: formData.get('activity_zones_enabled') === 'on',
      border_crossings_enabled: formData.get('border_crossings_enabled') === 'on',
      missed_connection_enabled: formData.get('missed_connection_enabled') === 'on',
      risk_alerts_enabled: formData.get('risk_alerts_enabled') === 'on',
      daily_summary_enabled: formData.get('daily_summary_enabled') === 'on',
      daily_summary_time: String(formData.get('daily_summary_time') || '20:00'),
      snooze_default_hours: Number(formData.get('snooze_default_hours') || 2),
      activity_zone_toggles: toggles,
    });
    onClose();
  };

  const t = initial.activity_zone_toggles || {};

  return (
    <div
      data-testid="presence-settings-sheet"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.45)',
        zIndex: 1200,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: 16,
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Trip Presence settings"
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'white',
          borderRadius: 16,
          padding: 20,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Trip Presence settings</p>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              background: '#f1f5f9',
              borderRadius: 8,
              padding: '6px 10px',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            Close
          </button>
        </div>

        <form onSubmit={(ev) => void submit(ev)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            <label style={lab}>
              <input type="checkbox" name="enabled" defaultChecked={initial.enabled} /> Master: Trip Presence Mode
            </label>
            <label style={lab}>
              <input type="checkbox" name="activity_zones_enabled" defaultChecked={initial.activity_zones_enabled} />{' '}
              Activity zones
            </label>
            <label style={lab}>
              <input type="checkbox" name="border_crossings_enabled" defaultChecked={initial.border_crossings_enabled} />{' '}
              Border crossings
            </label>
            <label style={lab}>
              <input type="checkbox" name="missed_connection_enabled" defaultChecked={initial.missed_connection_enabled} />{' '}
              Missed connection
            </label>
            <label style={lab}>
              <input type="checkbox" name="risk_alerts_enabled" defaultChecked={initial.risk_alerts_enabled} /> Risk alerts
            </label>
            <label style={lab}>
              <input type="checkbox" name="daily_summary_enabled" defaultChecked={initial.daily_summary_enabled} /> Daily summary
            </label>
          </div>

          <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 800, color: '#334155' }}>Activity sub-toggles</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            <label style={lab}>
              <input type="checkbox" name="ski_resorts" defaultChecked={t.ski_resorts !== false} /> Ski resorts
            </label>
            <label style={lab}>
              <input type="checkbox" name="dive_centers" defaultChecked={t.dive_centers !== false} /> Dive centers
            </label>
            <label style={lab}>
              <input type="checkbox" name="climbing_areas" defaultChecked={t.climbing_areas !== false} /> Climbing areas
            </label>
            <label style={lab}>
              <input type="checkbox" name="motorbike_rental" defaultChecked={t.motorbike_rental !== false} /> Motorbike rental
            </label>
            <label style={lab}>
              <input type="checkbox" name="water_sports" defaultChecked={t.water_sports !== false} /> Water sports
            </label>
            <label style={lab}>
              <input type="checkbox" name="high_altitude" defaultChecked={t.high_altitude !== false} /> High altitude
            </label>
          </div>

          <label style={{ ...lab, display: 'block', marginBottom: 12 }}>
            Daily summary time (local)
            <input
              type="time"
              name="daily_summary_time"
              defaultValue={(initial.daily_summary_time || '20:00:00').slice(0, 5)}
              style={{ marginLeft: 8, padding: 6, borderRadius: 6, border: '1px solid #cbd5e1' }}
            />
          </label>

          <label style={{ ...lab, display: 'block', marginBottom: 16 }}>
            Default snooze (hours)
            <select
              name="snooze_default_hours"
              defaultValue={String(initial.snooze_default_hours || 2)}
              style={{ marginLeft: 8, padding: 6, borderRadius: 6, border: '1px solid #cbd5e1' }}
            >
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="4">4</option>
              <option value="8">8</option>
            </select>
          </label>

          <button
            type="submit"
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 10,
              border: 'none',
              background: '#1e3a8a',
              color: 'white',
              fontWeight: 800,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Save settings
          </button>
        </form>
      </div>
    </div>
  );
}

const lab: CSSProperties = { fontSize: 13, color: '#334155', display: 'flex', alignItems: 'center', gap: 8 };
