'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';

export default function MarketingNav() {
  const { user, signOut } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const pathname = usePathname();

  const handleOpenApp = () => {
    setMenuOpen(false);
    // Full navigation is more reliable on mobile after auth transitions.
    window.location.assign('/trips');
  };

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      setMenuOpen(false);
      window.location.assign('/');
    } finally {
      setSigningOut(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    // Close drawer whenever route changes.
    setMenuOpen(false);
  }, [pathname]);

  const isScrolled = mounted && scrolled;

  const navLinks = [
    { href: '/features', label: 'Features' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/security', label: 'Security' },
    { href: '/blog', label: 'Blog' },
  ];

  return (
    <header style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      background: isScrolled ? 'rgba(255,255,255,0.96)' : 'transparent',
      backdropFilter: isScrolled ? 'blur(16px)' : 'none',
      borderBottom: isScrolled ? '1px solid rgba(0,0,0,0.06)' : '1px solid transparent',
      transition: 'background 0.3s ease, border-color 0.3s ease, backdrop-filter 0.3s ease',
    }}>
      <div style={{
        maxWidth: 1200, margin: '0 auto',
        padding: '0 24px',
        height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: '#1A2B4A',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7l-9-5z"
                fill="rgba(255,255,255,0.25)" stroke="white" strokeWidth="1.8"/>
              <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={{
            fontSize: 16, fontWeight: 700,
            color: isScrolled ? '#1A2B4A' : 'white',
            letterSpacing: '-0.3px',
            transition: 'color 0.3s ease',
          }}>
            Wayfarer
          </span>
        </Link>

        <nav style={{ display: 'flex', alignItems: 'center', gap: 2 }} className="marketing-desktop-nav">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} style={{
              padding: '7px 14px',
              fontSize: 14, fontWeight: 500,
              color: isScrolled ? (pathname === link.href ? '#1A2B4A' : '#555') : 'rgba(255,255,255,0.8)',
              textDecoration: 'none',
              borderRadius: 8,
              background: pathname === link.href && isScrolled ? '#f0f4ff' : 'transparent',
              transition: 'color 0.3s ease',
            }}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }} className="marketing-desktop-nav">
          {user ? (
            <>
              <button
                onClick={handleOpenApp}
                style={{
                padding: '8px 16px', fontSize: 14, fontWeight: 600,
                color: isScrolled ? '#1A2B4A' : 'white',
                borderRadius: 8,
                border: isScrolled ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,0.25)',
                background: 'transparent',
                cursor: 'pointer',
              }}
              >
                Open app
              </button>
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                style={{
                  padding: '8px 14px',
                  fontSize: 14,
                  fontWeight: 600,
                  color: isScrolled ? '#6b7280' : 'rgba(255,255,255,0.85)',
                  background: 'transparent',
                  border: 'none',
                  cursor: signingOut ? 'not-allowed' : 'pointer',
                  opacity: signingOut ? 0.6 : 1,
                }}
              >
                {signingOut ? 'Signing out…' : 'Sign out'}
              </button>
            </>
          ) : (
            <>
              <Link href="/signin" style={{
                padding: '8px 16px', fontSize: 14, fontWeight: 500,
                color: isScrolled ? '#555' : 'rgba(255,255,255,0.8)',
                textDecoration: 'none',
                borderRadius: 8,
                transition: 'color 0.3s ease',
              }}>
                Sign in
              </Link>
              <Link href="/splash" style={{
                padding: '8px 18px', fontSize: 14, fontWeight: 600,
                background: isScrolled ? '#1A2B4A' : 'white',
                color: isScrolled ? 'white' : '#1A2B4A',
                textDecoration: 'none',
                borderRadius: 8,
                transition: 'background 0.3s ease, color 0.3s ease',
              }}>
                Get started free
              </Link>
            </>
          )}
        </div>

        <button
          onClick={() => setMenuOpen(!menuOpen)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: isScrolled ? '#333' : 'white' }}
          className="marketing-mobile-menu"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            {menuOpen ? (
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            ) : (
              <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            )}
          </svg>
        </button>
      </div>

      {menuOpen && (
        <div style={{
          background: 'white', borderTop: '1px solid #f0f0f0',
          padding: '12px 16px 18px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }} className="marketing-mobile-menu">
          <div style={{ background: '#f8fafc', border: '1px solid #edf2f7', borderRadius: 14, overflow: 'hidden' }}>
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '13px 14px',
                fontSize: 15, fontWeight: 600, color: '#1f2937',
                textDecoration: 'none',
                borderBottom: '1px solid #eef2f7',
              }}>
                {link.label}
                <span style={{ color: '#9ca3af' }}>›</span>
              </Link>
            ))}
          </div>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {user ? (
              <>
                <button
                  onClick={handleOpenApp}
                  style={{
                  display: 'block', width: '100%', padding: '12px 0', textAlign: 'center',
                  fontSize: 15, fontWeight: 700, color: 'white',
                  background: '#1A2B4A', borderRadius: 10, border: 'none', cursor: 'pointer',
                }}
                >
                  Open app
                </button>
                <button
                  onClick={handleSignOut}
                  disabled={signingOut}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '12px 0',
                    textAlign: 'center',
                    fontSize: 15,
                    fontWeight: 600,
                    color: '#6b7280',
                    border: '1px solid #e5e7eb',
                    borderRadius: 10,
                    background: 'white',
                    cursor: signingOut ? 'not-allowed' : 'pointer',
                    opacity: signingOut ? 0.6 : 1,
                  }}
                >
                  {signingOut ? 'Signing out…' : 'Sign out'}
                </button>
              </>
            ) : (
              <>
                <Link href="/signin" onClick={() => setMenuOpen(false)} style={{
                  display: 'block', padding: '12px 0', textAlign: 'center',
                  fontSize: 15, fontWeight: 600, color: '#555',
                  textDecoration: 'none', border: '1px solid #e5e7eb', borderRadius: 10,
                }}>
                  Sign in
                </Link>
                <Link href="/splash" onClick={() => setMenuOpen(false)} style={{
                  display: 'block', padding: '12px 0', textAlign: 'center',
                  fontSize: 15, fontWeight: 700, color: 'white',
                  textDecoration: 'none', background: '#1A2B4A', borderRadius: 10,
                }}>
                  Get started free
                </Link>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        @media (min-width: 768px) {
          .marketing-desktop-nav { display: flex !important; }
          .marketing-mobile-menu { display: none !important; }
        }
        @media (max-width: 767px) {
          .marketing-desktop-nav { display: none !important; }
          .marketing-mobile-menu { display: flex !important; }
        }
      `}</style>
    </header>
  );
}
