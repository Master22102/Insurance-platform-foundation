'use client';

import { useMemo } from 'react';
import { useIsMobile, useIsTablet } from '@/lib/hooks/useIsMobile';
import { mobileStyles, tabletStyles } from '@/lib/styles/responsive';

type RegulationSection = {
  id: string;
  title: string;
  updated: string;
  rows: Array<{ topic: string; detail: string }>;
  note?: string;
};

function SectionTable({ section, compactTable }: { section: RegulationSection; compactTable?: boolean }) {
  return (
    <section id={section.id} style={{ marginBottom: 22, scrollMarginTop: 84 }}>
      <h2 style={{ margin: '0 0 6px', fontSize: 20, color: '#0f172a' }}>{section.title}</h2>
      <p style={{ margin: '0 0 10px', fontSize: 12, color: '#64748b' }}>Last updated: {section.updated}</p>
      <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={{ textAlign: 'left', fontSize: 12, color: '#334155', padding: '10px 12px', borderBottom: '1px solid #e2e8f0' }}>Topic</th>
              <th style={{ textAlign: 'left', fontSize: 12, color: '#334155', padding: '10px 12px', borderBottom: '1px solid #e2e8f0' }}>Reference</th>
            </tr>
          </thead>
          <tbody>
            {section.rows.map((row) => (
              <tr key={row.topic}>
                <td style={{ verticalAlign: 'top', width: '30%', padding: '10px 12px', borderBottom: '1px solid #f1f5f9', fontSize: 12, fontWeight: 600, color: '#1e293b' }}>
                  {row.topic}
                </td>
                <td style={{ verticalAlign: 'top', padding: '10px 12px', borderBottom: '1px solid #f1f5f9', fontSize: 12, color: '#334155', lineHeight: 1.6 }}>
                  {row.detail}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {section.note ? <p style={{ margin: '9px 0 0', fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>{section.note}</p> : null}
    </section>
  );
}

export default function RightsReferencePage() {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const sections = useMemo<RegulationSection[]>(
    () => [
      {
        id: 'eu261',
        title: 'EU Regulation 261/2004 - Air Passenger Rights',
        updated: 'Mar 18, 2026',
        rows: [
          { topic: 'Applies to', detail: 'Flights departing from EU airports on any airline, or flights arriving in the EU on EU-based airlines.' },
          { topic: 'Delay thresholds', detail: '2+ hours short haul (<1500 km): meals/refreshments. 3+ hours medium haul (1500-3500 km): meals, refreshments, communication. 5+ hours: full refund or rebooking option.' },
          { topic: 'Arrival delay compensation', detail: 'Under EU Regulation 261/2004, passengers may be entitled to EUR250-EUR600 for 3+ hour arrival delay, depending on distance and circumstances.' },
          { topic: 'Cancellation compensation', detail: 'Under EU Regulation 261/2004, notice under 14 days before departure may carry compensation bands of EUR250-EUR600. Notice >=14 days generally removes compensation but keeps refund/rebooking options.' },
          { topic: 'Distance bands', detail: 'Up to 1,500 km: EUR250. 1,500-3,500 km: EUR350. Over 3,500 km: EUR600.' },
          { topic: 'Extraordinary circumstances', detail: 'Severe weather, ATC restrictions, security risks, political instability, and certain strike scenarios can limit carrier compensation liability.' },
        ],
        note: 'This is a simplified regulatory reference. Actual rights depend on route facts, timing, and case details.',
      },
      {
        id: 'montreal',
        title: 'Montreal Convention - International Baggage Liability',
        updated: 'Mar 18, 2026',
        rows: [
          { topic: 'Applies to', detail: 'International carriage between convention signatory states.' },
          { topic: 'Baggage delay', detail: 'Airline liability may apply for damage caused by checked-baggage delay, up to about 1,288 SDR (approximate USD equivalent fluctuates).' },
          { topic: 'Delay claim window', detail: 'A written claim for delayed baggage is generally filed within 21 days of baggage delivery.' },
          { topic: 'Baggage loss', detail: 'Baggage is typically considered lost after 21 days if not delivered.' },
          { topic: 'Loss claim window', detail: 'Loss claims are generally subject to a 2-year filing period.' },
          { topic: 'Baggage damage', detail: 'Damage should be reported promptly, with written claim usually within 7 days of receiving damaged baggage.' },
        ],
        note: 'SDR values are variable. Currency conversion examples are approximate and for reference only.',
      },
      {
        id: 'us-dot',
        title: 'US Department of Transportation - Passenger Protections',
        updated: 'Mar 18, 2026',
        rows: [
          { topic: 'Tarmac delay care', detail: 'Food, water, and restroom access are generally required after 2 hours for delayed aircraft on the tarmac.' },
          { topic: 'Deplaning threshold', detail: 'Deplaning opportunity is generally required by 3 hours (domestic) or 4 hours (international), subject to safety and control exceptions.' },
          { topic: 'Denied boarding', detail: 'Under US DOT denied boarding rules, passengers may be eligible for compensation up to 400% of one-way fare, with published maximum caps.' },
          { topic: 'Cancellation/significant change', detail: 'When an airline cancels or significantly changes a flight and passenger does not travel, refund obligations may apply including certain fees.' },
        ],
        note: 'This page is regulatory reference information, not legal advice.',
      },
    ],
    [],
  );

  return (
    <div
      style={{
        ...(isMobile ? mobileStyles.appContentMobile : isTablet ? tabletStyles.appContent : { padding: '8px 20px 40px' }),
        maxWidth: 980,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        boxSizing: 'border-box',
      }}
      data-testid="rights-page-root"
    >
      <h1 style={{ margin: '0 0 8px', fontSize: 28, color: '#0f172a' }}>Statutory rights advisory</h1>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
        This is regulatory reference information, not legal advice. It summarizes selected passenger-rights frameworks in plain language.
      </p>
      {sections.map((section) => (
        <SectionTable key={section.id} section={section} compactTable={isMobile} />
      ))}
    </div>
  );
}
