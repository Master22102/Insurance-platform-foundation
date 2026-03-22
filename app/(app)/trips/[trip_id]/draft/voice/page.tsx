'use client';

import { useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSpeechCapture } from '@/lib/speech/useSpeechCapture';
import { supabase } from '@/lib/auth/supabase-client';
import DraftHomeStepShell from '@/components/draft-home/DraftHomeStepShell';
import { useAuth } from '@/lib/auth/auth-context';
import { ensureTripDraftVersion } from '@/lib/draft-home/draft-home-api';

function parseNarration(text: string) {
  const result = { name: '', destination: '', departureDate: '', returnDate: '', travelMode: 'air' as string };
  const destMatch = text.match(/(?:trip to|going to|visiting|traveling to|travel to|in)\s+([A-Z][a-z]+(?:[\s,]+[A-Za-z]+)*)/i);
  if (destMatch) result.destination = destMatch[1].replace(/\s*,\s*$/, '').trim();

  const months: Record<string, string> = {
    jan: '01',
    feb: '02',
    mar: '03',
    apr: '04',
    may: '05',
    jun: '06',
    jul: '07',
    aug: '08',
    sep: '09',
    oct: '10',
    nov: '11',
    dec: '12',
    january: '01',
    february: '02',
    march: '03',
    april: '04',
    june: '06',
    july: '07',
    august: '08',
    september: '09',
    october: '10',
    november: '11',
    december: '12',
  };

  const datePattern =
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?/gi;

  const foundDates: string[] = [];
  let dateMatch: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((dateMatch = datePattern.exec(text)) !== null) {
    const month = months[dateMatch[1].toLowerCase()];
    const day = dateMatch[2].padStart(2, '0');
    const year = dateMatch[3] || new Date().getFullYear().toString();
    foundDates.push(`${year}-${month}-${day}`);
  }

  if (foundDates[0]) result.departureDate = foundDates[0];
  if (foundDates[1]) result.returnDate = foundDates[1];

  if (/\bfly|flying|flight|airline|airport\b/i.test(text)) result.travelMode = 'air';
  else if (/\btrain|rail|amtrak|eurostar\b/i.test(text)) result.travelMode = 'rail';
  else if (/\bcruise|ship|ferry|sailing\b/i.test(text)) result.travelMode = 'sea';
  else if (/\bdrive|driving|road\b/i.test(text)) result.travelMode = 'road';

  if (result.destination) {
    const year = result.departureDate ? result.departureDate.slice(0, 4) : '';
    result.name = year ? `${result.destination} ${year}` : `Trip to ${result.destination}`;
  }

  return result;
}

export default function VoiceNarrationInterfacePage() {
  const params = useParams();
  const tripId = params?.trip_id as string;
  const router = useRouter();
  const { user } = useAuth();

  const [narrationText, setNarrationText] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const { supported, status, error: micError, start, stop, reset } = useSpeechCapture({
    maxDurationMs: 5 * 60 * 1000,
    onTranscript: (text) => {
      const t = text.trim();
      if (!t) return;
      setNarrationText(t);
    },
    onError: (message) => setError(message),
  });

  const micLabel = useMemo(() => {
    if (!supported) return 'Microphone not supported';
    if (status === 'listening') return 'Stop microphone capture';
    return 'Tap to start microphone capture';
  }, [supported, status]);

  const canConfirm = narrationText.trim().length > 0 && Boolean(user);

  async function handleConfirm() {
    if (!user) return;
    setError('');
    const t = narrationText.trim();
    if (!t) {
      setError('Please narrate or type details before confirming.');
      return;
    }

    const parsed = parseNarration(t);
    if (!parsed.name && !parsed.destination) {
      setError('I couldn’t detect your destination/dates. Please add “from / to / dates” in your narration.');
      return;
    }

    setSaving(true);
    try {
      const { data, error: rpcError } = await supabase.rpc('update_trip', {
        p_trip_id: tripId,
        p_trip_name: parsed.name || 'Trip',
        p_destination_summary: parsed.destination || null,
        p_departure_date: parsed.departureDate || null,
        p_return_date: parsed.returnDate || null,
        p_travel_mode_primary: parsed.travelMode || 'air',
      });

      if (rpcError || !data?.success) {
        setError(rpcError?.message || data?.error || 'Failed to save trip details.');
        return;
      }

      // Persist narration into Draft Home draft version.
      const draftRes = await ensureTripDraftVersion({
        tripId,
        actorId: user.id,
        draftState: 'initial_capture',
        narrationText: t,
      });
      if (!draftRes?.success) {
        setError(draftRes?.error || 'Failed to save Draft Home narration.');
        return;
      }

      router.push(`/trips/${tripId}/draft/route`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <DraftHomeStepShell
      screenId="S-DRAFT-002"
      tripId={tripId}
      title="Voice narration"
      step={2}
      total={6}
      backHref={`/trips/${tripId}/draft`}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 16px' }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1A2B4A' }}>Tell us about your trip</p>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#666', lineHeight: 1.6 }}>
            Example: “I’m flying from NYC to Paris on June 10, and returning June 20.”
          </p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#444' }}>Microphone</label>
            <button
              type="button"
              aria-label="Microphone"
              onClick={() => {
                setError('');
                if (!supported) return;
                if (status === 'listening') {
                  stop();
                } else {
                  reset();
                  start();
                }
              }}
              title={micLabel}
              style={{
                width: 46,
                height: 46,
                borderRadius: 999,
                border: status === 'listening' ? '1px solid #fecaca' : '1px solid #dbeafe',
                background: status === 'listening' ? '#fee2e2' : '#eff6ff',
                cursor: supported ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 14a3 3 0 003-3V5a3 3 0 10-6 0v6a3 3 0 003 3z"
                  stroke={status === 'listening' ? '#b91c1c' : '#1e40af'}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <path
                  d="M19 11a7 7 0 01-14 0"
                  stroke={status === 'listening' ? '#b91c1c' : '#1e40af'}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          {micError || error ? (
            <p style={{ margin: '10px 0 0', fontSize: 12, color: '#dc2626' }}>{micError || error}</p>
          ) : null}

          <div style={{ marginTop: 12 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#444', marginBottom: 6 }}>
              Itinerary text
            </label>
            <textarea
              value={narrationText}
              onChange={(e) => setNarrationText(e.target.value)}
              rows={5}
              style={{
                width: '100%',
                border: '1px solid #ddd',
                borderRadius: 10,
                padding: '10px 12px',
                fontSize: 13,
                fontFamily: 'system-ui, -apple-system, sans-serif',
                outline: 'none',
                resize: 'vertical',
              }}
              placeholder="Type or speak your itinerary..."
            />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!canConfirm || saving}
              style={{
                flex: 1,
                padding: '11px 0',
                background: !canConfirm || saving ? '#93afd4' : '#1A2B4A',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 800,
                cursor: !canConfirm || saving ? 'not-allowed' : 'pointer',
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            >
              {saving ? 'Saving…' : 'Confirm & continue'}
            </button>
          </div>
        </div>

        <p style={{ margin: 0, fontSize: 12, color: '#9ca3af', lineHeight: 1.6 }}>
          This voice step currently saves your trip destination + dates. Route legs are built in the next screen.
        </p>
      </div>
    </DraftHomeStepShell>
  );
}

