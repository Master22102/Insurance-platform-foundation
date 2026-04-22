'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/auth/supabase-client';

export default function ClaimPacketPage() {
  const { trip_id, incident_id } = useParams<{ trip_id: string; incident_id: string }>();
  const { user } = useAuth();
  const [packet, setPacket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const { data } = await supabase
      .from('claim_packets')
      .select('*')
      .eq('incident_id', incident_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setPacket(data);
    setLoading(false);
  };

  useEffect(() => { if (user && incident_id) load(); }, [user, incident_id]);

  const build = async () => {
    if (!user) return;
    setBuilding(true);
    setError('');
    const { error: rpcErr } = await supabase.rpc('create_claim_packet_from_incident', {
      p_incident_id: incident_id,
      p_actor_id: user.id,
      p_idempotency_key: `packet-${incident_id}-${Date.now()}`,
    });
    setBuilding(false);
    if (rpcErr) {
      setError(rpcErr.message || 'Could not build packet.');
      return;
    }
    await load();
  };

  const steps: any[] = Array.isArray(packet?.sequence_steps) ? packet.sequence_steps : [];

  return (
    <div style={{ maxWidth: 820, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <Link href={`/trips/${trip_id}/incidents/${incident_id}`} style={{ fontSize: 13, color: '#888', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 19l-7-7 7-7" stroke="#aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        Back to incident
      </Link>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A2B4A', margin: '0 0 6px' }}>Claim packet</h1>
      <p style={{ fontSize: 13, color: '#888', margin: '0 0 20px', lineHeight: 1.55 }}>
        A sequenced packet pulls your incident, evidence, and policy context into one filing bundle.
      </p>

      {loading ? (
        <p style={{ fontSize: 13, color: '#888' }}>Loading...</p>
      ) : !packet ? (
        <div style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '20px 22px' }}>
          <p style={{ fontSize: 13, color: '#444', margin: '0 0 14px', lineHeight: 1.6 }}>
            No packet built yet. Generate one when your incident is ready to route.
          </p>
          <button
            onClick={build}
            disabled={building}
            style={{
              padding: '10px 20px',
              background: building ? '#93afd4' : '#1A2B4A',
              color: 'white', border: 'none', borderRadius: 8,
              fontSize: 13, fontWeight: 600,
              cursor: building ? 'not-allowed' : 'pointer',
            }}
          >
            {building ? 'Building...' : 'Build claim packet'}
          </button>
          {error && <p style={{ fontSize: 13, color: '#991b1b', margin: '10px 0 0' }}>{error}</p>}
        </div>
      ) : (
        <div style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#2E5FA3', letterSpacing: '0.05em', margin: 0, textTransform: 'uppercase' }}>
                Packet v{packet.packet_version}
              </p>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#1A2B4A', margin: '2px 0 0' }}>
                Status: {packet.packet_status}
              </p>
            </div>
            <button
              onClick={build}
              disabled={building}
              style={{
                padding: '8px 14px',
                background: 'white', color: '#2E5FA3',
                border: '1px solid #bfdbfe', borderRadius: 8,
                fontSize: 12, fontWeight: 600, cursor: building ? 'not-allowed' : 'pointer',
              }}
            >
              {building ? 'Rebuilding...' : 'Rebuild'}
            </button>
          </div>

          {steps.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {steps.map((s, i) => (
                <div key={i} style={{ padding: '10px 12px', background: '#f9fafb', border: '1px solid #f0f0f0', borderRadius: 8 }}>
                  <p style={{ fontSize: 11, color: '#888', margin: 0, letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600 }}>
                    Step {s.position ?? i + 1}
                  </p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A', margin: '2px 0 2px' }}>{s.title || s.provider || 'Filing step'}</p>
                  {s.description && <p style={{ fontSize: 12, color: '#555', margin: 0, lineHeight: 1.5 }}>{s.description}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: '#888' }}>No sequence steps yet. Rebuild the packet once more evidence is attached.</p>
          )}
          {error && <p style={{ fontSize: 13, color: '#991b1b', margin: '12px 0 0' }}>{error}</p>}
        </div>
      )}
    </div>
  );
}
