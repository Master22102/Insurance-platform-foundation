# Account and Membership Infrastructure Usage Guide

## Overview

Complete account management system with Supabase Auth integration, membership tiers, MFA support, per-device session tracking, and entitlement enforcement.

## Architecture

### Components

1. **Supabase Auth** - Built-in authentication with email/password
2. **user_profiles** - Extended profile data with membership tiers
3. **membership_entitlements** - Tier definitions and feature gates
4. **session_tokens** - Per-device session tracking
5. **account_actions_log** - Audit trail for sensitive actions
6. **Step-Up Verification** - Re-authentication for sensitive operations
7. **Event Emission** - Full audit trail via emit_event()

## Membership Tiers

### FREE Tier
- 5 basic scans per month
- 0 deep scans
- Max 3 trips
- Max 2 policies per trip
- Standard support

### STANDARD Tier
- Unlimited basic scans
- 10 deep scans per month
- Max 20 trips
- Max 10 policies per trip
- Data export enabled
- Organizer transfer enabled
- Standard support

### PREMIUM Tier
- Unlimited basic scans
- Unlimited deep scans
- Max 100 trips
- Max 50 policies per trip
- Data export enabled
- Organizer transfer enabled
- Claim assistance
- Priority support

### CORPORATE Tier
- Unlimited everything
- API access
- Multi-user workspaces
- Custom integrations
- Data export enabled
- Organizer transfer enabled
- Claim assistance
- Dedicated support

## Database Schema

### user_profiles

```sql
CREATE TABLE user_profiles (
  user_id uuid PRIMARY KEY,
  display_name text,
  avatar_url text,

  membership_tier text NOT NULL DEFAULT 'FREE',
  tier_granted_at timestamptz NOT NULL,
  tier_expires_at timestamptz,
  previous_tier text,

  scan_credits_remaining integer NOT NULL,
  deep_scan_credits_remaining integer NOT NULL,
  credits_reset_at timestamptz NOT NULL,

  mfa_enabled boolean NOT NULL DEFAULT false,
  mfa_methods text[],

  last_step_up_at timestamptz,

  onboarding_completed boolean NOT NULL DEFAULT false,
  preferences jsonb,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
```

### session_tokens

```sql
CREATE TABLE session_tokens (
  session_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,

  device_fingerprint text NOT NULL,
  device_name text,
  device_type text,
  user_agent text,
  ip_address inet,

  is_active boolean NOT NULL DEFAULT true,
  last_activity_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoked_reason text,

  step_up_verified_at timestamptz,
  requires_mfa boolean NOT NULL DEFAULT false,

  session_metadata jsonb
);
```

## RPCs and Functions

### check_membership_entitlement()

Check if user has access to a feature based on their membership tier.

```typescript
const { data } = await supabase.rpc('check_membership_entitlement', {
  p_user_id: userId,
  p_feature_check: 'deep_scan' // or 'basic_scan', 'export_data', 'api_access', etc.
});

if (data.allowed) {
  // Proceed with operation
} else {
  console.log('Access denied:', data.reason);
  // Show upgrade prompt
}
```

**Feature Checks:**
- `basic_scan` - Check if user has basic scan credits
- `deep_scan` - Check if user has deep scan credits
- `export_data` - Check if tier allows data export
- `api_access` - Check if tier allows API usage
- `transfer_organizer` - Check if tier allows organizer transfers
- `create_workspace` - Check if tier allows workspace creation

**Return Value:**
```json
{
  "allowed": true,
  "reason": null,
  "membership_tier": "PREMIUM",
  "scan_credits_remaining": 999999,
  "deep_scan_credits_remaining": 999999,
  "credits_reset_at": "2026-04-01T00:00:00Z",
  "entitlements": {...}
}
```

### consume_scan_credit()

Deduct a scan credit when performing a scan operation.

```typescript
const { data } = await supabase.rpc('consume_scan_credit', {
  p_user_id: userId,
  p_scan_type: 'deep', // or 'basic'
  p_trip_id: tripId
});

if (data.success) {
  console.log('Credits remaining:', data.deep_scan_credits_remaining);
} else {
  console.error('Failed to consume credit:', data.error);
}
```

### request_step_up_verification()

Check if step-up verification is required for a sensitive operation.

```typescript
const { data } = await supabase.rpc('request_step_up_verification', {
  p_user_id: userId,
  p_mutation_class: 'EXPORT_GRANT', // or ORGANIZER_TRANSFER, TIER_UPGRADE, MFA_DISABLE
  p_session_id: sessionId
});

if (data.required) {
  // Show re-auth dialog or MFA challenge
  console.log('MFA enabled:', data.mfa_enabled);
  console.log('Available methods:', data.available_methods);
} else {
  // Already verified or not required
  console.log('Reason:', data.reason);
}
```

**Sensitive Mutation Classes:**
- `EXPORT_GRANT` - Exporting user data
- `ORGANIZER_TRANSFER` - Transferring trip ownership
- `TIER_UPGRADE` - Upgrading membership tier
- `MFA_DISABLE` - Disabling MFA

**Step-up is valid for 15 minutes after verification**

### complete_step_up_verification()

Mark step-up verification as complete after successful re-auth or MFA.

```typescript
const { data } = await supabase.rpc('complete_step_up_verification', {
  p_user_id: userId,
  p_session_id: sessionId
});

console.log('Verified until:', data.expires_at);
```

### update_membership_tier()

Upgrade or downgrade a user's membership tier.

```typescript
const { data } = await supabase.rpc('update_membership_tier', {
  p_user_id: userId,
  p_new_tier: 'PREMIUM',
  p_expires_at: null, // or specific date for temporary upgrades
  p_actor_id: adminId // optional, for admin-initiated changes
});

if (data.success) {
  console.log('Upgraded from', data.old_tier, 'to', data.new_tier);
}
```

### record_mfa_enrollment()

Record MFA enrollment/unenrollment in user profile.

```typescript
// After successful MFA enrollment with Supabase Auth
const { data } = await supabase.rpc('record_mfa_enrollment', {
  p_user_id: userId,
  p_mfa_method: 'totp', // or 'sms'
  p_action: 'enroll' // or 'unenroll'
});
```

### create_session_token()

Create a new session token for device tracking.

```typescript
const { data } = await supabase.rpc('create_session_token', {
  p_user_id: userId,
  p_device_fingerprint: deviceFingerprint,
  p_device_name: 'My iPhone',
  p_device_type: 'mobile',
  p_user_agent: navigator.userAgent,
  p_ip_address: userIpAddress
});

console.log('Session ID:', data.session_id);
console.log('Expires:', data.expires_at);
```

### revoke_session_token()

Revoke a specific session (e.g., "sign out of this device").

```typescript
const { data } = await supabase.rpc('revoke_session_token', {
  p_session_id: sessionId,
  p_reason: 'user_initiated' // or 'security_concern', 'device_lost'
});
```

## Frontend Integration

### Setup AuthProvider

```tsx
// app/layout.tsx
import { AuthProvider } from '@/lib/auth/auth-context';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

### Use Auth Context

```tsx
'use client';

import { useAuth } from '@/lib/auth/auth-context';

export function MyComponent() {
  const { user, profile, signOut, checkEntitlement, hasFeatureAccess } = useAuth();

  const handleDeepScan = async () => {
    // Check entitlement before operation
    const result = await checkEntitlement('deep_scan');

    if (!result.allowed) {
      alert(`Cannot perform deep scan: ${result.reason}`);
      return;
    }

    // Consume credit
    await supabase.rpc('consume_scan_credit', {
      p_user_id: user.id,
      p_scan_type: 'deep',
      p_trip_id: tripId
    });

    // Proceed with deep scan
  };

  // Simple feature check
  const canExport = hasFeatureAccess('export');

  return (
    <div>
      <p>Welcome, {profile?.display_name}</p>
      <p>Tier: {profile?.membership_tier}</p>
      <p>Deep scans remaining: {profile?.deep_scan_credits_remaining}</p>

      {canExport && <button>Export Data</button>}
      <button onClick={handleDeepScan}>Deep Scan</button>
      <button onClick={signOut}>Sign Out</button>
    </div>
  );
}
```

### Protected Routes

```tsx
import { ProtectedRoute } from '@/components/auth/protected-route';

export default function PremiumPage() {
  return (
    <ProtectedRoute requiredTier="PREMIUM">
      <div>Premium content here</div>
    </ProtectedRoute>
  );
}
```

### Sign Up

```tsx
import { SignUpForm } from '@/components/auth/sign-up-form';

export default function SignUpPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <SignUpForm />
    </div>
  );
}
```

### Sign In

```tsx
import { SignInForm } from '@/components/auth/sign-in-form';

export default function SignInPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <SignInForm />
    </div>
  );
}
```

### Profile Card

```tsx
import { ProfileCard } from '@/components/auth/profile-card';

export default function ProfilePage() {
  return (
    <div className="container py-8">
      <ProfileCard />
    </div>
  );
}
```

### MFA Enrollment

```tsx
import { MFAEnrollment } from '@/components/auth/mfa-enrollment';

export default function SecurityPage() {
  return (
    <div className="container py-8">
      <MFAEnrollment />
    </div>
  );
}
```

## Entitlement-Gated Workflows

### Before Calling Governance Guards

Always check membership entitlement BEFORE calling `precheck_mutation_guard()`:

```typescript
async function performDeepScan(tripId: string, userId: string) {
  // Step 1: Check membership entitlement
  const { data: entitlement } = await supabase.rpc('check_membership_entitlement', {
    p_user_id: userId,
    p_feature_check: 'deep_scan'
  });

  if (!entitlement.allowed) {
    return {
      success: false,
      error: 'Membership tier insufficient',
      reason: entitlement.reason,
      current_tier: entitlement.membership_tier,
      upgrade_required: true
    };
  }

  // Step 2: Check governance guard
  const { data: guard } = await supabase.rpc('precheck_mutation_guard', {
    p_region_id: regionId,
    p_scope_type: 'trip',
    p_mutation_class: 'deep_scan'
  });

  if (!guard.allowed) {
    return {
      success: false,
      error: 'Blocked by governance',
      mode: guard.mode
    };
  }

  // Step 3: Consume credit
  await supabase.rpc('consume_scan_credit', {
    p_user_id: userId,
    p_scan_type: 'deep',
    p_trip_id: tripId
  });

  // Step 4: Perform operation
  const { data: result } = await supabase.rpc('perform_deep_scan', {
    p_trip_id: tripId
  });

  return result;
}
```

### Export with Step-Up Verification

```typescript
async function exportUserData(userId: string, sessionId: string) {
  // Step 1: Check entitlement
  const { data: entitlement } = await supabase.rpc('check_membership_entitlement', {
    p_user_id: userId,
    p_feature_check: 'export_data'
  });

  if (!entitlement.allowed) {
    throw new Error('Upgrade to STANDARD or higher for data export');
  }

  // Step 2: Check step-up verification
  const { data: stepUp } = await supabase.rpc('request_step_up_verification', {
    p_user_id: userId,
    p_mutation_class: 'EXPORT_GRANT',
    p_session_id: sessionId
  });

  if (stepUp.required) {
    // Show re-auth dialog
    await showReAuthDialog();

    // After successful re-auth, mark complete
    await supabase.rpc('complete_step_up_verification', {
      p_user_id: userId,
      p_session_id: sessionId
    });
  }

  // Step 3: Perform export
  const { data: exportData } = await supabase.rpc('export_user_data', {
    p_user_id: userId
  });

  return exportData;
}
```

## MFA Integration with Supabase Auth

### Enroll TOTP

```typescript
import { supabase } from '@/lib/auth/supabase-client';

async function enrollMFA(userId: string) {
  // Step 1: Enroll with Supabase Auth
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp'
  });

  if (error) throw error;

  // Show QR code to user
  console.log('QR Code:', data.totp.qr_code);
  console.log('Secret:', data.totp.secret);

  // Step 2: User scans and enters code
  const code = await getUserInput();

  // Step 3: Verify
  const factors = await supabase.auth.mfa.listFactors();
  const totpFactor = factors.data?.totp?.[0];

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId: totpFactor.id,
    code: code
  });

  if (verifyError) throw verifyError;

  // Step 4: Record in user profile
  await supabase.rpc('record_mfa_enrollment', {
    p_user_id: userId,
    p_mfa_method: 'totp',
    p_action: 'enroll'
  });
}
```

### Challenge MFA on Sign In

```typescript
async function signInWithMFA(email: string, password: string) {
  // Step 1: Sign in
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;

  // Step 2: Check if MFA required
  const factors = await supabase.auth.mfa.listFactors();

  if (factors.data?.totp && factors.data.totp.length > 0) {
    // Prompt user for MFA code
    const code = await getUserInput();

    // Step 3: Challenge MFA
    const { error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: factors.data.totp[0].id
    });

    if (challengeError) throw challengeError;

    // Step 4: Verify challenge
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: factors.data.totp[0].id,
      code: code
    });

    if (verifyError) throw verifyError;
  }

  return data;
}
```

## Event Emission

All account operations emit events:

- `account_created` - New user signup
- `account_updated` - Profile changes
- `tier_changed` - Membership tier upgrade/downgrade
- `mfa_enrolled` - MFA enabled
- `mfa_unenrolled` - MFA disabled
- `step_up_verification_requested` - Sensitive operation requires re-auth
- `step_up_verification_completed` - Re-auth successful
- `session_created` - New device session
- `session_revoked` - Session terminated
- `entitlement_check_failed` - User tried to access gated feature
- `scan_credits_depleted` - User ran out of credits

## Monthly Credit Reset

Credits automatically reset on the first day of each month via the `reset_monthly_scan_credits()` function. This should be called by a scheduled job (e.g., pg_cron):

```sql
SELECT cron.schedule(
  'reset-monthly-credits',
  '0 0 1 * *', -- First day of month at midnight
  'SELECT reset_monthly_scan_credits()'
);
```

## Security Best Practices

1. **Always check entitlements before operations** - Don't rely on UI hiding alone
2. **Use step-up verification for sensitive operations** - Force re-auth for EXPORT, TRANSFER, etc.
3. **Track sessions per-device** - Allow users to see and revoke sessions
4. **Emit events for audit trail** - Every sensitive action should be logged
5. **Validate tier expiration** - Auto-downgrade when subscription expires
6. **Enable MFA for high-value accounts** - Encourage PREMIUM/CORPORATE users to enable MFA
7. **Rate limit authentication attempts** - Use Supabase Auth built-in rate limiting
8. **Use RLS policies** - All tables have user-scoped access

## Testing

```typescript
// Test entitlement checking
const testEntitlements = async () => {
  const userId = 'test-user-id';

  const tests = [
    'basic_scan',
    'deep_scan',
    'export_data',
    'api_access',
    'transfer_organizer',
    'create_workspace'
  ];

  for (const test of tests) {
    const { data } = await supabase.rpc('check_membership_entitlement', {
      p_user_id: userId,
      p_feature_check: test
    });

    console.log(`${test}: ${data.allowed ? 'PASS' : 'FAIL'} (${data.reason || 'OK'})`);
  }
};
```

## Troubleshooting

### Credits not resetting
- Check `credits_reset_at` timestamp
- Ensure `reset_monthly_scan_credits()` is scheduled
- Manually trigger: `SELECT reset_monthly_scan_credits();`

### MFA not working
- Verify `auth.users.raw_app_meta_data` contains MFA factor
- Check `user_profiles.mfa_enabled` is true
- Ensure user scanned QR code correctly

### Step-up verification not required
- Check if operation is in sensitive mutation_classes list
- Verify `last_step_up_at` is older than 15 minutes
- Ensure `request_step_up_verification()` is called before operation

### Entitlement check failing
- Verify user_profile exists for user
- Check tier expiration date
- Ensure credits are available for scan operations
- Validate feature_check string matches defined checks
