'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/auth/supabase-client';

type TripType = 'solo' | 'group';
type BuildMethod = 'narrate' | 'manual';
type Phase = 'type' | 'method' | 'details' | 'travelers' | 'creating' | 'done';

const TRAVEL_MODES = [
  { key: 'air', label: 'Air' },
  { key: 'rail', label: 'Rail' },
  { key: 'sea', label: 'Sea' },
  { key: 'road', label: 'Road' },
  { key: 'mixed', label: 'Mixed' },
];

const COUNTRY_LIST = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'JP', name: 'Japan' },
  { code: 'CN', name: 'China' },
  { code: 'IN', name: 'India' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' },
  { code: 'FI', name: 'Finland' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'AT', name: 'Austria' },
  { code: 'BE', name: 'Belgium' },
  { code: 'PT', name: 'Portugal' },
  { code: 'PL', name: 'Poland' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'HU', name: 'Hungary' },
  { code: 'GR', name: 'Greece' },
  { code: 'TR', name: 'Turkey' },
  { code: 'RU', name: 'Russia' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'EG', name: 'Egypt' },
  { code: 'IL', name: 'Israel' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'SG', name: 'Singapore' },
  { code: 'KR', name: 'South Korea' },
  { code: 'TH', name: 'Thailand' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'PH', name: 'Philippines' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'AR', name: 'Argentina' },
  { code: 'CL', name: 'Chile' },
  { code: 'CO', name: 'Colombia' },
];

function parseNarration(text: string) {
  const result = { name: '', destination: '', departureDate: '', returnDate: '', travelMode: 'air' };

  const destMatch = text.match(/(?:trip to|going to|visiting|traveling to|travel to|in)\s+([A-Z][a-z]+(?:[\s,]+[A-Za-z]+)*)/i);
  if (destMatch) result.destination = destMatch[1].replace(/\s*,\s*$/, '').trim();

  const months: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    january: '01', february: '02', march: '03', april: '04', june: '06',
    july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
  };

  const datePattern = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?/gi;
  const foundDates: string[] = [];
  let dateMatch;
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

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '10px 12px', fontSize: 14,
  border: '1px solid #ddd', borderRadius: 8,
  outline: 'none', color: '#111', background: 'white',
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 500,
  color: '#444', marginBottom: 6,
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{ height: 3, flex: 1, borderRadius: 2, background: i < step ? '#1A2B4A' : '#e5e7eb' }} />
      ))}
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 13, padding: 0, marginBottom: 20, fontFamily: 'system-ui, -apple-system, sans-serif', display: 'flex', alignItems: 'center', gap: 4 }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path d="M19 12H5M12 19l-7-7 7-7" stroke="#aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Back
    </button>
  );
}

export default function NewTripPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>('type');
  const [tripType, setTripType] = useState<TripType>('solo');
  const [buildMethod, setBuildMethod] = useState<BuildMethod>('manual');

  const [narrateText, setNarrateText] = useState('');
  const [narrateParsed, setNarrateParsed] = useState(false);

  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [travelMode, setTravelMode] = useState('air');

  const [travelers, setTravelers] = useState<{ name: string; nationality: string }[]>([{ name: '', nationality: 'US' }]);

  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [childAges, setChildAges] = useState<number[]>([]);
  const [homeBase, setHomeBase] = useState('');

  const [error, setError] = useState('');
  const [createdTripId, setCreatedTripId] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  function handleParseNarration() {
    if (!narrateText.trim()) return;
    const parsed = parseNarration(narrateText);
    setName(parsed.name || '');
    setDestination(parsed.destination || '');
    setDepartureDate(parsed.departureDate || '');
    setReturnDate(parsed.returnDate || '');
    setTravelMode(parsed.travelMode || 'air');
    setNarrateParsed(true);
    setPhase('details');
  }

  function handleReNarrate() {
    setNarrateParsed(false);
    setPhase('method');
  }

  async function handleCreate() {
    if (!name.trim()) { setError('Trip name is required.'); return; }
    if (departureDate && returnDate && new Date(returnDate) <= new Date(departureDate)) {
      setError('Return date must be after the departure date.');
      return;
    }
    setError('');
    setIsCreating(true);
    setPhase('creating');

    const travelersMetadata = tripType === 'group' ? travelers.filter((t) => t.name || t.nationality) : undefined;

    const metadata: any = {};
    if (travelersMetadata && travelersMetadata.length > 0) metadata.travelers = travelersMetadata;
    if (homeBase.trim()) metadata.home_base = homeBase.trim();
    metadata.composition = {
      adults,
      children,
      infants,
      child_ages: childAges,
    };

    const { data, error: rpcError } = await supabase.rpc('create_trip', {
      p_trip_name: name.trim(),
      p_account_id: user!.id,
      p_travel_mode_primary: travelMode,
      p_is_group_trip: tripType === 'group',
      p_actor_id: user!.id,
      p_idempotency_key: `create-trip-${user!.id}-${Date.now()}`,
      p_destination_summary: destination.trim() || null,
      p_departure_date: departureDate || null,
      p_return_date: returnDate || null,
      p_metadata: Object.keys(metadata).length > 0 ? metadata : null,
    });

    if (rpcError || !data?.success) {
      setError(data?.error || rpcError?.message || 'Something went wrong. Please try again.');
      setIsCreating(false);
      setPhase('details');
      return;
    }

    const newTripId = data.trip_id;

    // Persist composition fields directly (create_trip RPC does not accept these as first-class parameters)
    await supabase
      .from('trips')
      .update({
        adults_count: adults,
        children_count: children,
        infant_count: infants,
        child_ages: childAges.length > 0 ? childAges : null,
      })
      .eq('trip_id', newTripId)
      .eq('account_id', user!.id);

    // Mark anchor state as first_trip on first trip creation
    try {
      const { data: existing } = await supabase
        .from('account_anchor_state')
        .select('anchor_path')
        .eq('account_id', user!.id)
        .maybeSingle();
      if (!existing) {
        await supabase.rpc('upsert_anchor_state', {
          p_account_id: user!.id,
          p_anchor_path: 'first_trip',
        });
      }
    } catch {
      // non-fatal; anchor state is best-effort
    }

    setCreatedTripId(newTripId);
    setIsCreating(false);
    setPhase('done');
  }

  const stepMap: Record<Phase, number> = { type: 1, method: 2, details: 3, travelers: 3, creating: 3, done: 3 };
  const currentStep = stepMap[phase];

  return (
    <div style={{ maxWidth: 540, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ marginBottom: 24 }}>
        <Link href="/trips" style={{
          fontSize: 13, color: '#888', textDecoration: 'none',
          display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 16,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 19l-7-7 7-7" stroke="#aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to trips
        </Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A2B4A', margin: 0, letterSpacing: '-0.3px' }}>
          Plan a trip
        </h1>
      </div>

      <StepIndicator step={currentStep} total={3} />

      {phase === 'type' && (
        <div style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '28px 24px' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#444', margin: '0 0 16px' }}>Who is this trip for?</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {([
              { id: 'solo' as TripType, label: 'Solo trip', desc: 'Just you. Individual coverage and private itinerary.' },
              { id: 'group' as TripType, label: 'Group trip', desc: 'Shared itinerary with multiple travelers.' },
            ]).map((t) => (
              <button key={t.id} onClick={() => setTripType(t.id)} style={{
                padding: '16px 18px', background: tripType === t.id ? '#eff4fc' : '#f7f8fa',
                border: `1.5px solid ${tripType === t.id ? '#2E5FA3' : '#e5e7eb'}`,
                borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 14,
              }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  border: `2px solid ${tripType === t.id ? '#2E5FA3' : '#d1d5db'}`,
                  background: tripType === t.id ? '#2E5FA3' : 'white',
                  flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {tripType === t.id && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'white' }} />}
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#1A2B4A', margin: '0 0 2px' }}>{t.label}</p>
                  <p style={{ fontSize: 12, color: '#888', margin: 0 }}>{t.desc}</p>
                </div>
              </button>
            ))}
          </div>
          <button onClick={() => setPhase('method')} style={{
            width: '100%', padding: '11px 0', background: '#1A2B4A', color: 'white',
            border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>
            Continue
          </button>
        </div>
      )}

      {phase === 'method' && (
        <div style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '28px 24px' }}>
          <BackButton onClick={() => setPhase('type')} />
          <p style={{ fontSize: 13, fontWeight: 600, color: '#444', margin: '0 0 16px' }}>How do you want to start?</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {([
              { id: 'narrate' as BuildMethod, label: 'Describe your trip', desc: 'Type your itinerary in plain language and we\'ll fill in the details for you.' },
              { id: 'manual' as BuildMethod, label: 'Enter details manually', desc: 'Fill in trip name, destination, dates, and travel mode step by step.' },
            ]).map((m) => (
              <button key={m.id} onClick={() => setBuildMethod(m.id)} style={{
                padding: '16px 18px', background: buildMethod === m.id ? '#eff4fc' : '#f7f8fa',
                border: `1.5px solid ${buildMethod === m.id ? '#2E5FA3' : '#e5e7eb'}`,
                borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 14,
              }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  border: `2px solid ${buildMethod === m.id ? '#2E5FA3' : '#d1d5db'}`,
                  background: buildMethod === m.id ? '#2E5FA3' : 'white',
                  flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {buildMethod === m.id && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'white' }} />}
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#1A2B4A', margin: '0 0 2px' }}>{m.label}</p>
                  <p style={{ fontSize: 12, color: '#888', margin: 0 }}>{m.desc}</p>
                </div>
              </button>
            ))}
          </div>

          {buildMethod === 'narrate' && (
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Describe your trip</label>
              <textarea
                value={narrateText}
                onChange={(e) => setNarrateText(e.target.value)}
                placeholder="e.g. Flying to Lisbon on June 12th, returning June 24th. Visiting Porto and Sintra."
                rows={5}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.6' }}
              />
              <p style={{ fontSize: 12, color: '#aaa', margin: '6px 0 0', lineHeight: 1.5 }}>
                Include destinations, dates, and how you're getting there. We'll extract what we can.
              </p>
            </div>
          )}

          <button
            onClick={() => {
              if (buildMethod === 'narrate' && narrateText.trim()) {
                handleParseNarration();
              } else {
                setPhase('details');
              }
            }}
            disabled={buildMethod === 'narrate' && !narrateText.trim()}
            style={{
              width: '100%', padding: '11px 0',
              background: buildMethod === 'narrate' && !narrateText.trim() ? '#93afd4' : '#1A2B4A',
              color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
              cursor: buildMethod === 'narrate' && !narrateText.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {buildMethod === 'narrate' ? 'Parse itinerary' : 'Continue'}
          </button>
        </div>
      )}

      {(phase === 'details' || phase === 'creating') && (
        <div>
          {narrateParsed && (
            <div style={{
              padding: '10px 14px', background: '#f0fdf4',
              border: '1px solid #bbf7d0', borderRadius: 8,
              fontSize: 13, color: '#16a34a', fontWeight: 500,
              marginBottom: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span>Details extracted — review and adjust below.</span>
              <button
                onClick={handleReNarrate}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#16a34a', fontWeight: 600, textDecoration: 'underline', padding: 0 }}
              >
                Re-narrate
              </button>
            </div>
          )}

          <div style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '28px 24px' }}>
            <BackButton onClick={() => { setPhase('method'); setNarrateParsed(false); }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label style={labelStyle}>Trip name *</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Weekend in Lisbon" style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>Destination</label>
                <input type="text" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Lisbon, Portugal" style={inputStyle} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Departure date</label>
                  <input type="date" value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Return date</label>
                  <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} min={departureDate || undefined} style={inputStyle} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Home base</label>
                <input
                  type="text"
                  value={homeBase}
                  onChange={(e) => setHomeBase(e.target.value)}
                  placeholder="City you're departing from"
                  style={inputStyle}
                />
                <p style={{ fontSize: 11, color: '#aaa', margin: '6px 0 0', lineHeight: 1.5 }}>
                  Used to calibrate statutory rights and connection intelligence.
                </p>
              </div>

              <div>
                <label style={labelStyle}>Travelers</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  {([
                    { key: 'adults', label: 'Adults', value: adults, set: setAdults, min: 1 },
                    { key: 'children', label: 'Children', value: children, set: setChildren, min: 0 },
                    { key: 'infants', label: 'Infants', value: infants, set: setInfants, min: 0 },
                  ] as const).map((c) => (
                    <div key={c.key}>
                      <p style={{ fontSize: 11, color: '#888', margin: '0 0 4px', fontWeight: 500 }}>{c.label}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #ddd', borderRadius: 8, padding: '4px 6px', background: 'white' }}>
                        <button
                          type="button"
                          onClick={() => c.set(Math.max(c.min, c.value - 1))}
                          style={{ width: 26, height: 26, border: 'none', background: '#f7f8fa', borderRadius: 6, cursor: 'pointer', color: '#555', fontSize: 14 }}
                        >−</button>
                        <span style={{ flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 600, color: '#1A2B4A' }}>{c.value}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const nv = c.value + 1;
                            c.set(nv);
                            if (c.key === 'children') {
                              setChildAges((prev) => [...prev, 0]);
                            }
                          }}
                          style={{ width: 26, height: 26, border: 'none', background: '#f7f8fa', borderRadius: 6, cursor: 'pointer', color: '#555', fontSize: 14 }}
                        >+</button>
                      </div>
                    </div>
                  ))}
                </div>
                {children > 0 && (
                  <div style={{ marginTop: 10, padding: '10px 12px', background: '#f7f8fa', borderRadius: 8, border: '1px solid #eee' }}>
                    <p style={{ fontSize: 11, color: '#888', margin: '0 0 6px', fontWeight: 500 }}>Child ages (optional)</p>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {Array.from({ length: children }).map((_, i) => (
                        <input
                          key={i}
                          type="number"
                          min={0}
                          max={17}
                          value={childAges[i] ?? ''}
                          onChange={(e) => {
                            const next = [...childAges];
                            next[i] = parseInt(e.target.value || '0', 10) || 0;
                            setChildAges(next);
                          }}
                          placeholder={`Child ${i + 1}`}
                          style={{ width: 78, padding: '6px 8px', fontSize: 13, border: '1px solid #ddd', borderRadius: 6, background: 'white' }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label style={labelStyle}>How are you traveling?</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {TRAVEL_MODES.map((mode) => (
                    <button
                      key={mode.key}
                      type="button"
                      onClick={() => setTravelMode(mode.key)}
                      style={{
                        padding: '7px 14px',
                        border: `1px solid ${travelMode === mode.key ? '#2E5FA3' : '#ddd'}`,
                        borderRadius: 8,
                        background: travelMode === mode.key ? '#eff4fc' : 'white',
                        color: travelMode === mode.key ? '#2E5FA3' : '#555',
                        fontSize: 13,
                        fontWeight: travelMode === mode.key ? 600 : 400,
                        cursor: 'pointer',
                      }}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div style={{ padding: '10px 14px', background: '#fef9f0', border: '1px solid #fde68a', borderRadius: 8, fontSize: 13, color: '#92400e', lineHeight: 1.5 }}>
                  {error}
                </div>
              )}

              <button
                onClick={() => {
                  if (tripType === 'group') {
                    if (!name.trim()) { setError('Trip name is required.'); return; }
                    setError('');
                    setPhase('travelers');
                  } else {
                    handleCreate();
                  }
                }}
                disabled={phase === 'creating' || !name.trim()}
                style={{
                  width: '100%', padding: '11px 0',
                  background: phase === 'creating' || !name.trim() ? '#93afd4' : '#1A2B4A',
                  color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
                  cursor: phase === 'creating' || !name.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                {phase === 'creating' ? 'Creating trip…' : tripType === 'group' ? 'Add travelers' : 'Start planning'}
              </button>
            </div>
          </div>

          <p style={{ marginTop: 14, fontSize: 13, color: '#aaa', lineHeight: 1.6 }}>
            You can add policies, run coverage scans, and build your route after creating the trip.
          </p>
        </div>
      )}

      {phase === 'travelers' && (
        <div>
          <div style={{ background: '#eff4fc', border: '1px solid #dbeafe', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#1e40af', lineHeight: 1.5 }}>
            Adding nationalities helps identify any visa requirements for your group.
          </div>
          <div style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '28px 24px' }}>
            <BackButton onClick={() => setPhase('details')} />
            <p style={{ fontSize: 13, fontWeight: 600, color: '#444', margin: '0 0 4px' }}>Add traveler nationalities</p>
            <p style={{ fontSize: 12, color: '#aaa', margin: '0 0 18px', lineHeight: 1.5 }}>Optional — helps with visa and documentation checks.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
              {travelers.map((t, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'center' }}>
                  <input
                    type="text"
                    value={t.name}
                    onChange={(e) => {
                      const next = [...travelers];
                      next[i] = { ...next[i], name: e.target.value };
                      setTravelers(next);
                    }}
                    placeholder={`Traveler ${i + 1} name`}
                    style={inputStyle}
                  />
                  <select
                    value={t.nationality}
                    onChange={(e) => {
                      const next = [...travelers];
                      next[i] = { ...next[i], nationality: e.target.value };
                      setTravelers(next);
                    }}
                    style={{ ...inputStyle, appearance: 'none' }}
                  >
                    {COUNTRY_LIST.map((c) => (
                      <option key={c.code} value={c.code}>{c.name}</option>
                    ))}
                  </select>
                  {travelers.length > 1 && (
                    <button
                      onClick={() => setTravelers(travelers.filter((_, j) => j !== i))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: 16, padding: '0 4px' }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={() => setTravelers([...travelers, { name: '', nationality: 'US' }])}
              style={{
                width: '100%', padding: '9px 0',
                background: 'white', color: '#555',
                border: '1px dashed #ddd', borderRadius: 8,
                fontSize: 13, fontWeight: 500, cursor: 'pointer', marginBottom: 18,
              }}
            >
              + Add another traveler
            </button>

            <button
              onClick={handleCreate}
              disabled={isCreating}
              style={{
                width: '100%', padding: '11px 0',
                background: isCreating ? '#93afd4' : '#1A2B4A',
                color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
                cursor: isCreating ? 'not-allowed' : 'pointer',
              }}
            >
              {isCreating ? 'Creating trip…' : 'Create trip'}
            </button>

            <button
              onClick={handleCreate}
              style={{ width: '100%', padding: '9px 0', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#aaa', marginTop: 8 }}
            >
              Skip and create without travelers
            </button>
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '40px 28px', textAlign: 'center' }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: '#f0fdf4', border: '1px solid #bbf7d0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M9 12l2 2 4-4" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p style={{ fontSize: 18, fontWeight: 700, color: '#1A2B4A', margin: '0 0 6px', letterSpacing: '-0.3px' }}>
            Trip created
          </p>
          <p style={{ fontSize: 14, color: '#888', margin: '0 0 28px', lineHeight: 1.6, maxWidth: 320, marginLeft: 'auto', marginRight: 'auto' }}>
            What would you like to do next?
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Link href={`/policies/upload?trip=${createdTripId}`} style={{
              display: 'block', padding: '13px 0',
              background: '#1A2B4A', color: 'white',
              borderRadius: 10, textDecoration: 'none',
              fontSize: 14, fontWeight: 600,
            }}>
              Add a policy
            </Link>
            <Link href={`/trips/${createdTripId}`} style={{
              display: 'block', padding: '13px 0',
              background: 'white', color: '#1A2B4A',
              border: '1px solid #e5e7eb',
              borderRadius: 10, textDecoration: 'none',
              fontSize: 14, fontWeight: 600,
            }}>
              View trip
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
