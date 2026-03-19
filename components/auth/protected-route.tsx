'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CircleAlert as AlertCircle } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredTier?: 'FREE' | 'STANDARD' | 'PREMIUM' | 'CORPORATE' | 'FOUNDER';
  fallback?: React.ReactNode;
}

const tierHierarchy: Record<NonNullable<ProtectedRouteProps['requiredTier']>, number> = {
  FREE: 0,
  STANDARD: 1,
  PREMIUM: 2,
  CORPORATE: 3,
  FOUNDER: 4,
};

export function ProtectedRoute({ children, requiredTier, fallback }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/sign-in');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="space-y-4 text-center">
          <div className="h-8 w-8 border-4 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return null;
  }

  if (requiredTier && profile) {
    const userTierLevel = tierHierarchy[profile.membership_tier as keyof typeof tierHierarchy] ?? 0;
    const requiredTierLevel = tierHierarchy[requiredTier];

    if (userTierLevel < requiredTierLevel) {
      if (fallback) {
        return <>{fallback}</>;
      }

      return (
        <div className="flex items-center justify-center min-h-screen p-4">
          <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Upgrade Required</AlertTitle>
            <AlertDescription>
              This feature requires a {requiredTier} membership or higher. You currently have {profile.membership_tier} tier.
            </AlertDescription>
          </Alert>
        </div>
      );
    }
  }

  return <>{children}</>;
}
