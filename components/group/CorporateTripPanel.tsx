'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

type Props = {
  tripId: string;
  initialPolicyUrl?: string | null;
};

export function CorporateTripPanel({ tripId, initialPolicyUrl }: Props) {
  const [url, setUrl] = useState(initialPolicyUrl || '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const save = async () => {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/group/corporate-trip-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ trip_id: tripId, corporate_travel_policy_url: url.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof j.error === 'string' ? j.error : 'Save failed');
      setMsg('Saved.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-slate-300 dark:border-slate-700 shadow-sm" data-testid="corporate-trip-panel">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-slate-900 dark:text-slate-100">Corporate trip</CardTitle>
          <Badge variant="outline" className="font-normal">
            Verification window: 168 hours (7 days)
          </Badge>
          <Badge variant="secondary" className="font-normal">
            No guardian consent (adults)
          </Badge>
        </div>
        <CardDescription>
          Professional group coordination — export authorizations may be required for compliance workflows.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="corp-url">Corporate travel policy document (URL)</Label>
          <div className="flex gap-2 mt-1">
            <Input
              id="corp-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
            />
            <Button type="button" onClick={() => void save()} disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
          </div>
          {msg ? <p className="text-xs text-muted-foreground mt-1">{msg}</p> : null}
        </div>
        <p className="text-xs text-muted-foreground">
          Organizers may mark coverage as <strong>required</strong> for corporate policy compliance. Required coverage still means
          participants must provide proof — Wayfarer does not purchase insurance on their behalf.
        </p>
      </CardContent>
    </Card>
  );
}
