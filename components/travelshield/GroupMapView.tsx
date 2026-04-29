'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

export type MemberLocation = {
  account_id: string;
  display_name: string;
  latitude: number | null;
  longitude: number | null;
  created_at: string | null;
  battery_level: number | null;
  connection_type: string | null;
  is_moving?: boolean | null;
};

function pinColor(ageMinutes: number, batteryLow: boolean): string {
  if (batteryLow) return '#64748b';
  if (ageMinutes <= 5) return '#16a34a';
  if (ageMinutes <= 30) return '#d97706';
  return '#94a3b8';
}

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    let cancelled = false;
    void import('leaflet').then((L) => {
      if (cancelled) return;
      const b = L.latLngBounds(positions);
      map.fitBounds(b, { padding: [48, 48], maxZoom: 14 });
    });
    return () => {
      cancelled = true;
    };
  }, [map, positions]);
  return null;
}

function CenterOnMeControl({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  return (
    <div style={{ position: 'absolute', bottom: 16, right: 16, zIndex: 500 }}>
      <button
        type="button"
        onClick={() => map.setView([lat, lng], 14)}
        style={{
          padding: '8px 12px',
          borderRadius: 8,
          border: '1px solid #cbd5e1',
          background: 'white',
          fontWeight: 600,
          fontSize: 12,
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        }}
      >
        Center on me
      </button>
    </div>
  );
}

export default function GroupMapView({
  members,
  onClose,
  centerMe,
  footer,
}: {
  members: MemberLocation[];
  onClose: () => void;
  centerMe?: { lat: number; lng: number } | null;
  footer?: ReactNode;
}) {
  const valid = useMemo(
    () =>
      members.filter(
        (m) => m.latitude != null && m.longitude != null && Number.isFinite(m.latitude) && Number.isFinite(m.longitude),
      ),
    [members],
  );

  const positions: [number, number][] = valid.map((m) => [m.latitude as number, m.longitude as number]);

  const defaultCenter: [number, number] = positions[0] ?? [20, 0];

  const [mapKey] = useState(() => `map-${Date.now()}`);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        background: 'rgba(15,23,42,0.45)',
        display: 'flex',
        flexDirection: 'column',
        padding: 12,
      }}
    >
      <div
        style={{
          margin: '0 auto',
          width: 'min(960px, 100%)',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: 'white',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid #e2e8f0' }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Live map</span>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'none', fontWeight: 600, cursor: 'pointer', color: '#1e3a8a' }}>
            Close
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 280, position: 'relative' }}>
          <MapContainer key={mapKey} center={defaultCenter} zoom={4} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
            <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {positions.length > 0 ? <FitBounds positions={positions} /> : null}
            {centerMe && Number.isFinite(centerMe.lat) && Number.isFinite(centerMe.lng) ? (
              <CenterOnMeControl lat={centerMe.lat} lng={centerMe.lng} />
            ) : null}
            {valid.map((m) => {
              const lat = m.latitude as number;
              const lng = m.longitude as number;
              const ageMs = m.created_at ? Date.now() - new Date(m.created_at).getTime() : 999999;
              const ageMin = ageMs / 60_000;
              const bat = m.battery_level;
              const batteryLow = bat != null && bat < 10;
              const color = pinColor(ageMin, batteryLow);
              const label = batteryLow ? 'Battery saver — last known location' : `${m.display_name}`;
              return (
                <CircleMarker key={m.account_id} center={[lat, lng]} radius={10} pathOptions={{ color, fillColor: color, fillOpacity: 0.85 }}>
                  <Popup>
                    <div style={{ minWidth: 160 }}>
                      <strong>{m.display_name}</strong>
                      <div style={{ fontSize: 12, marginTop: 6 }}>{label}</div>
                      {m.created_at ? (
                        <div style={{ fontSize: 11, color: '#64748b' }}>Updated {new Date(m.created_at).toLocaleString()}</div>
                      ) : null}
                      {bat != null ? <div style={{ fontSize: 11 }}>Battery: {bat}%</div> : null}
                      {m.connection_type ? <div style={{ fontSize: 11 }}>Network: {m.connection_type}</div> : null}
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>
        {footer ? (
          <div style={{ maxHeight: 200, overflowY: 'auto', padding: 12, borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>{footer}</div>
        ) : null}
      </div>
    </div>
  );
}
