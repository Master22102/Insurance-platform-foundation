'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';

const NAV_LINKS = [
  {
    label: 'Trips',
    href: '/trips',
    icon: (active: boolean) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
          fill={active ? '#2E5FA3' : 'none'}
          stroke={active ? '#2E5FA3' : '#888'}
          strokeWidth="1.7"
        />
        <circle cx="12" cy="9" r="2.5" fill={active ? 'white' : '#bbb'} />
      </svg>
    ),
  },
  {
    label: 'Incidents',
    href: '/incidents',
    icon: (active: boolean) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
          stroke={active ? '#2E5FA3' : '#888'} strokeWidth="1.7"
          strokeLinecap="round" strokeLinejoin="round"
        />
        <path d="M12 9v4" stroke={active ? '#2E5FA3' : '#888'} strokeWidth="1.8" strokeLinecap="round"/>
        <circle cx="12" cy="17" r="1" fill={active ? '#2E5FA3' : '#888'}/>
      </svg>
    ),
  },
  {
    label: 'Coverage',
    href: '/coverage',
    icon: (active: boolean) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7l-9-5z"
          stroke={active ? '#2E5FA3' : '#888'} strokeWidth="1.7"
          strokeLinecap="round" strokeLinejoin="round"
        />
        <path d="M9 12l2 2 4-4" stroke={active ? '#2E5FA3' : '#888'} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    label: 'Claims',
    href: '/claims',
    icon: (active: boolean) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="2" width="16" height="20" rx="2" stroke={active ? '#2E5FA3' : '#888'} strokeWidth="1.7"/>
        <path d="M8 9h8M8 13h5M8 17h3" stroke={active ? '#2E5FA3' : '#888'} strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    label: 'Account',
    href: '/account',
    icon: (active: boolean) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="4" stroke={active ? '#2E5FA3' : '#888'} strokeWidth="1.7"/>
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={active ? '#2E5FA3' : '#888'} strokeWidth="1.7" strokeLinecap="round"/>
      </svg>
    ),
  },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/signin?return_url=${encodeURIComponent(pathname)}`);
    }
  }, [user, loading, pathname]);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#fafafa',
      }}>
        <div style={{
          width: 32, height: 32, border: '2.5px solid #e5e5e5',
          borderTopColor: '#1A2B4A', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#f7f8fa', display: 'flex', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Desktop sidebar */}
      <aside style={{
        width: 240, background: 'white',
        borderRight: '1px solid #eaeaea',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, bottom: 0, left: 0,
        zIndex: 40,
      }}
        className="hidden-mobile"
      >
        <div style={{ padding: '24px 20px 20px' }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#1A2B4A', letterSpacing: '-0.4px' }}>
            Wayfarer
          </span>
        </div>

        <nav style={{ flex: 1, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href || pathname.startsWith(link.href + '/');
            return (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 10px', borderRadius: 8,
                  textDecoration: 'none',
                  background: active ? '#eff4fc' : 'transparent',
                  color: active ? '#2E5FA3' : '#555',
                  fontSize: 14, fontWeight: active ? 600 : 400,
                  transition: 'background 0.12s ease',
                }}
              >
                {link.icon(active)}
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div style={{
          padding: '16px 12px',
          borderTop: '1px solid #f0f0f0',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 10px', borderRadius: 8,
            background: '#f7f8fa',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'linear-gradient(135deg, #2E5FA3 0%, #1A2B4A 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 600, color: 'white', flexShrink: 0,
            }}>
              {user.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: '#222', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.email}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content — offset for sidebar on desktop */}
      <main style={{ flex: 1, minWidth: 0 }} className="main-with-sidebar">
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '32px 24px 120px' }}
          className="main-content-padding"
        >
          {children}
        </div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: 72, background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(12px)',
        borderTop: '1px solid #eaeaea',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-around',
        paddingTop: 10, zIndex: 50,
      }}
        className="mobile-tab-bar"
      >
        {NAV_LINKS.map((link) => {
          const active = pathname === link.href || pathname.startsWith(link.href + '/');
          return (
            <Link
              key={link.href}
              href={link.href}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                textDecoration: 'none', minWidth: 0, flex: 1,
                minHeight: 44, justifyContent: 'flex-start', paddingTop: 2,
              }}
            >
              {link.icon(active)}
              <span style={{
                fontSize: 10, fontWeight: active ? 600 : 400,
                color: active ? '#2E5FA3' : '#999',
                letterSpacing: '-0.01em',
              }}>
                {link.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <style>{`
        @media (min-width: 1024px) {
          .hidden-mobile { display: flex !important; }
          .mobile-tab-bar { display: none !important; }
          .main-with-sidebar { margin-left: 240px; }
          .main-content-padding { padding-bottom: 32px !important; }
        }
        @media (max-width: 1023px) {
          .hidden-mobile { display: none !important; }
          .mobile-tab-bar { display: flex !important; }
          .main-with-sidebar { margin-left: 0; }
        }
      `}</style>
    </div>
  );
}
