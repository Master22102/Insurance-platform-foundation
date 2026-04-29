'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/auth/supabase-client';
import { useSpeechCapture } from '@/lib/speech/useSpeechCapture';
import { CoverageCatalogPanel } from '@/components/trips/CoverageCatalogPanel';
import { useIsMobile, useIsTablet } from '@/lib/hooks/useIsMobile';
import { mobileStyles, tabletStyles } from '@/lib/styles/responsive';

type TripType = 'solo' | 'group';
type BuildMethod = 'narrate' | 'manual';
type Phase = 'type' | 'method' | 'details' | 'coverage' | 'travelers' | 'creating' | 'done';
type SupportedItineraryExt = 'txt' | 'ics' | 'pdf' | 'docx';

const MAX_ITINERARY_UPLOAD_BYTES = 10 * 1024 * 1024;
const PARSE_TRANSITION_LINES = [
  'Taking a careful look...',
  "Dotting the i's and crossing the t's...",
  'Lining everything up...',
  'Making sure the details match...',
];

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
  minHeight: 48,
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
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: '#888',
        fontSize: 13,
        padding: 0,
        marginBottom: 20,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        minHeight: 44,
        minWidth: 44,
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path d="M19 12H5M12 19l-7-7 7-7" stroke="#aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Back
    </button>
  );
}

export default function NewTripPage() {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const { user, profile } = useAuth();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>('type');
  const [tripType, setTripType] = useState<TripType>('solo');
  const [buildMethod, setBuildMethod] = useState<BuildMethod>('manual');

  const [narrateText, setNarrateText] = useState('');
  const [narrateParsed, setNarrateParsed] = useState(false);
  const [narrateVoiceState, setNarrateVoiceState] = useState<'idle' | 'recording' | 'recorded'>('idle');
  const [narrateVoiceError, setNarrateVoiceError] = useState('');
  const [itineraryUploadError, setItineraryUploadError] = useState('');
  const [itineraryUploadInfo, setItineraryUploadInfo] = useState('');
  const [itineraryArtifact, setItineraryArtifact] = useState<{
    fileName: string;
    extension: SupportedItineraryExt;
    sizeBytes: number;
  } | null>(null);
  const [isParsingNarration, setIsParsingNarration] = useState(false);
  const [parseTransitionLine, setParseTransitionLine] = useState(PARSE_TRANSITION_LINES[0]);
  const [isNormalizingUpload, setIsNormalizingUpload] = useState(false);
  const [normalizedRouteSegments, setNormalizedRouteSegments] = useState<Array<{ origin: string; destination: string }>>([]);

  const { start: startNarration, stop: stopNarration, reset: resetNarration } = useSpeechCapture({
    maxDurationMs: 5 * 60 * 1000,
    onTranscript: (text, isFinal) => {
      const t = text.trim();
      if (!t) return;
      setNarrateText(t);
      if (isFinal) {
        setNarrateVoiceState('recorded');
      } else {
        setNarrateVoiceState('recording');
      }
      setNarrateVoiceError('');
    },
    onError: (message) => {
      setNarrateVoiceError(message);
      setNarrateVoiceState('idle');
    },
  });

  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [travelMode, setTravelMode] = useState('air');

  const [travelers, setTravelers] = useState<{ name: string; nationality: string }[]>([{ name: '', nationality: 'US' }]);

  const [error, setError] = useState('');
  const [createdTripId, setCreatedTripId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  /** F-6.5.17 — catalog rows to materialize as policies after trip creation */
  const [catalogSelectionIds, setCatalogSelectionIds] = useState<string[]>([]);

  const suggestedPlaces = (
    (profile?.preferences as Record<string, unknown> | undefined)?.signal_profile as { places?: string[] } | undefined
  )?.places?.filter(Boolean);

  function getExtension(name: string): string {
    const split = name.toLowerCase().split('.');
    return split.length > 1 ? split[split.length - 1] : '';
  }

  function isSupportedItineraryExtension(ext: string): ext is SupportedItineraryExt {
    return ['txt', 'ics', 'pdf', 'docx'].includes(ext);
  }

  function startParsingTransitionAndContinue() {
    if (!narrateText.trim()) return;
    const line = PARSE_TRANSITION_LINES[Math.floor(Math.random() * PARSE_TRANSITION_LINES.length)];
    setParseTransitionLine(line);
    setIsParsingNarration(true);
    window.setTimeout(() => {
      handleParseNarration();
      setIsParsingNarration(false);
    }, 700);
  }

  async function handleItineraryUpload(file: File | null) {
    if (!file) return;
    setItineraryUploadError('');
    setItineraryUploadInfo('');

    if (file.size > MAX_ITINERARY_UPLOAD_BYTES) {
      setItineraryUploadError('That file is too large to upload. Try a smaller file or enter manually.');
      return;
    }

    const ext = getExtension(file.name);
    if (!isSupportedItineraryExtension(ext)) {
      setItineraryUploadError("Unfortunately, we can't use that file type yet. Try again or enter manually.");
      return;
    }

    setIsNormalizingUpload(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/itinerary/normalize', {
        method: 'POST',
        body: form,
      });
      const json = await res.json();
      if (!res.ok) {
        setItineraryUploadError(json?.error || 'We could not process that file. Try again or enter manually.');
        return;
      }

      const extracted = typeof json?.extracted_text === 'string' ? json.extracted_text : '';
      if (!extracted.trim()) {
        setItineraryUploadError('We could not read details from that file. Try another file or enter manually.');
        return;
      }

      const proposed = json?.proposed || {};
      setNarrateText(extracted);
      setNarrateVoiceState('recorded');
      setName((proposed.trip_name && String(proposed.trip_name).trim()) || name);
      setDestination((proposed.destination_summary && String(proposed.destination_summary).trim()) || destination);
      setDepartureDate((proposed.departure_date && String(proposed.departure_date).trim()) || departureDate);
      setReturnDate((proposed.return_date && String(proposed.return_date).trim()) || returnDate);
      setTravelMode((proposed.travel_mode_primary && String(proposed.travel_mode_primary).trim()) || travelMode);
      const routeSegments = Array.isArray(proposed.route_segments)
        ? proposed.route_segments
            .map((seg: any) => ({
              origin: String(seg?.origin || '').trim(),
              destination: String(seg?.destination || '').trim(),
            }))
            .filter((seg: { origin: string; destination: string }) => seg.origin || seg.destination)
        : [];
      setNormalizedRouteSegments(routeSegments);

      setItineraryArtifact({
        fileName: file.name,
        extension: ext,
        sizeBytes: file.size,
      });
      setItineraryUploadInfo(`Parsed ${file.name}. Review extracted details, then continue.`);
    } catch {
      setItineraryUploadError('Upload processing failed. Try again or enter manually.');
    } finally {
      setIsNormalizingUpload(false);
    }
  }

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
    setNarrateVoiceState('idle');
    setNarrateVoiceError('');
  }

  function toggleNarrateMic() {
    if (narrateVoiceState === 'recording') {
      stopNarration();
      setNarrateVoiceState('idle');
      return;
    }

    if (narrateVoiceState === 'recorded') {
      resetNarration();
      setNarrateText('');
      setNarrateVoiceError('');
      setNarrateVoiceState('idle');
      return;
    }

    resetNarration();
    setNarrateVoiceError('');
    setNarrateVoiceState('recording');
    startNarration();
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
      p_metadata: travelersMetadata ? { travelers: travelersMetadata } : null,
    });

    if (rpcError || !data?.success) {
      setError(data?.error || rpcError?.message || 'Something went wrong. Please try again.');
      setIsCreating(false);
      setPhase('coverage');
      return;
    }

    setCreatedTripId(data.trip_id);

    if (catalogSelectionIds.length > 0) {
      const { error: catalogErr } = await supabase.rpc('apply_coverage_catalog_selections', {
        p_trip_id: data.trip_id,
        p_catalog_ids: catalogSelectionIds,
      });
      if (catalogErr) {
        console.warn('[apply_coverage_catalog_selections] non-blocking failure', catalogErr);
      }
    }

    // Step 4A normalization signal: persist itinerary hash/version event from current structured fields.
    // This is non-blocking for trip creation success.
    const itineraryFields = {
      trip_name: name.trim(),
      destination_summary: destination.trim() || null,
      departure_date: departureDate || null,
      return_date: returnDate || null,
      travel_mode_primary: travelMode || null,
      draft_narration: narrateText.trim() || null,
      artifact_name: itineraryArtifact?.fileName || null,
      artifact_extension: itineraryArtifact?.extension || null,
    };
    const { data: hashData, error: hashErr } = await supabase.rpc('update_itinerary_hash', {
      p_trip_id: data.trip_id,
      p_actor_id: user!.id,
      p_itinerary_fields: itineraryFields,
    });
    if (hashErr || !hashData?.success) {
      console.warn('[update_itinerary_hash] non-blocking failure', hashErr || hashData);
    }

    // Step 5 automation: trigger a Quick Scan request when itinerary is structured enough.
    // Uses free/teaser lane (trip_id null) so this does not require trip unlock.
    if (destination.trim() && (departureDate || returnDate)) {
      const itinerarySnapshot = {
        destination: destination.trim(),
        departure_date: departureDate || null,
        return_date: returnDate || null,
        travel_mode: travelMode || null,
        itinerary_hash: hashData?.new_hash || hashData?.hash || null,
        route_segments: normalizedRouteSegments
          .filter((s) => s.origin.trim() || s.destination.trim())
          .map((s, idx) => ({
            index: idx,
            origin: s.origin.trim() || null,
            destination: s.destination.trim() || null,
          })),
      };
      const { error: quickScanErr } = await supabase.rpc('initiate_quick_scan', {
        p_user_id: user!.id,
        p_itinerary_snapshot: itinerarySnapshot,
        p_trip_id: null,
      });
      if (quickScanErr) {
        console.warn('[initiate_quick_scan] non-blocking failure', quickScanErr);
      }
    }

    // Persist extracted route legs (if any) so Draft Home route view has concrete segments.
    if (normalizedRouteSegments.length > 0) {
      for (let i = 0; i < normalizedRouteSegments.length; i++) {
        const seg = normalizedRouteSegments[i];
        if (!seg.origin.trim() || !seg.destination.trim()) continue;
        const { error: segErr } = await supabase.rpc('upsert_route_segment', {
          p_trip_id: data.trip_id,
          p_segment_id: null,
          p_origin_text: seg.origin.trim(),
          p_destination_text: seg.destination.trim(),
          p_mode: travelMode,
          p_departure_at: null,
          p_arrival_at: null,
          p_position_index: i,
          p_actor_id: user!.id,
        });
        if (segErr) {
          console.warn('[upsert_route_segment] non-blocking failure', segErr);
        }
      }
    }

    setIsCreating(false);
    setPhase('done');
  }

  const stepMap: Record<Phase, number> = {
    type: 1,
    method: 2,
    details: 3,
    coverage: 3,
    travelers: 3,
    creating: 3,
    done: 3,
  };
  const currentStep = stepMap[phase];

  return (
    <div
      style={{
        ...(isMobile ? mobileStyles.appContentMobile : isTablet ? tabletStyles.appContent : { padding: '24px 16px 40px' }),
        maxWidth: 540,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                <label style={labelStyle}>Describe your trip</label>
                <button
                  type="button"
                  onClick={toggleNarrateMic}
                  aria-label="Microphone"
                  title={narrateVoiceState === 'recording' ? 'Stop microphone capture' : 'Tap to start microphone capture'}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 999,
                    border: narrateVoiceState === 'recording' ? '1px solid #fecaca' : '1px solid #dbeafe',
                    background: narrateVoiceState === 'recording' ? '#fee2e2' : narrateVoiceState === 'recorded' ? '#dcfce7' : '#eff6ff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M12 14a3 3 0 003-3V5a3 3 0 10-6 0v6a3 3 0 003 3z" stroke={narrateVoiceState === 'recording' ? '#b91c1c' : '#1e40af'} strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M19 11a7 7 0 01-14 0" stroke={narrateVoiceState === 'recording' ? '#b91c1c' : '#1e40af'} strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M12 18v3" stroke={narrateVoiceState === 'recording' ? '#b91c1c' : '#1e40af'} strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M8 21h8" stroke={narrateVoiceState === 'recording' ? '#b91c1c' : '#1e40af'} strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 12, color: '#888', fontWeight: 600, marginBottom: 6 }}>
                  Upload file (PDF, ICS, DOCX, TXT)
                </label>
                <input
                  type="file"
                  accept=".pdf,.ics,.docx,.txt,text/plain,application/pdf,text/calendar,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => {
                    void handleItineraryUpload(e.target.files?.[0] || null);
                  }}
                  style={{ width: '100%' }}
                />
                <p style={{ fontSize: 12, color: '#64748b', margin: '6px 0 0', lineHeight: 1.5 }}>
                  We support PDFs, ICS calendar files, Word docs, and AI-generated itinerary text.
                </p>
                {itineraryUploadInfo && (
                  <p style={{ fontSize: 12, color: '#166534', margin: '6px 0 0', lineHeight: 1.5 }}>
                    {itineraryUploadInfo}
                  </p>
                )}
                {isNormalizingUpload && (
                  <p style={{ fontSize: 12, color: '#1e40af', margin: '6px 0 0', lineHeight: 1.5 }}>
                    Taking a careful look...
                  </p>
                )}
                {itineraryUploadError && (
                  <p style={{ fontSize: 12, color: '#b45309', margin: '6px 0 0', lineHeight: 1.5 }}>
                    {itineraryUploadError}
                  </p>
                )}
              </div>
              <textarea
                value={narrateText}
                onChange={(e) => setNarrateText(e.target.value)}
                placeholder="e.g. Flying to Lisbon on June 12th, returning June 24th. Visiting Porto and Sintra."
                rows={5}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.6' }}
              />
              <p style={{ fontSize: 12, color: narrateVoiceState === 'recording' ? '#1e40af' : '#aaa', margin: '8px 0 0', lineHeight: 1.5 }}>
                {narrateVoiceState === 'recording'
                  ? 'Listening now - tap the mic again to stop.'
                  : narrateVoiceState === 'recorded'
                    ? 'Voice captured. Tap mic to re-record.'
                    : 'Tap the microphone and speak (or type instead).'}
              </p>
              {narrateVoiceError && (
                <p style={{ fontSize: 12, color: '#b45309', margin: '6px 0 0', lineHeight: 1.5 }}>
                  {narrateVoiceError}
                </p>
              )}
              <p style={{ fontSize: 12, color: '#aaa', margin: '6px 0 0', lineHeight: 1.5 }}>
                Include destinations, dates, and how you&apos;re getting there. We&apos;ll extract what we can.
              </p>
            </div>
          )}

          <button
            onClick={() => {
              if (buildMethod === 'narrate' && narrateText.trim()) {
                startParsingTransitionAndContinue();
              } else {
                setPhase('details');
              }
            }}
            disabled={isParsingNarration || (buildMethod === 'narrate' && !narrateText.trim())}
            style={{
              width: '100%', padding: '11px 0',
              background: isParsingNarration || (buildMethod === 'narrate' && !narrateText.trim()) ? '#93afd4' : '#1A2B4A',
              color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
              cursor: isParsingNarration || (buildMethod === 'narrate' && !narrateText.trim()) ? 'not-allowed' : 'pointer',
            }}
          >
            {buildMethod === 'narrate'
              ? (isParsingNarration ? parseTransitionLine : 'Parse itinerary')
              : 'Continue'}
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

            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1A2B4A', margin: '0 0 6px', letterSpacing: '-0.3px' }}>
              Review your trip
            </h2>
            <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 18px', lineHeight: 1.55 }}>
              Confirm route legs and details match what you intend before creating the trip. Nothing is finalized until you create the trip.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {normalizedRouteSegments.length > 0 && (
                <div
                  style={{
                    border: '1px solid #dbeafe',
                    background: '#f8fbff',
                    borderRadius: 10,
                    padding: '12px 12px 10px',
                  }}
                >
                  <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Route legs
                  </p>
                  <p style={{ margin: '0 0 10px', fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
                    We detected these legs. Edit or add more before continuing.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {normalizedRouteSegments.map((seg, idx) => (
                      <div key={`seg-${idx}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto', gap: 8, alignItems: 'center' }}>
                        <input
                          type="text"
                          value={seg.origin}
                          onChange={(e) => {
                            const next = [...normalizedRouteSegments];
                            next[idx] = { ...next[idx], origin: e.target.value };
                            setNormalizedRouteSegments(next);
                          }}
                          placeholder="Origin"
                          style={inputStyle}
                        />
                        <span style={{ fontSize: 12, color: '#64748b' }}>-&gt;</span>
                        <input
                          type="text"
                          value={seg.destination}
                          onChange={(e) => {
                            const next = [...normalizedRouteSegments];
                            next[idx] = { ...next[idx], destination: e.target.value };
                            setNormalizedRouteSegments(next);
                          }}
                          placeholder="Destination"
                          style={inputStyle}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setNormalizedRouteSegments(normalizedRouteSegments.filter((_, i) => i !== idx));
                          }}
                          style={{
                            border: 'none',
                            background: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            fontSize: 16,
                            width: 44,
                            height: 44,
                            borderRadius: 10,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          aria-label={`Remove leg ${idx + 1}`}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setNormalizedRouteSegments([...normalizedRouteSegments, { origin: '', destination: '' }])}
                    style={{
                      marginTop: 8,
                      border: '1px dashed #bfdbfe',
                      background: 'white',
                      color: '#1e40af',
                      borderRadius: 8,
                      padding: '12px 10px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      minHeight: 44,
                    }}
                  >
                    + Add leg
                  </button>
                </div>
              )}

              <div>
                <label style={labelStyle}>Trip name *</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Weekend in Lisbon" style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>Destination</label>
                {suggestedPlaces && suggestedPlaces.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 6px' }}>Based on your interests</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {suggestedPlaces.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setDestination(p)}
                          style={{
                            padding: '10px 12px',
                            minHeight: 44,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 12,
                            fontWeight: 600,
                            borderRadius: 999,
                            border: '1px solid #bfdbfe',
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            cursor: 'pointer',
                          }}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
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
                <label style={labelStyle}>How are you traveling?</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {TRAVEL_MODES.map((mode) => (
                    <button
                      key={mode.key}
                      type="button"
                      onClick={() => setTravelMode(mode.key)}
                      style={{
                        padding: '7px 14px',
                        minHeight: 44,
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
                  if (!name.trim()) { setError('Trip name is required.'); return; }
                  setError('');
                  setPhase('coverage');
                }}
                disabled={phase === 'creating' || !name.trim()}
                style={{
                  width: '100%', padding: '11px 0',
                  background: phase === 'creating' || !name.trim() ? '#93afd4' : '#1A2B4A',
                  color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
                  cursor: phase === 'creating' || !name.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                {phase === 'creating' ? 'Creating trip…' : 'Continue to coverage'}
              </button>
            </div>
          </div>

          <p style={{ marginTop: 14, fontSize: 13, color: '#aaa', lineHeight: 1.6 }}>
            You can add policies, run coverage scans, and build your route after creating the trip.
          </p>
        </div>
      )}

      {phase === 'coverage' && (
        <div>
          <BackButton onClick={() => setPhase('details')} />
          <CoverageCatalogPanel
            selectedIds={catalogSelectionIds}
            onChangeSelected={setCatalogSelectionIds}
            onSkip={() => {
              if (tripType === 'group') setPhase('travelers');
              else void handleCreate();
            }}
            onContinue={() => {
              if (tripType === 'group') setPhase('travelers');
              else void handleCreate();
            }}
          />
        </div>
      )}

      {phase === 'travelers' && (
        <div>
          <div style={{ background: '#eff4fc', border: '1px solid #dbeafe', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#1e40af', lineHeight: 1.5 }}>
            Adding nationalities helps identify any visa requirements for your group.
          </div>
          <div style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '28px 24px' }}>
            <BackButton onClick={() => setPhase('coverage')} />
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
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#ccc',
                        fontSize: 16,
                        padding: 0,
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
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
                minHeight: 44,
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
                minHeight: 48,
              }}
            >
              {isCreating ? 'Creating trip…' : 'Create trip'}
            </button>

            <button
              onClick={handleCreate}
              style={{ width: '100%', padding: '9px 0', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#aaa', marginTop: 8, minHeight: 44 }}
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
            <Link href={`/policies/upload?trip_id=${createdTripId}`} style={{
              display: 'block', padding: '13px 0',
              background: '#1A2B4A', color: 'white',
              borderRadius: 10, textDecoration: 'none',
              fontSize: 14, fontWeight: 600,
            }}>
              Add a policy
            </Link>
            <Link href={`/trips/${createdTripId}/draft`} style={{
              display: 'block', padding: '13px 0',
              background: 'white', color: '#1A2B4A',
              border: '1px solid #e5e7eb',
              borderRadius: 10, textDecoration: 'none',
              fontSize: 14, fontWeight: 600,
            }}>
              Continue planning
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
