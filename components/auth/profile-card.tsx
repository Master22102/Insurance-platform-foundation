'use client';
import React from 'react';
import { useAuth, TripUnlockState } from '@/lib/auth/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MembershipBadge } from './membership-badge';
import { Shield, Scan, LogOut, MapPin, CircleAlert as AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface ProfileCardProps { activeTripUnlock?: TripUnlockState; }

export function ProfileCard({ activeTripUnlock }: ProfileCardProps) {
  const { user, profile, signOut, loading, isAtLifetimeCap, getLifetimeScansRemaining } = useAuth();

  if (loading) return (
    <Card className="w-full max-w-2xl"><CardContent className="pt-6">
      <div className="space-y-4">
        <div className="h-4 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
      </div>
    </CardContent></Card>
  );
  if (!user || !profile) return null;

  const atCap = isAtLifetimeCap();
  const remaining = getLifetimeScansRemaining();

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {profile.display_name || user.email}
              <MembershipBadge tier={profile.membership_tier} />
            </CardTitle>
            <CardDescription>{user.email}</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={signOut}><LogOut className="h-4 w-4 mr-2" />Sign Out</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">

        {profile.membership_tier === 'FREE' && (
          <div className={`rounded-lg p-4 border ${atCap ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
            <div className="flex items-center gap-2 mb-1">
              <Scan className={`h-4 w-4 ${atCap ? 'text-red-500' : 'text-blue-600'}`} />
              <span className="font-medium text-sm">Free Quick Scans</span>
            </div>
            {atCap
              ? <p className="text-sm text-red-700">Both free scans used. Unlock a trip to continue.</p>
              : <p className="text-sm text-blue-700">{remaining} of 2 free scan{remaining !== 1 ? 's' : ''} remaining. These do not reset.</p>
            }
          </div>
        )}

        {activeTripUnlock && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-gray-700">Active Trip Credits</h4>
            {activeTripUnlock.paid_unlock ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Deep Scan credits</span>
                  <span className={`font-medium ${activeTripUnlock.deep_scan_credits_remaining === 0 ? 'text-red-600' : 'text-green-700'}`}>
                    {activeTripUnlock.deep_scan_credits_remaining} remaining
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Quick Scans this week</span>
                  <span className="text-gray-600">{activeTripUnlock.quick_scans_used_this_week} / 4</span>
                </div>
                {activeTripUnlock.deep_scan_credits_remaining === 0 && (
                  <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 rounded p-2">
                    <AlertCircle className="h-3 w-3 flex-shrink-0" />
                    <span>Deep Scan credits exhausted. Purchase additional credits to continue.</span>
                  </div>
                )}
              </div>
            ) : <p className="text-sm text-gray-500">Trip not yet unlocked.</p>}
          </div>
        )}

        {profile.residence_country_code && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <MapPin className="h-4 w-4" />
            <span>{profile.residence_country_code}{profile.residence_state_code ? `, ${profile.residence_state_code}` : ''}</span>
          </div>
        )}

        <div className="space-y-2 pt-3 border-t">
          <h4 className="font-medium text-sm">Account Security</h4>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Shield className={profile.mfa_enabled ? 'h-4 w-4 text-green-600' : 'h-4 w-4 text-gray-400'} />
              <span>Multi-Factor Authentication</span>
            </div>
            <span className={profile.mfa_enabled ? 'text-green-600 font-medium' : 'text-gray-500'}>
              {profile.mfa_enabled ? 'Enabled' : 'Not Enabled'}
            </span>
          </div>
        </div>

        {profile.tier_expires_at && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-800">Corporate access expires on {format(new Date(profile.tier_expires_at), 'MMM d, yyyy')}</p>
          </div>
        )}

      </CardContent>
    </Card>
  );
}
