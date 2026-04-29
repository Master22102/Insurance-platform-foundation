'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/auth/supabase-client';
import { useAuth } from '@/lib/auth/auth-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import AppPageRoot from '@/components/layout/AppPageRoot';

type InviteRow = {
  request_id: string;
  requester_id: string;
  subject_id: string;
  guardian_id: string | null;
  trip_id: string;
  trip_type: string;
  status: string;
  expires_at: string;
  requires_dual_approval: boolean;
  subject_approved: boolean;
  guardian_approved: boolean;
  trips:
    | { trip_id: string; trip_name: string | null; destination_summary: string | null }
    | Array<{ trip_id: string; trip_name: string | null; destination_summary: string | null }>
    | null;
};

export default function GuardianInvitesInboxPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('relationship_verification_requests')
      .select(
        `
        request_id,
        requester_id,
        subject_id,
        guardian_id,
        trip_id,
        trip_type,
        status,
        expires_at,
        requires_dual_approval,
        subject_approved,
        guardian_approved,
        trips ( trip_id, trip_name, destination_summary )
      `,
      )
      .eq('guardian_id', user.id)
      .order('expires_at', { ascending: true });
    if (error) {
      setMessage(error.message);
    } else {
      setRows((data || []) as InviteRow[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const resolve = async (requestId: string, decision: 'approve' | 'deny') => {
    setBusyId(requestId);
    setMessage('');
    const { data, error } = await supabase.rpc('resolve_relationship_verification_request', {
      p_request_id: requestId,
      p_decision: decision,
    });
    setBusyId(null);
    if (error || !data?.success) {
      setMessage(error?.message || data?.error || 'Could not update approval.');
      return;
    }
    setMessage(`Updated: ${String(data.status)}.`);
    await load();
  };

  const pending = rows.filter((r) => r.status === 'pending');
  const done = rows.filter((r) => r.status !== 'pending');

  const tripLabel = useCallback((r: InviteRow) => {
    const t = Array.isArray(r.trips) ? r.trips[0] : r.trips;
    const name = t?.trip_name?.trim();
    const dest = t?.destination_summary?.trim();
    if (name && dest) return `${name} · ${dest}`;
    return name || dest || 'Group trip';
  }, []);

  return (
    <AppPageRoot style={{ maxWidth: '32rem', margin: '0 auto' }}>
    <div className="px-4 py-10 space-y-6">
      <Link href="/account" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to account
      </Link>

      <div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-violet-600" />
          <h1 className="text-2xl font-semibold tracking-tight">Guardian approvals</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          When organizers add a student to a school or supervised trip, your approval may be required alongside the
          student&apos;s confirmation (dual consent).
        </p>
      </div>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pending your approval</p>
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing pending.</p>
            ) : (
              <ul className="flex flex-col gap-4 list-none p-0 m-0">
                {pending.map((r) => {
                  const student = `Student (${r.subject_id.slice(0, 8)}…)`;
                  const organizer = `Organizer (${r.requester_id.slice(0, 8)}…)`;
                  const schoolStyle = r.trip_type === 'school';
                  return (
                    <li key={r.request_id}>
                      <Card
                        className={cn(
                          'overflow-hidden border-violet-200 dark:border-violet-900',
                          schoolStyle && 'bg-gradient-to-br from-violet-50/90 to-background dark:from-violet-950/25',
                        )}
                      >
                        <CardHeader className="pb-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <CardTitle className="text-base">{tripLabel(r)}</CardTitle>
                            <Badge variant="secondary" className="text-[10px] capitalize">
                              {r.trip_type}
                            </Badge>
                          </div>
                          <CardDescription>
                            Expires {new Date(r.expires_at).toLocaleString()}
                            {r.trip_type === 'school' ? ' · School trips use a 48-hour verification window.' : null}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          <p>
                            <span className="text-muted-foreground">Organizer:</span> {organizer}
                          </p>
                          <p>
                            <span className="text-muted-foreground">Student:</span> {student}
                          </p>
                          <Separator />
                          <p className="text-muted-foreground leading-snug">
                            This will allow <strong className="text-foreground">{student}</strong> to join{' '}
                            <strong className="text-foreground">{tripLabel(r)}</strong> as a participant.
                          </p>
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span>Student approved: {r.subject_approved ? 'yes' : 'no'}</span>
                            <span>·</span>
                            <span>Guardian approved: {r.guardian_approved ? 'yes' : 'no'}</span>
                          </div>
                        </CardContent>
                        <CardFooter className="flex flex-wrap gap-2 border-t bg-muted/20">
                          <Button
                            type="button"
                            size="sm"
                            disabled={busyId === r.request_id}
                            onClick={() => void resolve(r.request_id, 'approve')}
                          >
                            Approve
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busyId === r.request_id}
                            onClick={() => void resolve(r.request_id, 'deny')}
                          >
                            Deny
                          </Button>
                          <Button type="button" size="sm" variant="secondary" asChild>
                            <Link href={`/trips/${r.trip_id}`}>View trip</Link>
                          </Button>
                        </CardFooter>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent history</p>
            {done.length === 0 ? (
              <p className="text-sm text-muted-foreground">No completed items yet.</p>
            ) : (
              <ul className="list-none p-0 m-0 space-y-2">
                {done.slice(0, 15).map((r) => (
                  <li key={r.request_id} className="text-sm text-muted-foreground border rounded-md px-3 py-2">
                    <strong className="text-foreground">{r.status.toUpperCase()}</strong> · {tripLabel(r)} · student{' '}
                    <code className="text-xs">{r.subject_id.slice(0, 8)}…</code>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
    </AppPageRoot>
  );
}
