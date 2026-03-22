'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/auth/supabase-client';

export default function BreachP1Banner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const { data, error } = await supabase
        .from('breach_incidents')
        .select('incident_id')
        .eq('severity', 'p1_critical')
        .eq('founder_acknowledged', false)
        .limit(1);
      if (!cancelled && !error && data && data.length > 0) setShow(true);
      else if (!cancelled) setShow(false);
    };
    void tick();
    const id = window.setInterval(tick, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  if (!show) return null;

  return (
    <div
      style={{
        background: '#7f1d1d',
        color: '#fff',
        padding: '10px 16px',
        textAlign: 'center',
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      CRITICAL: Unacknowledged breach incident requires attention —{' '}
      <Link href="/focl/security" style={{ color: '#fecaca', textDecoration: 'underline' }}>
        Open security console
      </Link>
    </div>
  );
}
