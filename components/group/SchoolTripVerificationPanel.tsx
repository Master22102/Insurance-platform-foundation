'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type PendingRequest = {
  request_id: string;
  subject_id: string;
  guardian_id?: string | null;
  status: string;
  subject_approved?: boolean;
  guardian_approved?: boolean;
  requires_dual_approval?: boolean;
  expires_at: string;
};

type Props = {
  tripName: string;
  schoolName?: string;
  pending: PendingRequest[];
  nameByAccount: Map<string, string>;
  onRemindGuardians: () => void;
  remindBusy?: boolean;
};

function statusFor(r: PendingRequest) {
  if (r.status !== 'pending') return { label: r.status, tone: 'neutral' as const };
  const sub = Boolean(r.subject_approved);
  const gua = Boolean(r.guardian_approved);
  if (sub && gua) return { label: 'Both approved', tone: 'ok' as const };
  if (sub && !gua) return { label: 'Student approved, awaiting guardian', tone: 'amber' as const };
  return { label: 'Invite sent', tone: 'neutral' as const };
}

export function SchoolTripVerificationPanel({
  tripName,
  schoolName,
  pending,
  nameByAccount,
  onRemindGuardians,
  remindBusy,
}: Props) {
  const schoolPending = pending.filter((r) => r.status === 'pending');

  return (
    <Card className="border-violet-200 dark:border-violet-900 bg-gradient-to-br from-violet-50/80 to-background dark:from-violet-950/30" data-testid="school-trip-panel">
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-violet-600" />
          <CardTitle className="text-violet-950 dark:text-violet-100">School trip</CardTitle>
        </div>
        <CardDescription>
          {tripName}
          {schoolName ? ` · ${schoolName}` : ''}
        </CardDescription>
        <p className="text-xs text-violet-800/90 dark:text-violet-200/90 mt-1">
          Guardian verification expires in <strong>48 hours</strong> from request creation (K–12 verification policy).
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Participant verification</p>
        <ul className="space-y-2">
          {schoolPending.map((r) => {
            const st = statusFor(r);
            return (
              <li key={r.request_id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border bg-background/80 p-3">
                <div>
                  <p className="text-sm font-medium">{nameByAccount.get(r.subject_id) || 'Student'}</p>
                  <p className="text-xs text-muted-foreground">
                    Guardian:{' '}
                    {r.guardian_id ? nameByAccount.get(r.guardian_id) || 'Assigned' : <span className="italic">pending</span>}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">Expires {new Date(r.expires_at).toLocaleString()}</p>
                </div>
                <Badge
                  variant="secondary"
                  className={cn(
                    'w-fit',
                    st.tone === 'ok' && 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100',
                    st.tone === 'amber' && 'bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100',
                  )}
                >
                  {st.label}
                </Badge>
              </li>
            );
          })}
        </ul>
        {schoolPending.length === 0 ? <p className="text-sm text-muted-foreground">No pending school verifications.</p> : null}
        <Button type="button" variant="secondary" size="sm" disabled={remindBusy} onClick={onRemindGuardians}>
          {remindBusy ? 'Sending…' : 'Send reminder to pending guardians'}
        </Button>
      </CardContent>
    </Card>
  );
}
