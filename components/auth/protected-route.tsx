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

type CanonicalTier = 'FREE' | 'CORPORATE' | 'FOUNDER';

const tierHierarchy: Record<CanonicalTier, number> = {
  FREE: 0,
  CORPORATE: 1,
  FOUNDER: 2,
};

function normalizeTier(tier: string | null | undefined): CanonicalTier {
  if (tier === 'FOUNDER') return 'FOUNDER';
  if (tier === 'CORPORATE') return 'CORPORATE';
  return 'FREE';
}

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
    const userTier = normalizeTier(profile.membership_tier);
    const required = normalizeTier(requiredTier);
    const userTierLevel = tierHierarchy[userTier];
    const requiredTierLevel = tierHierarchy[required];

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
              This feature requires a {required} membership or higher. You currently have {userTier} tier.
            </AlertDescription>
          </Alert>
        </div>
      );
    }
  }

  return <>{children}</>;
}
