'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export type SharedActivity = {
  candidate_id: string;
  activity_name: string | null;
  date_hint?: string | null;
  city?: string | null;
  creator_attribution?: string | null;
  creator_url?: string | null;
};

type Props = {
  tripId: string;
  sharerName: string;
  dayLabel: string;
  activities: SharedActivity[];
};

export function SharedItineraryView({ tripId, sharerName, dayLabel, activities }: Props) {
  const [busy, setBusy] = useState<string | null>(null);

  const add = async (candidateId: string, name: string) => {
    setBusy(candidateId);
    try {
      const res = await fetch('/api/group/add-shared-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ trip_id: tripId, source_candidate_id: candidateId }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof j.error === 'string' ? j.error : 'Could not add');
      toast.success(`Added ${name} to your itinerary`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{sharerName}&apos;s plans for {dayLabel}</CardTitle>
        <CardDescription>Items they chose to share with the group.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing shared for this view.</p>
        ) : (
          <ul className="space-y-3">
            {activities.map((a) => (
              <li key={a.candidate_id} className="rounded-lg border p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{a.activity_name || 'Activity'}</p>
                  <p className="text-xs text-muted-foreground">
                    {[a.date_hint, a.city].filter(Boolean).join(' · ') || 'Time / location TBD'}
                  </p>
                  {a.creator_attribution ? (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      From {a.creator_attribution}
                      {a.creator_url ? (
                        <>
                          {' '}
                          ·{' '}
                          <a href={a.creator_url} className="underline text-primary" target="_blank" rel="noreferrer">
                            View
                          </a>
                        </>
                      ) : null}
                    </p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={busy === a.candidate_id}
                  onClick={() => void add(a.candidate_id, a.activity_name || 'Activity')}
                >
                  {busy === a.candidate_id ? 'Adding…' : 'Add to my itinerary'}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
