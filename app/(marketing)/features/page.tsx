'use client';

import Link from 'next/link';

const FEATURE_SECTIONS = [
  {
    tag: 'Trip Management',
    tagColor: '#2E5FA3',
    tagBg: '#eff4fc',
    title: 'Plan smarter. Know what covers you before you leave.',
    desc: 'Wayfarer turns your trip into a structured record — destination, dates, travelers, and travel mode — then automatically flags visa requirements and surfaces coverage gaps before departure.',
    bullets: [
      'Natural language itinerary parser: type your trip in plain English, details are auto-extracted',
      'Multi-leg itinerary builder with segment types (flight, train, ferry, car, hotel)',
      'Per-trip policy and incident registry — everything in one place',
      'Automated departure checklist with visa advisories by nationality and destination',
      'Trip status lifecycle: Planning → Active → Resolved → Archived',
    ],
    image: 'trips',
    flip: false,
  },
  {
    tag: 'Solo & Group Travel',
    tagColor: '#0369a1',
    tagBg: '#f0f9ff',
    title: 'Built for individuals and groups alike.',
    desc: 'Whether you\'re traveling solo or coordinating a group — family vacation, business trip, or team offsite — Wayfarer structures the coverage for everyone on the booking.',
    bullets: [
      'Solo and group trip modes with shared itinerary and per-traveler records',
      'Traveler nationality tracking for accurate visa advisory and eligibility checks',
      'Air, rail, sea, road, and mixed-mode travel support',
      'Deep scan credits: unlock per-trip coverage analysis when you need it',
      'Group incident tracking — log what happened to whom, all in one record',
    ],
    image: 'group',
    flip: true,
  },
  {
    tag: 'Policy Intelligence',
    tagColor: '#16a34a',
    tagBg: '#f0fdf4',
    title: 'Your policies, decoded. Every clause, every condition.',
    desc: 'Upload any travel policy — insurance certificate, credit card benefit guide, airline contract of carriage — and Wayfarer extracts every protection clause, scores it by confidence, and maps it to 30+ standardized coverage families.',
    bullets: [
      'Supports PDF, MHTML, and plain-text policy documents',
      'AI-powered clause extraction with confidence scoring',
      '30+ coverage families including Medical, Cancellation, Baggage, Delay, and more',
      'Conflict detection when multiple policies cover the same incident type',
      'Plain-English explanation of every extracted clause',
    ],
    image: 'coverage',
    flip: true,
  },
  {
    tag: 'Incident Tracking',
    tagColor: '#92400e',
    tagBg: '#fffbeb',
    title: 'Document everything while it\'s happening.',
    desc: 'When a flight is delayed or luggage is lost, the clock starts immediately. Wayfarer\'s incident workspace keeps you organized — from initial narration through evidence upload to the moment your incident record is ready for filing.',
    bullets: [
      'Structured incident types: flight delay, cancellation, baggage, medical, and more',
      'Evidence upload with file type tracking (photo, receipt, carrier notice, medical)',
      'Narration and timeline auto-generation from your inputs',
      'Incident status lifecycle with audit-logged transitions',
      'EU261 eligibility pre-check for European flight disruptions',
    ],
    image: 'incidents',
    flip: false,
  },
  {
    tag: 'Claim Routing Engine',
    tagColor: '#b45309',
    tagBg: '#fff7ed',
    title: 'Know exactly where to send it — and what to say.',
    desc: 'Once your incident is documented, the claim routing engine cross-references your policies against the incident type, identifies every applicable coverage layer, and tells you precisely what to submit to each recipient.',
    bullets: [
      'Multi-policy matching: identifies all coverage sources for a single incident',
      'Guided routing form with recipient type, policy linkage, and claim amount',
      'Evidence packet assembly: surfaces the right files for each recipient',
      'Claim status tracking from routing to resolution',
      'Historical claim record with full audit trail',
    ],
    image: 'routing',
    flip: true,
  },
];

const PHONE_SCREENS: Record<string, React.ReactNode> = {
  group: (
    <div style={{ padding: '14px 14px 70px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '12px 14px', marginBottom: 2 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#0369a1', margin: '0 0 2px' }}>Japan Spring — Group trip</p>
        <p style={{ fontSize: 11, color: '#0369a1', margin: 0 }}>3 travelers · Air · Mar 20 – Apr 8</p>
      </div>
      {[
        { initials: 'JD', name: 'Jamie D.', nationality: 'US', visa: 'Visa-free', color: '#16a34a' },
        { initials: 'AK', name: 'Akira K.', nationality: 'JP', visa: 'Citizen', color: '#16a34a' },
        { initials: 'LM', name: 'Lena M.', nationality: 'DE', visa: 'Visa-free', color: '#16a34a' },
      ].map((t, i) => (
        <div key={i} style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #2E5FA3 0%, #1A2B4A 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'white', flexShrink: 0 }}>{t.initials}</div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>{t.name}</p>
            <p style={{ fontSize: 10, color: '#aaa', margin: 0 }}>{t.nationality} passport</p>
          </div>
          <span style={{ fontSize: 9, fontWeight: 600, color: t.color, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 20, padding: '2px 7px' }}>{t.visa}</span>
        </div>
      ))}
    </div>
  ),
  trips: (
    <div style={{ padding: '14px 14px 70px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[
        { name: 'Lisbon & Porto', dest: 'Portugal', status: 'Planning', color: '#2E5FA3', bg: '#eff4fc', border: '#bfdbfe', dates: 'Jun 12 – Jun 28', policies: 2 },
        { name: 'Japan Spring', dest: 'Japan', status: 'Active', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', dates: 'Mar 20 – Apr 8', policies: 3 },
        { name: 'Patagonia Trek', dest: 'Argentina', status: 'Resolved', color: '#888', bg: '#f5f5f5', border: '#e5e5e5', dates: 'Jan 5 – Jan 22', policies: 1 },
      ].map((t, i) => (
        <div key={i} style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>{t.name}</p>
              <p style={{ fontSize: 11, color: '#aaa', margin: '2px 0 0' }}>{t.dest} · {t.dates}</p>
            </div>
            <span style={{ fontSize: 10, fontWeight: 600, color: t.color, background: t.bg, border: `1px solid ${t.border}`, borderRadius: 20, padding: '3px 8px', height: 'fit-content' }}>{t.status}</span>
          </div>
          <p style={{ fontSize: 11, color: '#aaa', margin: 0 }}>{t.policies} {t.policies === 1 ? 'policy' : 'policies'} attached</p>
        </div>
      ))}
    </div>
  ),
  coverage: (
    <div style={{ padding: '14px 14px 70px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[
        { name: 'Allianz Travel Plan', type: 'Travel insurance', clauses: 12, families: ['Medical', 'Cancellation', 'Baggage'] },
        { name: 'Chase Sapphire Reserve', type: 'Credit card', clauses: 7, families: ['Delay', 'Interruption'] },
        { name: 'Norwegian Air', type: 'Carrier policy', clauses: 5, families: ['Delay', 'Baggage'] },
      ].map((p, i) => (
        <div key={i} style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 10, padding: '12px 14px' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A', margin: '0 0 2px' }}>{p.name}</p>
          <p style={{ fontSize: 11, color: '#aaa', margin: '0 0 8px' }}>{p.type} · {p.clauses} clauses</p>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {p.families.map((f) => (
              <span key={f} style={{ fontSize: 10, fontWeight: 600, color: '#2E5FA3', background: '#eff4fc', border: '1px solid #bfdbfe', borderRadius: 20, padding: '2px 7px' }}>{f}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  ),
  incidents: (
    <div style={{ padding: '14px 14px 70px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[
        { title: 'Flight delayed 4h — Seoul', type: 'Flight delay', status: 'Claim Ready', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', evidence: 3 },
        { title: 'Bag delayed 18h in Lisbon', type: 'Baggage delay', status: 'Evidence', color: '#92400e', bg: '#fffbeb', border: '#fde68a', evidence: 2 },
      ].map((inc, i) => (
        <div key={i} style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#1A2B4A', margin: 0, flex: 1, paddingRight: 8, lineHeight: 1.4 }}>{inc.title}</p>
            <span style={{ fontSize: 9, fontWeight: 600, color: inc.color, background: inc.bg, border: `1px solid ${inc.border}`, borderRadius: 20, padding: '3px 8px', whiteSpace: 'nowrap' }}>{inc.status}</span>
          </div>
          <p style={{ fontSize: 11, color: '#aaa', margin: 0 }}>{inc.type} · {inc.evidence} evidence items</p>
        </div>
      ))}
    </div>
  ),
  routing: (
    <div style={{ padding: '14px 14px 70px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 14px' }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#15803d', margin: '0 0 4px' }}>2 coverage sources found</p>
        <p style={{ fontSize: 11, color: '#166534', margin: 0 }}>Flight delay 4h 12m — EU261 eligible</p>
      </div>
      {[
        { name: 'Allianz Travel Plan', coverage: 'Trip delay benefit', amount: '$150/night', type: 'insurance' },
        { name: 'Chase Sapphire Reserve', coverage: 'Travel delay reimbursement', amount: 'Up to $500', type: 'card' },
      ].map((r, i) => (
        <div key={i} style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 10, padding: '12px 14px' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#1A2B4A', margin: '0 0 2px' }}>{r.name}</p>
          <p style={{ fontSize: 11, color: '#888', margin: '0 0 4px' }}>{r.coverage}</p>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a' }}>{r.amount}</span>
        </div>
      ))}
    </div>
  ),
};

function PhoneMockup({ screen }: { screen: string }) {
  return (
    <div style={{
      width: 260, height: 560,
      borderRadius: 40,
      background: '#f7f8fa',
      boxShadow: '0 40px 80px rgba(0,0,0,0.2), 0 0 0 2px #2a2a2a, inset 0 0 0 1px rgba(255,255,255,0.06)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      flexShrink: 0,
      position: 'relative',
    }}>
      <div style={{ position: 'absolute', left: -2, top: 104, width: 2, height: 26, background: '#3a3a3a', borderRadius: '2px 0 0 2px' }} />
      <div style={{ position: 'absolute', left: -2, top: 138, width: 2, height: 40, background: '#3a3a3a', borderRadius: '2px 0 0 2px' }} />
      <div style={{ position: 'absolute', left: -2, top: 186, width: 2, height: 40, background: '#3a3a3a', borderRadius: '2px 0 0 2px' }} />
      <div style={{ position: 'absolute', right: -2, top: 128, width: 2, height: 52, background: '#3a3a3a', borderRadius: '0 2px 2px 0' }} />

      <div style={{ background: '#1A2B4A', padding: '38px 16px 12px', flexShrink: 0, position: 'relative' }}>
        <div style={{ width: 100, height: 26, background: '#111', borderRadius: 16, position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: 0 }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>Wayfarer</span>
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 9, fontWeight: 600, color: 'white' }}>JD</span>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {PHONE_SCREENS[screen]}
      </div>

      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: 58, background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(10px)',
        borderTop: '1px solid #eaeaea',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-around', paddingTop: 8,
      }}>
        {[
          { icon: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z', label: 'Trips' },
          { icon: 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z', label: 'Incidents' },
          { icon: 'M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7l-9-5z', label: 'Coverage' },
        ].map((tab, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flex: 1 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d={tab.icon} stroke="#bbb" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ fontSize: 8, color: '#bbb' }}>{tab.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FeaturesPage() {
  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', background: 'white' }}>
      <section style={{
        background: 'linear-gradient(160deg, #0d1b2a 0%, #0f2518 50%, #0d1b2a 100%)',
        padding: '140px 24px 96px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(ellipse at 30% 50%, rgba(46,95,163,0.15) 0%, transparent 60%)',
          pointerEvents: 'none',
        }} />
        <div style={{ maxWidth: 680, margin: '0 auto', position: 'relative' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 20, padding: '6px 14px', marginBottom: 28,
          }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Features</span>
          </div>
          <h1 style={{
            fontSize: 'clamp(32px, 5vw, 56px)',
            fontWeight: 800, color: 'white', margin: '0 0 20px',
            letterSpacing: '-1.5px', lineHeight: 1.1,
          }}>
            Everything you need to protect a trip
          </h1>
          <p style={{ fontSize: 'clamp(16px, 2vw, 19px)', color: 'rgba(255,255,255,0.5)', margin: 0, lineHeight: 1.65 }}>
            From pre-departure planning to claim resolution, Wayfarer covers every step of the journey.
          </p>
        </div>
      </section>

      {FEATURE_SECTIONS.map((section, i) => (
        <section key={i} style={{
          padding: '96px 24px',
          background: i % 2 === 0 ? 'white' : '#f7f8fa',
        }}>
          <div style={{
            maxWidth: 1100, margin: '0 auto',
            display: 'flex',
            flexDirection: section.flip ? 'row-reverse' : 'row',
            gap: 80, alignItems: 'center',
          }} className="features-row">
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{
                fontSize: 12, fontWeight: 700, color: section.tagColor,
                background: section.tagBg, borderRadius: 20,
                padding: '4px 12px', display: 'inline-block', marginBottom: 20,
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                {section.tag}
              </span>
              <h2 style={{ fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 800, color: '#0d1b2a', margin: '0 0 16px', letterSpacing: '-0.5px', lineHeight: 1.2 }}>
                {section.title}
              </h2>
              <p style={{ fontSize: 16, color: '#666', margin: '0 0 32px', lineHeight: 1.7 }}>
                {section.desc}
              </p>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {section.bullets.map((b, j) => (
                  <li key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 15, color: '#444', lineHeight: 1.5 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
                      <circle cx="12" cy="12" r="10" fill={section.tagBg} stroke={section.tagColor} strokeWidth="1.5"/>
                      <path d="M8 12l3 3 5-5" stroke={section.tagColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {b}
                  </li>
                ))}
              </ul>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', flexShrink: 0 }} className="features-phone">
              <PhoneMockup screen={section.image} />
            </div>
          </div>
        </section>
      ))}

      <section style={{ padding: '80px 24px', background: '#0d1b2a', textAlign: 'center' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 800, color: 'white', margin: '0 0 16px', letterSpacing: '-0.6px' }}>
            Ready to try it?
          </h2>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.5)', margin: '0 0 36px', lineHeight: 1.65 }}>
            Free to start. Upload your first policy in minutes.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/signup" style={{
              padding: '14px 30px', background: 'white', color: '#1A2B4A',
              borderRadius: 12, textDecoration: 'none', fontSize: 16, fontWeight: 700,
              display: 'inline-block',
            }}>
              Get started free
            </Link>
            <Link href="/pricing" style={{
              padding: '14px 24px',
              background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.75)',
              border: '1px solid rgba(255,255,255,0.14)',
              borderRadius: 12, textDecoration: 'none', fontSize: 16, fontWeight: 600,
              display: 'inline-block',
            }}>
              See pricing
            </Link>
          </div>
        </div>
      </section>

      <style>{`
        @media (max-width: 768px) {
          .features-row { flex-direction: column !important; gap: 48px !important; }
          .features-phone { width: 100%; }
        }
      `}</style>
    </div>
  );
}
