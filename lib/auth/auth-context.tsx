'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from './supabase-client';

export interface UserProfile {
  user_id: string;
  display_name: string | null;
  membership_tier: 'FREE' | 'CORPORATE' | 'FOUNDER';
  tier_granted_at: string;
  tier_expires_at: string | null;
  previous_tier: string | null;
  lifetime_quick_scans_used: number;
  residence_country_code: string | null;
  residence_state_code: string | null;
  primary_nationality: string | null;
  secondary_nationality: string | null;
  mfa_enabled: boolean;
  mfa_methods: string[];
  last_step_up_at: string | null;
  onboarding_completed: boolean;
  preferences?: any;
}

export interface TripUnlockState {
  trip_id: string;
  paid_unlock: boolean;
  paid_unlock_at: string | null;
  deep_scan_credits_remaining: number;
  deep_scan_credits_purchased: number;
  quick_scans_used_this_week: number;
  quick_scan_week_reset_at: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  canQuickScan: () => boolean;
  canQuickScanOnTrip: (trip: TripUnlockState) => boolean;
  canDeepScan: (trip: TripUnlockState) => boolean;
  isAtLifetimeCap: () => boolean;
  isCorporate: () => boolean;
  isFounder: () => boolean;
  getLifetimeScansRemaining: () => number;
}

const defaultAuthContext: AuthContextType = {
  user: null,
  session: null,
  profile: null,
  loading: true,
  signUp: async () => ({ error: null }),
  signIn: async () => ({ error: null }),
  signOut: async () => {},
  refreshProfile: async () => {},
  canQuickScan: () => false,
  canQuickScanOnTrip: () => false,
  canDeepScan: () => false,
  isAtLifetimeCap: () => false,
  isCorporate: () => false,
  isFounder: () => false,
  getLifetimeScansRemaining: () => 0,
};

const AuthContext = createContext<AuthContextType>(defaultAuthContext);

const CLIENT_SESSION_KEY = 'wayfarer_client_session_id_v1';

function touchTrackedSession() {
  if (typeof window === 'undefined') return;
  try {
    let id = sessionStorage.getItem(CLIENT_SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(CLIENT_SESSION_KEY, id);
    }
    void fetch('/api/session/touch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ clientSessionId: id }),
    });
  } catch {
    /* non-fatal */
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase.from('user_profiles').select('*').eq('user_id', userId).maybeSingle();
      if (data && !error) setProfile(data as UserProfile);
    } catch {}
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
        touchTrackedSession();
      }
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
        touchTrackedSession();
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, displayName?: string) => {
    const emailRedirectTo =
      typeof window !== 'undefined'
        ? `${window.location.origin}/auth/confirmed`
        : undefined;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: { display_name: displayName || email.split('@')[0] },
      },
    });
    return { error };
  };
  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };
  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };
  const refreshProfile = async () => { if (user) await fetchProfile(user.id); };

  const canQuickScan = () => !profile ? false : profile.lifetime_quick_scans_used < 2;
  const canQuickScanOnTrip = (trip: TripUnlockState) => {
    if (!trip.paid_unlock) return false;
    if (trip.quick_scan_week_reset_at) {
      const expired = new Date(trip.quick_scan_week_reset_at) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      if (expired) return true;
    }
    return trip.quick_scans_used_this_week < 4;
  };
  const canDeepScan = (trip: TripUnlockState) => trip.paid_unlock && trip.deep_scan_credits_remaining > 0;
  const isAtLifetimeCap = () => !profile ? false : profile.membership_tier === 'FREE' && profile.lifetime_quick_scans_used >= 2;
  const isCorporate = () => profile?.membership_tier === 'CORPORATE';
  const isFounder = () => profile?.membership_tier === 'FOUNDER';
  const getLifetimeScansRemaining = () => !profile ? 0 : Math.max(0, 2 - profile.lifetime_quick_scans_used);

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signUp, signIn, signOut, refreshProfile,
      canQuickScan, canQuickScanOnTrip, canDeepScan, isAtLifetimeCap, isCorporate, isFounder, getLifetimeScansRemaining }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
