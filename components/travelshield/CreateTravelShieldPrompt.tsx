'use client';

import { useState } from 'react';
import CreateGroupSheet from './CreateGroupSheet';

/** `YYYY-MM-DD` from trip row — compare as calendar dates in local time (avoid UTC midnight vs "tomorrow" bugs). */
function parseYmdString(s: unknown): string | null {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(s.trim())) return null;
  return s.trim().slice(0, 10);
}

function todayYmdLocal(): string {
  const n = new Date();
  const y = n.getFullYear();
  const m = String(n.getMonth() + 1).padStart(2, '0');
  const d = String(n.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function CreateTravelShieldPrompt({
  tripId,
  departureDate,
  returnDate,
  onCreated,
}: {
  tripId: string;
  departureDate: unknown;
  returnDate: unknown;
  onCreated?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const today = todayYmdLocal();
  const depY = parseYmdString(departureDate);
  const retY = parseYmdString(returnDate);

  if (!depY && !retY) return null;
  if (retY && retY < today) return null;

  const preTrip = Boolean(depY && depY > today);
  const inTrip = Boolean(depY && depY <= today && (!retY || retY >= today));

  if (!preTrip && !inTrip) return null;

  return (
    <>
      <div
        data-testid="travelshield-create-prompt"
        style={{
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: 12,
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div>
          <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: '#1e3a8a' }}>Travel safer together</p>
          <p style={{ margin: 0, fontSize: 12, color: '#475569', lineHeight: 1.45 }}>
            Form a private TravelShield group with QR or link — no usernames. Your settings stay yours.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            border: 'none',
            borderRadius: 10,
            padding: '10px 16px',
            background: '#1e3a8a',
            color: 'white',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Create TravelShield group
        </button>
      </div>
      <CreateGroupSheet
        open={open}
        onClose={() => setOpen(false)}
        tripId={tripId}
        onGroupCreated={() => {
          setOpen(false);
          onCreated?.();
        }}
      />
    </>
  );
}
