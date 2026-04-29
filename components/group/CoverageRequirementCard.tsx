'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type RecommendationRow = {
  recommendation_id: string;
  recommended_policy_label: string;
  coverage_domains: string[];
  requirement_level: 'suggestion' | 'required';
  created_at: string;
};

type ResponseRow = {
  response_type: string;
  policy_id: string | null;
  organizer_reviewed: boolean;
  organizer_approved: boolean | null;
};

type Props = {
  recommendation: RecommendationRow;
  response: ResponseRow | null;
  addOnSummary?: string;
  onUpdated?: () => void;
};

export function CoverageRequirementCard({ recommendation, response, addOnSummary, onUpdated }: Props) {
  const [policyId, setPolicyId] = useState('');
  const [busy, setBusy] = useState('');
  const required = recommendation.requirement_level === 'required';

  const post = async (payload: Record<string, unknown>) => {
    setBusy('…');
    try {
      const res = await fetch('/api/group/coverage-requirement-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ recommendation_id: recommendation.recommendation_id, ...payload }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof j.error === 'string' ? j.error : 'Request failed');
      onUpdated?.();
    } catch (e) {
      setBusy(e instanceof Error ? e.message : 'Error');
    } finally {
      setTimeout(() => setBusy(''), 1500);
    }
  };

  const readinessItems = required ? 3 : 2;
  const done =
    (response?.response_type === 'uploaded' ? 1 : 0) +
    (response && response.response_type !== 'will_look' ? 1 : 0) +
    (response?.organizer_reviewed && response?.organizer_approved ? 1 : 0);
  const progressPct = Math.min(100, Math.round((done / readinessItems) * 100));

  return (
    <Card className={cn(required && 'border-amber-400/80 shadow-amber-100/20')}>
      <CardHeader>
        <CardTitle className={cn('text-lg', required && 'text-amber-900 dark:text-amber-100')}>
          {required ? 'Coverage Required' : 'Coverage recommendation'}
        </CardTitle>
        <CardDescription>
          {required
            ? 'Trip organizer requires this coverage for all participants on this recommendation.'
            : 'Trip organizer suggests this coverage.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
          <p className="font-medium">{recommendation.recommended_policy_label}</p>
          <div className="flex flex-wrap gap-1">
            {recommendation.coverage_domains?.map((d) => (
              <Badge key={d} variant="secondary" className="text-[10px]">
                {d}
              </Badge>
            ))}
          </div>
        </div>

        {addOnSummary ? (
          <p className="text-sm text-muted-foreground border-l-2 border-amber-500 pl-2">{addOnSummary}</p>
        ) : null}

        {required ? (
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-1 text-sm text-primary">
              <ChevronDown className="h-4 w-4" />
              Why is this required?
            </CollapsibleTrigger>
            <CollapsibleContent className="text-xs text-muted-foreground mt-2">
              The organizer marked this coverage as required for trip coordination. You will not be marked trip-ready until coverage
              is confirmed. Wayfarer does not sell insurance — purchase directly from a licensed provider.
            </CollapsibleContent>
          </Collapsible>
        ) : null}

        {!response || response.response_type === 'will_look' ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button type="button" variant="secondary" size="sm" disabled={!!busy} onClick={() => void post({ response: 'will_look' })}>
              I&apos;ll look into this
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={!!busy} onClick={() => void post({ response: 'have_equivalent' })}>
              I have equivalent coverage
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={!!busy} onClick={() => void post({ response: 'need_purchase' })}>
              I need to purchase this first
            </Button>
          </div>
        ) : response.response_type === 'have_equivalent' ? (
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Pending organizer review — you indicated equivalent coverage.
          </p>
        ) : null}

        {required && response?.response_type === 'need_purchase' ? (
          <p className="text-xs text-amber-800 dark:text-amber-200">
            You won&apos;t be marked as trip-ready until your coverage is confirmed.
          </p>
        ) : null}

        <div className="space-y-2 border rounded-md p-3">
          <p className="text-sm font-semibold tracking-wide">Upload proof (optional)</p>
          <Label htmlFor="pol-id">Policy ID (UUID) if you uploaded a policy to this trip</Label>
          <div className="flex gap-2 mt-1">
            <Input
              id="pol-id"
              value={policyId}
              onChange={(e) => setPolicyId(e.target.value)}
              placeholder="policy_id from your documents"
            />
            <Button
              type="button"
              size="sm"
              disabled={!!busy || !policyId.trim()}
              onClick={() => void post({ response: 'have_equivalent', policy_id: policyId.trim() })}
            >
              {required ? 'I have this coverage — upload proof' : 'Attach policy'}
            </Button>
          </div>
        </div>

        {response ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold tracking-wide">Coverage Status</p>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant={response.response_type === 'uploaded' ? 'default' : 'secondary'}>
                Primary: {response.response_type === 'uploaded' ? 'Uploaded' : response.organizer_reviewed ? 'Reviewed' : 'Pending review'}
              </Badge>
              <Badge variant="outline">Add-on: Not yet uploaded</Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Readiness items</p>
              <Progress value={progressPct} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">{done} of {readinessItems} readiness signals recorded</p>
            </div>
          </div>
        ) : null}

        <p className="text-[11px] text-muted-foreground">
          Wayfarer doesn&apos;t sell insurance. You purchase directly from the provider.
        </p>
        {busy ? <p className="text-xs text-muted-foreground">{busy}</p> : null}
      </CardContent>
    </Card>
  );
}
