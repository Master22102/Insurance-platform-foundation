'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';

export default function FoclLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user || !profile || profile.membership_tier !== 'FOUNDER') {
      router.replace('/trips');
    }
  }, [user, profile, loading, router]);

  if (loading || !user || !profile || profile.membership_tier !== 'FOUNDER') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa' }}>
        <div style={{ width: 28, height: 28, border: '2.5px solid #e5e5e5', borderTopColor: '#1A2B4A', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div>
      <div style={{ borderBottom: '1px solid #e5e7eb', background: '#fff' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '10px 16px', display: 'flex', gap: 16, alignItems: 'center' }}>
          <a href="/focl/features/intelligence" style={{ color: '#111827', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
            Feature Intelligence
          </a>
          <a href="/focl/notifications" style={{ color: '#4b5563', fontSize: 13, textDecoration: 'none' }}>
            Notification Destinations
          </a>
        </div>
      </div>
      {children}
    </div>
  );
}
