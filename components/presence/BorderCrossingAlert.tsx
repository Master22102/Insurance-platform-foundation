'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

export type CountryInfoPayload = {
  country: {
    country_code: string;
    country_name: string;
    flag_url: string;
    emergency_number?: string | null;
    ambulance_number?: string | null;
    police_number?: string | null;
    fire_number?: string | null;
    tipping_custom?: string | null;
    common_scams?: string | null;
    sim_note?: string | null;
    visa_note?: string | null;
    tap_water_safe?: boolean | null;
    driving_side?: string | null;
    practical_tips?: Array<{ tip_type?: string; tip_text?: string }>;
  };
  exchange: {
    label: string;
    rate: number;
    quote_currency: string;
    base_currency: string;
  } | null;
};

export default function BorderCrossingAlert({
  fromCountry,
  toCountry,
  coverageChanges,
  countryInfo,
  cellularOk,
  tripId,
  onDismiss,
  onSnooze,
  onOpenSettings,
}: {
  fromCountry: string | null;
  toCountry: string;
  coverageChanges: { title: string; detail: string; citation: string }[];
  countryInfo: CountryInfoPayload | null;
  cellularOk: boolean;
  tripId: string;
  onDismiss: () => void;
  onSnooze: (mode: '2h' | 'rest_of_day' | 'trip') => void;
  onOpenSettings: () => void;
}) {
  const [expanded, setExpanded] = useState(coverageChanges.length <= 2);
  const flagUrl =
    countryInfo?.country.flag_url || `https://flagcdn.com/w40/${toCountry.toLowerCase()}.png`;

  const emergencyRows = useMemo(() => {
    const c = countryInfo?.country;
    if (!c) return [];
    const rows: { label: string; value: string }[] = [];
    if (c.emergency_number) rows.push({ label: 'General emergency', value: c.emergency_number });
    if (c.ambulance_number) rows.push({ label: 'Ambulance / medical', value: c.ambulance_number });
    if (c.police_number) rows.push({ label: 'Police', value: c.police_number });
    if (c.fire_number) rows.push({ label: 'Fire', value: c.fire_number });
    return rows;
  }, [countryInfo]);

  const saveOffline = () => {
    try {
      const key = `wayfarer_emergency_${toCountry}`;
      localStorage.setItem(
        key,
        JSON.stringify({
          savedAt: new Date().toISOString(),
          rows: emergencyRows,
          scams: countryInfo?.country.common_scams,
          tipping: countryInfo?.country.tipping_custom,
        }),
      );
    } catch {
      /* ignore */
    }
  };

  const n = coverageChanges.length;
  const summaryLine =
    n >= 3 ? `${n} coverage changes — View details` : `${n} coverage change${n === 1 ? '' : 's'}`;

  return (
    <div
      data-testid="presence-border-crossing-alert"
      style={{
        borderRadius: 12,
        border: '1px solid #93c5fd',
        overflow: 'hidden',
        background: '#eff6ff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 14px',
          background: 'linear-gradient(90deg, #3b82f6 0%, #1d4ed8 100%)',
          color: 'white',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={flagUrl} alt="" width={40} height={27} style={{ borderRadius: 4, objectFit: 'cover' }} />
        <div>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, opacity: 0.9 }}>BORDER CROSSING</p>
          <p style={{ margin: '4px 0 0', fontSize: 16, fontWeight: 800 }}>
            Welcome to {countryInfo?.country.country_name || toCountry}
          </p>
          {fromCountry ? (
            <p style={{ margin: '4px 0 0', fontSize: 12, opacity: 0.9 }}>
              From {fromCountry} → {toCountry}
            </p>
          ) : null}
        </div>
      </div>

      <div style={{ padding: '14px 16px' }}>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          style={{
            width: '100%',
            textAlign: 'left',
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid #bfdbfe',
            background: 'white',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            marginBottom: 10,
          }}
        >
          {summaryLine}
        </button>
        {expanded && (
          <ul style={{ margin: '0 0 12px', paddingLeft: 18, color: '#1e293b', fontSize: 12 }}>
            {coverageChanges.map((ch, i) => (
              <li key={i} style={{ marginBottom: 6 }}>
                <strong>{ch.title}</strong> — {ch.detail}{' '}
                <span style={{ color: '#64748b' }}>({ch.citation})</span>
              </li>
            ))}
          </ul>
        )}

        <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 800, color: '#1e3a8a' }}>Emergency numbers</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {emergencyRows.length === 0 ? (
            <p style={{ fontSize: 12, color: '#64748b' }}>Reference data loading…</p>
          ) : (
            emergencyRows.map((r) => (
              <div
                key={r.label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '8px 10px',
                  background: 'white',
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  fontSize: 12,
                }}
              >
                <span style={{ color: '#475569' }}>{r.label}</span>
                <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{r.value}</strong>
              </div>
            ))
          )}
        </div>

        <div
          style={{
            padding: '12px 12px',
            borderRadius: 10,
            background: 'white',
            border: '1px solid #bfdbfe',
            marginBottom: 12,
          }}
        >
          <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 800, color: '#1e3a8a' }}>Practical info</p>
          {countryInfo?.exchange ? (
            <p style={{ margin: '0 0 6px', fontSize: 12, color: '#334155' }}>
              <strong>Exchange:</strong> {countryInfo.exchange.label}
            </p>
          ) : null}
          {countryInfo?.country.tipping_custom ? (
            <p style={{ margin: '0 0 6px', fontSize: 12, color: '#334155' }}>
              <strong>Tipping:</strong> {countryInfo.country.tipping_custom}
            </p>
          ) : null}
          {countryInfo?.country.common_scams ? (
            <p style={{ margin: '0 0 6px', fontSize: 12, color: '#334155' }}>
              <strong>Common scams:</strong> {countryInfo.country.common_scams}
            </p>
          ) : null}
          {countryInfo?.country.sim_note ? (
            <p style={{ margin: '0 0 6px', fontSize: 12, color: '#334155' }}>
              <strong>SIM:</strong> {countryInfo.country.sim_note}
            </p>
          ) : null}
          {!cellularOk ? (
            <div
              style={{
                marginTop: 8,
                padding: '8px 10px',
                borderRadius: 8,
                background: '#fffbeb',
                border: '1px solid #fcd34d',
                fontSize: 12,
                color: '#92400e',
              }}
            >
              <strong>No cellular data detected</strong> — Wi‑Fi or offline mode may limit real-time alerts.{' '}
              <Link href="/account" style={{ fontWeight: 700, color: '#b45309' }}>
                View eSIM and SIM options
              </Link>
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          <button
            type="button"
            onClick={saveOffline}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #1e3a8a',
              background: '#1e3a8a',
              color: 'white',
              fontWeight: 600,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Save emergency info offline
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button
            type="button"
            onClick={onDismiss}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              background: 'white',
              fontWeight: 600,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Dismiss
          </button>
          <button
            type="button"
            onClick={() => onSnooze('2h')}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              background: 'white',
              fontWeight: 600,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Snooze 2h
          </button>
          <button
            type="button"
            onClick={() => onSnooze('rest_of_day')}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              background: 'white',
              fontWeight: 600,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Rest of day
          </button>
          <button
            type="button"
            onClick={() => onSnooze('trip')}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              background: 'white',
              fontWeight: 600,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            This trip
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #1e3a8a',
              background: '#dbeafe',
              color: '#1e3a8a',
              fontWeight: 600,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Settings
          </button>
        </div>
        <p style={{ margin: '12px 0 0', fontSize: 11, color: '#64748b' }}>
          Saved to trip log for documentation when you acknowledge alerts from Trip Presence.
        </p>
        <Link href={`/trips/${tripId}?tab=Coverage`} style={{ display: 'inline-block', marginTop: 8, fontSize: 12, fontWeight: 700 }}>
          Coverage tab →
        </Link>
      </div>
    </div>
  );
}
