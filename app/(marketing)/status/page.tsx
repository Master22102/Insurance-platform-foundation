const SYSTEMS = [
  { name: 'API', status: 'operational', desc: 'REST API and RPC endpoints' },
  { name: 'Web app', status: 'operational', desc: 'Dashboard and mobile experience' },
  { name: 'Policy extraction', status: 'operational', desc: 'Document intelligence pipeline' },
  { name: 'Authentication', status: 'operational', desc: 'Sign-in, sign-up, MFA' },
  { name: 'File storage', status: 'operational', desc: 'Evidence and document uploads' },
  { name: 'Email notifications', status: 'operational', desc: 'Transactional email delivery' },
];

const INCIDENTS: { date: string; title: string; status: string; updates: string[] }[] = [];

const STATUS_COLORS = {
  operational: { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', label: 'Operational' },
  degraded: { color: '#92400e', bg: '#fffbeb', border: '#fde68a', label: 'Degraded' },
  outage: { color: '#991b1b', bg: '#fef2f2', border: '#fecaca', label: 'Outage' },
};

function StatusBadge({ status }: { status: keyof typeof STATUS_COLORS }) {
  const s = STATUS_COLORS[status];
  return (
    <span style={{
      fontSize: 12, fontWeight: 700, color: s.color,
      background: s.bg, border: `1px solid ${s.border}`,
      borderRadius: 20, padding: '4px 12px', whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  );
}

export default function StatusPage() {
  const allOperational = SYSTEMS.every((s) => s.status === 'operational');

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', background: 'white' }}>
      <section style={{
        background: allOperational
          ? 'linear-gradient(160deg, #064e3b 0%, #065f46 50%, #064e3b 100%)'
          : 'linear-gradient(160deg, #78350f 0%, #92400e 50%, #78350f 100%)',
        padding: '140px 24px 80px',
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 28,
            background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 20, padding: '10px 20px',
          }}>
            <span style={{
              width: 10, height: 10, borderRadius: '50%',
              background: allOperational ? '#4ade80' : '#fbbf24',
              display: 'inline-block',
              boxShadow: allOperational ? '0 0 10px #4ade80' : '0 0 10px #fbbf24',
            }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>
              {allOperational ? 'All systems operational' : 'Some systems affected'}
            </span>
          </div>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 800, color: 'white', margin: '0 0 14px', letterSpacing: '-1px', lineHeight: 1.1 }}>
            Wayfarer System Status
          </h1>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', margin: 0 }}>
            Last checked: {new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}
          </p>
        </div>
      </section>

      <section style={{ padding: '64px 24px', background: 'white' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ border: '1px solid #e8e8e8', borderRadius: 16, overflow: 'hidden' }}>
            {SYSTEMS.map((system, i) => (
              <div key={system.name} style={{
                padding: '20px 24px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                borderBottom: i < SYSTEMS.length - 1 ? '1px solid #f0f0f0' : 'none',
                background: i % 2 === 0 ? 'white' : '#fafafa',
              }}>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: '#1A2B4A', margin: '0 0 2px' }}>{system.name}</p>
                  <p style={{ fontSize: 13, color: '#aaa', margin: 0 }}>{system.desc}</p>
                </div>
                <StatusBadge status={system.status as keyof typeof STATUS_COLORS} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: '48px 24px 80px', background: '#f7f8fa' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0d1b2a', margin: '0 0 24px', letterSpacing: '-0.3px' }}>
            Past incidents
          </h2>
          {INCIDENTS.length === 0 ? (
            <div style={{
              background: 'white', border: '1px solid #e8e8e8', borderRadius: 14,
              padding: '40px', textAlign: 'center',
            }}>
              <p style={{ fontSize: 15, color: '#aaa', margin: 0 }}>No incidents in the past 90 days.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {INCIDENTS.map((inc, i) => (
                <div key={i} style={{ background: 'white', border: '1px solid #e8e8e8', borderRadius: 14, padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0d1b2a', margin: 0 }}>{inc.title}</h3>
                    <span style={{ fontSize: 12, color: '#aaa' }}>{inc.date}</span>
                  </div>
                  <ul style={{ margin: 0, padding: '0 0 0 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {inc.updates.map((u, j) => (
                      <li key={j} style={{ fontSize: 14, color: '#666', lineHeight: 1.6 }}>{u}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
