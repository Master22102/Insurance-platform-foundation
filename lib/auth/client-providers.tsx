'use client';

import dynamic from 'next/dynamic';
import SplashGate from '@/components/SplashGate';

const AuthProvider = dynamic(
  () => import('@/lib/auth/auth-context').then((mod) => mod.AuthProvider),
  { ssr: false }
);

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SplashGate>{children}</SplashGate>
    </AuthProvider>
  );
}
