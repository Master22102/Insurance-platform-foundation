'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function MarketingFooter() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentYear, setCurrentYear] = useState(2026);

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    await fetch('/api/marketing/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), source: 'footer' }),
    });
    setSubmitting(false);
    setSubmitted(true);
  };

  return (
    <footer style={{
      background: '#0d1b2a',
      color: 'white',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '64px 24px 40px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 40,
          marginBottom: 56,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 7,
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7l-9-5z"
                    fill="rgba(255,255,255,0.15)" stroke="white" strokeWidth="1.8"/>
                  <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.3px' }}>Wayfarer</span>
            </div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7, margin: 0, maxWidth: 200 }}>
              Travel smarter. Know your coverage. Document everything.
            </p>
          </div>

          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 14px' }}>
              Product
            </p>
            {[
              { href: '/features', label: 'Features' },
              { href: '/pricing', label: 'Pricing' },
              { href: '/signup', label: 'Get started free' },
              { href: '/signin', label: 'Sign in' },
            ].map((link) => (
              <Link key={link.href} href={link.href} style={{
                display: 'block', fontSize: 14, color: 'rgba(255,255,255,0.6)',
                textDecoration: 'none', marginBottom: 10,
                transition: 'color 0.15s ease',
              }}>
                {link.label}
              </Link>
            ))}
          </div>

          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 14px' }}>
              Company
            </p>
            {[
              { href: '/blog', label: 'Blog' },
              { href: '/security', label: 'Security' },
              { href: '/status', label: 'Status' },
            ].map((link) => (
              <Link key={link.href} href={link.href} style={{
                display: 'block', fontSize: 14, color: 'rgba(255,255,255,0.6)',
                textDecoration: 'none', marginBottom: 10,
              }}>
                {link.label}
              </Link>
            ))}
          </div>

          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 14px' }}>
              Legal
            </p>
            {[
              { href: '/privacy', label: 'Privacy policy' },
              { href: '/terms', label: 'Terms of service' },
            ].map((link) => (
              <Link key={link.href} href={link.href} style={{
                display: 'block', fontSize: 14, color: 'rgba(255,255,255,0.6)',
                textDecoration: 'none', marginBottom: 10,
              }}>
                {link.label}
              </Link>
            ))}
          </div>

          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 14px' }}>
              Stay updated
            </p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: '0 0 14px', lineHeight: 1.6 }}>
              New guides, feature updates, and travel tips.
            </p>
            {submitted ? (
              <p style={{ fontSize: 13, color: '#4ade80', fontWeight: 500 }}>You&apos;re on the list.</p>
            ) : (
              <form onSubmit={handleSubscribe} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  style={{
                    padding: '9px 12px', fontSize: 13,
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 8, color: 'white', outline: 'none',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                  }}
                />
                <button type="submit" disabled={submitting} style={{
                  padding: '9px 16px', fontSize: 13, fontWeight: 600,
                  background: 'white', color: '#1A2B4A',
                  border: 'none', borderRadius: 8, cursor: submitting ? 'wait' : 'pointer',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}>
                  {submitting ? 'Subscribing…' : 'Subscribe'}
                </button>
              </form>
            )}
          </div>
        </div>

        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.08)',
          paddingTop: 28,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 12,
        }}>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', margin: 0 }}>
            &copy; {currentYear} Wayfarer. All rights reserved.
          </p>
          <div style={{ display: 'flex', gap: 20 }}>
            <Link href="/privacy" style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>Privacy</Link>
            <Link href="/terms" style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
