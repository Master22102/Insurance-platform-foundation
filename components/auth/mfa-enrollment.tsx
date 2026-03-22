'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/auth/supabase-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Smartphone, CircleAlert as AlertCircle, CircleCheck as CheckCircle2 } from 'lucide-react';

export function MFAEnrollment() {
  const { user, profile, refreshProfile } = useAuth();
  const [enrolling, setEnrolling] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [disableCode, setDisableCode] = useState('');
  const [disableMode, setDisableMode] = useState(false);

  const handleEnrollTOTP = async () => {
    if (!user) return;

    setEnrolling(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp'
      });

      if (error) throw error;

      if (data) {
        setQrCode(data.totp.qr_code);
        setSecret(data.totp.secret);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to enroll MFA');
      setEnrolling(false);
    }
  };

  const handleVerifyTOTP = async () => {
    if (!user || !verificationCode) return;

    setError(null);

    try {
      const factors = await supabase.auth.mfa.listFactors();
      if (factors.error) throw factors.error;

      const totpFactor = factors.data?.totp?.[0];
      if (!totpFactor) {
        throw new Error('TOTP factor not found');
      }

      const challengeResult = await supabase.auth.mfa.challenge({
        factorId: totpFactor.id
      });

      if (challengeResult.error) throw challengeResult.error;

      const { error } = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challengeResult.data.id,
        code: verificationCode
      });

      if (error) throw error;

      await supabase.rpc('record_mfa_enrollment', {
        p_user_id: user.id,
        p_mfa_method: 'totp',
        p_action: 'enroll'
      });

      setSuccess(true);
      setEnrolling(false);
      await refreshProfile();
    } catch (err: any) {
      setError(err.message || 'Failed to verify code');
    }
  };

  const handleUnenroll = async () => {
    if (!user) return;

    try {
      const factors = await supabase.auth.mfa.listFactors();
      if (factors.error) throw factors.error;

      const totpFactor = factors.data?.totp?.[0];
      if (!totpFactor) return;

      if (disableCode.trim().length !== 6) {
        setError('Enter the 6-digit code from your authenticator to disable 2FA.');
        return;
      }

      const challengeResult = await supabase.auth.mfa.challenge({
        factorId: totpFactor.id,
      });
      if (challengeResult.error) throw challengeResult.error;

      const verifyRes = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challengeResult.data.id,
        code: disableCode.trim(),
      });
      if (verifyRes.error) throw verifyRes.error;

      const { error } = await supabase.auth.mfa.unenroll({
        factorId: totpFactor.id,
      });

      if (error) throw error;

      await supabase.rpc('record_mfa_enrollment', {
        p_user_id: user.id,
        p_mfa_method: 'totp',
        p_action: 'unenroll',
      });

      await refreshProfile();
      setSuccess(false);
      setQrCode(null);
      setSecret(null);
      setDisableMode(false);
      setDisableCode('');
    } catch (err: any) {
      setError(err.message || 'Failed to unenroll MFA');
    }
  };

  if (!user || !profile) return null;

  if (success) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            MFA Enabled
          </CardTitle>
          <CardDescription>Your account is now protected with two-factor authentication</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!disableMode ? (
            <Button variant="outline" onClick={() => { setDisableMode(true); setError(null); }}>
              Disable MFA
            </Button>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="disable-mfa-code-success">Current authenticator code</Label>
              <Input
                id="disable-mfa-code-success"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
              />
              <div className="flex gap-2">
                <Button variant="destructive" onClick={() => void handleUnenroll()}>
                  Confirm disable
                </Button>
                <Button variant="outline" onClick={() => { setDisableMode(false); setDisableCode(''); setError(null); }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (profile.mfa_enabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-600" />
            MFA Active
          </CardTitle>
          <CardDescription>
            Active methods: {(profile.mfa_methods || []).join(', ') || 'totp'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!disableMode ? (
            <Button variant="outline" onClick={() => { setDisableMode(true); setError(null); }}>
              Disable MFA
            </Button>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="disable-mfa-code-active">Current authenticator code</Label>
              <Input
                id="disable-mfa-code-active"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
              />
              <div className="flex gap-2">
                <Button variant="destructive" onClick={() => void handleUnenroll()}>
                  Confirm disable
                </Button>
                <Button variant="outline" onClick={() => { setDisableMode(false); setDisableCode(''); setError(null); }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          Enable Two-Factor Authentication
        </CardTitle>
        <CardDescription>
          Add an extra layer of security to your account with TOTP authentication
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!qrCode ? (
          <Button onClick={handleEnrollTOTP} disabled={enrolling}>
            {enrolling ? 'Setting up...' : 'Set up authenticator app'}
          </Button>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Step 1: Scan QR Code</p>
              <p className="text-sm text-gray-600">
                Use an authenticator app like Google Authenticator, Authy, or 1Password to scan this QR code.
              </p>
              {qrCode && (
                <div className="bg-white p-4 rounded-lg border inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element -- data URL from MFA setup */}
                  <img src={qrCode} alt="MFA QR Code" className="w-48 h-48" />
                </div>
              )}
              {secret && (
                <div className="space-y-1">
                  <p className="text-xs text-gray-600">Or enter this code manually:</p>
                  <code className="block bg-gray-100 p-2 rounded text-sm">{secret}</code>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Step 2: Enter Verification Code</p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="code">6-digit code</Label>
                  <Input
                    id="code"
                    type="text"
                    placeholder="123456"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    maxLength={6}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleVerifyTOTP} disabled={verificationCode.length !== 6}>
                Verify and Enable
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setQrCode(null);
                  setSecret(null);
                  setEnrolling(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
