'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/auth/supabase-client';

interface OptionRow {
  option_id: string;
  provider: string;
  summary: string;
  price?: string;
  category: 'rebook' | 'refund' | 'accommodation' | 'voucher' | 'statutory';
}

const DEFAULT_OPTIONS: OptionRow[] = [
  { option_id: 'airline_rebook_next', provider: 'Airline', summary: 'Rebook onto the next available flight with your current carrier.', category: 'rebook' },
  { option_id: 'airline_refund', provider: 'Airline', summary: 'Request a full refund instead of rebooking.', category: 'refund' },
  { option_id: 'hotel_voucher', provider: 'Airline', summary: 'Request overnight accommodation if delay crosses 00:00 local.', category: 'accommodation' },
  { option_id: 'eu261_compensation', provider: 'EU Regulation 261/2004', summary: 'Pursue statutory compensation (EUR 250-600) if the disruption is within scope.', category: 'statutory' },
];

export default function DisruptionOptionsPage() {
  const { trip_id, incident_id } = useParams<{ trip_id: string; incident_id: string }>();
  const { user } = useAuth();
  const [incident, setIncident] = useState<any>(null);
  const [options, setOptions] = useState<OptionRow[]>(DEFAULT_OPTIONS);
  const [connectorSource, setConnectorSource] = useState<string | null>(null);
  const [disclaimer, setDisclaimer] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingMock, setLoadingMock] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState('');

  const applyIncident = (data: any) => {
    setIncident(data);
    if (data?.live_options_result?.options?.length) {
      setOptions(data.live_options_result.options);
      setConnectorSource(data.live_options_result.connector_source || null);
      setDisclaimer(data.live_options_result.disclaimer || null);
    } else {
      setOptions(DEFAULT_OPTIONS);
      setConnectorSource(null);
      setDisclaimer(null);
    }
    if (data?.selected_option_id) setSelected(data.selected_option_id);
  };

  useEffect(() => {
    if (!user || !incident_id) return;
    (async () => {
      const { data } = await supabase.from('incidents').select('*').eq('id', incident_id).maybeSingle();
      applyIncident(data);
    })();
  }, [user, incident_id]);

  const loadMock = async () => {
    if (!user) return;
    setLoadingMock(true);
    setError('');
    const { error: rpcErr } = await supabase.rpc('populate_mock_disruption_options', {
      p_incident_id: incident_id,
    });
    if (rpcErr) {
      setError(rpcErr.message || 'Could not load mock options.');
      setLoadingMock(false);
      return;
    }
    const { data } = await supabase.from('incidents').select('*').eq('id', incident_id).maybeSingle();
    applyIncident(data);
    setLoadingMock(false);
  };

  const confirm = async () => {
    if (!selected || !user) return;
    setSubmitting(true);
    setError('');
    const { data, error: rpcErr } = await supabase.rpc('select_disruption_option', {
      p_incident_id: incident_id,
      p_option_id: selected,
      p_actor_id: user.id,
    });
    setSubmitting(false);
    if (rpcErr) {
      setError(rpcErr.message || 'Could not record selection.');
      return;
    }
    setResult(typeof data === 'string' ? data : 'recorded');
  };

  return (
    <div style={{ maxWidth: 820, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <Link href={`/trips/${trip_id}/incidents/${incident_id}`} style={{ fontSize: 13, color: '#888', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 19l-7-7 7-7" stroke="#aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        Back to incident
      </Link>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A2B4A', margin: '0 0 6px' }}>Your options</h1>
      <p style={{ fontSize: 13, color: '#888', margin: '0 0 18px', lineHeight: 1.55 }}>
        Pick the path you want to pursue. We record your choice on the incident ledger so your claim packet reflects it.
      </p>

      {connectorSource === 'mock' && disclaimer && (
        <div style={{
          background: '#fef9f0', border: '1px solid #fde68a',
          borderRadius: 10, padding: '12px 14px', marginBottom: 14,
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#92400e', letterSpacing: '0.06em', margin: 0, textTransform: 'uppercase' }}>
            Mock connector
          </p>
          <p style={{ fontSize: 12, color: '#78350f', margin: '4px 0 0', lineHeight: 1.55 }}>
            {disclaimer} A real carrier API connector has not been wired yet.
          </p>
        </div>
      )}

      {!connectorSource && (
        <div style={{
          background: '#f7f9fc', border: '1px solid #e0e8f4',
          borderRadius: 10, padding: '12px 14px', marginBottom: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap',
        }}>
          <p style={{ fontSize: 12, color: '#555', margin: 0, lineHeight: 1.5 }}>
            Showing default option categories. Load mock carrier options to preview the live-options UI — labeled as mock, not for filing.
          </p>
          <button
            onClick={loadMock}
            disabled={loadingMock}
            style={{
              padding: '7px 14px',
              background: loadingMock ? '#e5e7eb' : 'white',
              color: '#1e40af', border: '1px solid #bfdbfe',
              borderRadius: 7, fontSize: 12, fontWeight: 600,
              cursor: loadingMock ? 'not-allowed' : 'pointer',
            }}
          >
            {loadingMock ? 'Loading...' : 'Load mock options'}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {options.map((opt) => {
          const isSelected = selected === opt.option_id;
          return (
            <button
              key={opt.option_id}
              onClick={() => setSelected(opt.option_id)}
              style={{
                textAlign: 'left', padding: '14px 16px',
                background: isSelected ? '#eff4fc' : 'white',
                border: `1.5px solid ${isSelected ? '#2E5FA3' : '#e8e8e8'}`,
                borderRadius: 10, cursor: 'pointer',
              }}
            >
              <p style={{ fontSize: 10, fontWeight: 700, color: '#2E5FA3', letterSpacing: '0.05em', margin: 0, textTransform: 'uppercase' }}>
                {opt.category} · {opt.provider}
              </p>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#1A2B4A', margin: '4px 0 3px' }}>{opt.summary}</p>
              {opt.price && <p style={{ fontSize: 12, color: '#666', margin: 0 }}>{opt.price}</p>}
            </button>
          );
        })}
      </div>

      <button
        onClick={confirm}
        disabled={!selected || submitting || !!result}
        style={{
          marginTop: 18, padding: '11px 22px',
          background: !selected || submitting ? '#e5e7eb' : '#1A2B4A',
          color: !selected || submitting ? '#9ca3af' : 'white',
          border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
          cursor: !selected || submitting ? 'not-allowed' : 'pointer',
        }}
      >
        {result ? 'Selection recorded' : submitting ? 'Recording...' : 'Confirm selection'}
      </button>
      {error && <p style={{ fontSize: 13, color: '#991b1b', margin: '10px 0 0' }}>{error}</p>}
      {result && <p style={{ fontSize: 13, color: '#166534', margin: '10px 0 0' }}>Your choice is on the incident ledger. Continue to your claim packet when ready.</p>}
    </div>
  );
}
