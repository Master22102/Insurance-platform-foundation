'use client';

import { useState } from 'react';
import Link from 'next/link';

const TIERS = [
  {
    name: 'Free',
    monthlyPrice: 0,
    annualPrice: 0,
    desc: 'For travelers who want to get organized before committing.',
    cta: 'Get started free',
    ctaHref: '/signup',
    highlight: false,
    limits: '3 trips · 1 policy scan · 1 active incident',
    features: [
      'Trip and itinerary management',
      'Up to 3 trips total',
      '1 policy quick-scan per month',
      '1 active incident at a time',
      'Basic evidence upload',
      'Manual claim routing',
    ],
  },
  {
    name: 'Explorer',
    monthlyPrice: 9,
    annualPrice: 7,
    desc: 'For regular travelers who need full coverage intelligence.',
    cta: 'Start Explorer',
    ctaHref: '/signup?plan=explorer',
    highlight: true,
    badge: 'Most popular',
    limits: 'Unlimited trips · 5 scans/mo · Unlimited incidents',
    features: [
      'Everything in Free',
      'Unlimited trips',
      '5 policy scans per month',
      'Unlimited active incidents',
      'Full evidence management',
      'Claim routing engine',
      'EU261 eligibility checker',
      'Priority support',
    ],
  },
  {
    name: 'Frequent',
    monthlyPrice: 19,
    annualPrice: 15,
    desc: 'For business travelers and frequent flyers who need full power.',
    cta: 'Start Frequent',
    ctaHref: '/signup?plan=frequent',
    highlight: false,
    limits: 'Unlimited scans · Data export · Advanced routing',
    features: [
      'Everything in Explorer',
      'Unlimited policy scans',
      'Advanced claim routing',
      'Data export (JSON)',
      'MFA / TOTP enrollment',
      'Jurisdiction-aware retention settings',
      'Extended audit log access',
    ],
  },
  {
    name: 'Lifetime',
    monthlyPrice: null,
    annualPrice: null,
    oneTimePrice: 149,
    desc: 'Pay once, travel forever. Everything in Frequent, no subscription.',
    cta: 'Get Lifetime access',
    ctaHref: '/signup?plan=lifetime',
    highlight: false,
    limits: 'One-time payment · No renewal',
    features: [
      'Everything in Frequent',
      'One-time payment, no subscription',
      'All future feature updates',
      'Founding member badge',
    ],
  },
  {
    name: 'Corporate',
    monthlyPrice: null,
    annualPrice: null,
    oneTimePrice: null,
    contactOnly: true,
    desc: 'For companies managing travel compliance and duty-of-care for employees.',
    cta: 'Contact us',
    ctaHref: 'mailto:hello@wayfarer.travel?subject=Corporate%20inquiry',
    highlight: false,
    limits: 'Custom seats · Central billing',
    features: [
      'Everything in Frequent, for every seat',
      'Multi-user access with role permissions',
      'Central billing and invoicing',
      'Dedicated account manager',
      'Custom retention and data policy',
      'Priority onboarding and setup',
    ],
  },
];

const COMPARISON_ROWS = [
  { feature: 'Trips', free: '3', explorer: 'Unlimited', frequent: 'Unlimited', lifetime: 'Unlimited' },
  { feature: 'Policy scans / month', free: '1', explorer: '5', frequent: 'Unlimited', lifetime: 'Unlimited' },
  { feature: 'Active incidents', free: '1', explorer: 'Unlimited', frequent: 'Unlimited', lifetime: 'Unlimited' },
  { feature: 'Claim routing', free: 'Manual', explorer: 'Full engine', frequent: 'Full engine', lifetime: 'Full engine' },
  { feature: 'Evidence management', free: 'Basic', explorer: 'Full', frequent: 'Full', lifetime: 'Full' },
  { feature: 'EU261 eligibility checker', free: false, explorer: true, frequent: true, lifetime: true },
  { feature: 'MFA enrollment', free: false, explorer: false, frequent: true, lifetime: true },
  { feature: 'Data export', free: false, explorer: false, frequent: true, lifetime: true },
  { feature: 'Jurisdiction retention settings', free: false, explorer: false, frequent: true, lifetime: true },
  { feature: 'Priority support', free: false, explorer: true, frequent: true, lifetime: true },
];

const FAQS = [
  {
    q: 'What counts as a policy scan?',
    a: 'A policy scan is when you upload a document (PDF, MHTML, or text) and Wayfarer extracts all coverage clauses using our document intelligence engine. Quick Scan previews also count toward your monthly limit.',
  },
  {
    q: 'Can I upgrade or downgrade at any time?',
    a: 'Yes. You can upgrade immediately and the new features take effect right away. Downgrades take effect at the end of your current billing period.',
  },
  {
    q: 'Does the Lifetime plan include future features?',
    a: 'Yes. Lifetime members receive all future feature updates — including new coverage families, document types, and routing improvements — at no additional cost.',
  },
  {
    q: 'Is my data safe if I cancel?',
    a: 'Yes. Your trip records, incidents, policies, and evidence remain accessible for 90 days after cancellation. You can export your data at any time from your account settings.',
  },
  {
    q: 'How does the Corporate plan work?',
    a: 'The Corporate plan is priced per seat and billed centrally. It includes everything in Frequent for every user, plus multi-user role permissions, a dedicated account manager, and custom data retention settings. Contact us to get a quote.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'We accept all major credit and debit cards (Visa, Mastercard, Amex, Discover) processed securely through Stripe.',
  },
];

function CheckIcon({ color = '#16a34a' }: { color?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill={color === '#16a34a' ? '#f0fdf4' : 'rgba(255,255,255,0.15)'} stroke={color} strokeWidth="1.5"/>
      <path d="M8 12l3 3 5-5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#f5f5f5" stroke="#e5e5e5" strokeWidth="1.5"/>
      <path d="M15 9l-6 6M9 9l6 6" stroke="#ccc" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

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
          backgroundImage: 'radial-gradient(ellipse at 70% 50%, rgba(46,95,163,0.12) 0%, transparent 60%)',
          pointerEvents: 'none',
        }} />
        <div style={{ maxWidth: 640, margin: '0 auto', position: 'relative' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 20, padding: '6px 14px', marginBottom: 28,
          }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Pricing</span>
          </div>
          <h1 style={{ fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 800, color: 'white', margin: '0 0 20px', letterSpacing: '-1.5px', lineHeight: 1.1 }}>
            Simple, honest pricing
          </h1>
          <p style={{ fontSize: 'clamp(16px, 2vw, 19px)', color: 'rgba(255,255,255,0.5)', margin: '0 0 36px', lineHeight: 1.65 }}>
            Start free. Upgrade when you need more. Cancel any time.
          </p>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 12,
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: 10, padding: '4px',
          }}>
            <button
              onClick={() => setAnnual(false)}
              style={{
                padding: '7px 18px', fontSize: 14, fontWeight: 600, borderRadius: 7, border: 'none', cursor: 'pointer',
                background: !annual ? 'white' : 'transparent',
                color: !annual ? '#1A2B4A' : 'rgba(255,255,255,0.6)',
              }}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              style={{
                padding: '7px 18px', fontSize: 14, fontWeight: 600, borderRadius: 7, border: 'none', cursor: 'pointer',
                background: annual ? 'white' : 'transparent',
                color: annual ? '#1A2B4A' : 'rgba(255,255,255,0.6)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              Annual
              <span style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 20, padding: '1px 7px' }}>Save 25%</span>
            </button>
          </div>
        </div>
      </section>

      <section style={{ padding: '64px 24px', background: '#f7f8fa' }}>
        <div style={{
          maxWidth: 1100, margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 20, alignItems: 'stretch',
        }}>
          {TIERS.map((tier) => (
            <div key={tier.name} style={{
              background: tier.highlight ? '#1A2B4A' : 'white',
              border: tier.highlight ? '2px solid #2E5FA3' : '1px solid #e8e8e8',
              borderRadius: 20,
              padding: '32px 28px',
              display: 'flex', flexDirection: 'column',
              position: 'relative',
              boxShadow: tier.highlight ? '0 20px 60px rgba(26,43,74,0.2)' : 'none',
            }}>
              {tier.badge && (
                <div style={{
                  position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                  background: '#2E5FA3', color: 'white',
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                  padding: '4px 14px', borderRadius: 20,
                  whiteSpace: 'nowrap',
                }}>
                  {tier.badge}
                </div>
              )}

              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: tier.highlight ? 'white' : '#1A2B4A', margin: '0 0 8px' }}>
                  {tier.name}
                </h3>
                <p style={{ fontSize: 13, color: tier.highlight ? 'rgba(255,255,255,0.55)' : '#888', margin: '0 0 20px', lineHeight: 1.5 }}>
                  {tier.desc}
                </p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  {(tier as any).contactOnly ? (
                    <span style={{ fontSize: 26, fontWeight: 800, color: '#1A2B4A', letterSpacing: '-0.5px' }}>
                      Custom pricing
                    </span>
                  ) : tier.oneTimePrice != null ? (
                    <>
                      <span style={{ fontSize: 36, fontWeight: 800, color: tier.highlight ? 'white' : '#1A2B4A', letterSpacing: '-1px' }}>
                        ${tier.oneTimePrice}
                      </span>
                      <span style={{ fontSize: 13, color: tier.highlight ? 'rgba(255,255,255,0.45)' : '#aaa' }}>one-time</span>
                    </>
                  ) : tier.monthlyPrice === 0 ? (
                    <span style={{ fontSize: 36, fontWeight: 800, color: tier.highlight ? 'white' : '#1A2B4A', letterSpacing: '-1px' }}>
                      Free
                    </span>
                  ) : (
                    <>
                      <span style={{ fontSize: 36, fontWeight: 800, color: tier.highlight ? 'white' : '#1A2B4A', letterSpacing: '-1px' }}>
                        ${annual ? tier.annualPrice : tier.monthlyPrice}
                      </span>
                      <span style={{ fontSize: 13, color: tier.highlight ? 'rgba(255,255,255,0.45)' : '#aaa' }}>/mo</span>
                    </>
                  )}
                </div>
                {annual && tier.monthlyPrice && tier.monthlyPrice > 0 && (
                  <p style={{ fontSize: 12, color: tier.highlight ? 'rgba(255,255,255,0.4)' : '#aaa', margin: '4px 0 0' }}>
                    Billed annually · ${(tier.annualPrice! * 12).toFixed(0)}/yr
                  </p>
                )}
              </div>

              <Link href={tier.ctaHref} style={{
                display: 'block', textAlign: 'center',
                padding: '12px 20px', borderRadius: 10, marginBottom: 24,
                textDecoration: 'none', fontSize: 14, fontWeight: 700,
                background: tier.highlight ? 'white' : '#1A2B4A',
                color: tier.highlight ? '#1A2B4A' : 'white',
              }}>
                {tier.cta}
              </Link>

              <p style={{ fontSize: 11, color: tier.highlight ? 'rgba(255,255,255,0.35)' : '#bbb', margin: '0 0 20px', textAlign: 'center' }}>
                {tier.limits}
              </p>

              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                {tier.features.map((f, j) => (
                  <li key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: tier.highlight ? 'rgba(255,255,255,0.8)' : '#555', lineHeight: 1.5 }}>
                    <CheckIcon color={tier.highlight ? 'rgba(255,255,255,0.7)' : '#16a34a'} />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: '80px 24px', background: 'white' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 800, color: '#0d1b2a', margin: '0 0 40px', textAlign: 'center', letterSpacing: '-0.5px' }}>
            Full comparison
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f0f0f0' }}>
                  <th style={{ textAlign: 'left', padding: '12px 16px', color: '#888', fontWeight: 600, fontSize: 12 }}>Feature</th>
                  {['Free', 'Explorer', 'Frequent', 'Lifetime'].map((h) => (
                    <th key={h} style={{ textAlign: 'center', padding: '12px 16px', color: h === 'Explorer' ? '#2E5FA3' : '#1A2B4A', fontWeight: 700, fontSize: 13 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f5f5f5', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={{ padding: '13px 16px', color: '#444', fontWeight: 500 }}>{row.feature}</td>
                    {(['free', 'explorer', 'frequent', 'lifetime'] as const).map((tier) => {
                      const val = row[tier];
                      return (
                        <td key={tier} style={{ padding: '13px 16px', textAlign: 'center' }}>
                          {typeof val === 'boolean' ? (
                            val ? <CheckIcon /> : <CrossIcon />
                          ) : (
                            <span style={{ fontSize: 13, color: '#555', fontWeight: 500 }}>{val}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section style={{ padding: '80px 24px', background: '#f7f8fa' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 800, color: '#0d1b2a', margin: '0 0 40px', textAlign: 'center', letterSpacing: '-0.5px' }}>
            Frequently asked questions
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {FAQS.map((faq, i) => (
              <div key={i} style={{
                background: 'white', border: '1px solid #e8e8e8', borderRadius: 12, overflow: 'hidden',
              }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{
                    width: '100%', padding: '18px 20px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'none', border: 'none', cursor: 'pointer',
                    textAlign: 'left', gap: 16,
                  }}
                >
                  <span style={{ fontSize: 15, fontWeight: 600, color: '#1A2B4A', lineHeight: 1.4 }}>{faq.q}</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, transform: openFaq === i ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}>
                    <path d="M6 9l6 6 6-6" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                {openFaq === i && (
                  <div style={{ padding: '0 20px 18px', fontSize: 14, color: '#666', lineHeight: 1.7 }}>
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: '80px 24px', background: '#0d1b2a', textAlign: 'center' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(24px, 3vw, 40px)', fontWeight: 800, color: 'white', margin: '0 0 16px', letterSpacing: '-0.6px' }}>
            Start free today
          </h2>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.5)', margin: '0 0 36px', lineHeight: 1.65 }}>
            No credit card required. Upgrade when you need more.
          </p>
          <Link href="/signup" style={{
            padding: '14px 36px', background: 'white', color: '#1A2B4A',
            borderRadius: 12, textDecoration: 'none', fontSize: 16, fontWeight: 700,
            display: 'inline-block',
          }}>
            Create free account
          </Link>
        </div>
      </section>
    </div>
  );
}
