'use client';

import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

export type CoverageRecParticipant = { account_id: string; display_name: string };

const DOMAIN_OPTIONS = ['medical', 'cancellation', 'delay', 'baggage', 'evacuation', 'adventure_sports'] as const;

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tripId: string;
  participants: CoverageRecParticipant[];
  /** Activities from itinerary (names only) for coverage hints */
  itineraryActivityNames: string[];
  onComplete?: () => void;
};

export function CoverageRecommendationSheet({
  open,
  onOpenChange,
  tripId,
  participants,
  itineraryActivityNames,
  onComplete,
}: Props) {
  const [step, setStep] = useState(1);
  const [policyLabel, setPolicyLabel] = useState('');
  const [domains, setDomains] = useState<string[]>(['medical', 'cancellation']);
  const [requirementLevel, setRequirementLevel] = useState<'suggestion' | 'required'>('suggestion');
  const [selectedRecipients, setSelectedRecipients] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const reset = useCallback(() => {
    setStep(1);
    setPolicyLabel('');
    setDomains(['medical', 'cancellation']);
    setRequirementLevel('suggestion');
    setSelectedRecipients({});
    setError('');
  }, []);

  const toggleRecipient = (id: string) => {
    setSelectedRecipients((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleDomain = (d: string) => {
    setDomains((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  const addOnNotes = useMemo(() => {
    const notes: Record<string, { summary: string }> = {};
    for (const p of participants) {
      const hits = itineraryActivityNames.filter((a) => a.length > 0);
      if (hits.length === 0) continue;
      notes[p.account_id] = {
        summary: `${p.display_name}: review add-ons for ${hits.slice(0, 3).join(', ')}${hits.length > 3 ? '…' : ''}`,
      };
    }
    return notes;
  }, [participants, itineraryActivityNames]);

  const recipientIds = useMemo(() => {
    const ids = participants.filter((p) => selectedRecipients[p.account_id]).map((p) => p.account_id);
    return Array.from(new Set(ids));
  }, [participants, selectedRecipients]);

  const send = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/group/recommend-coverage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          trip_id: tripId,
          recommended_policy_label: policyLabel.trim(),
          coverage_domains: domains,
          requirement_level: requirementLevel,
          recipient_account_ids: recipientIds,
          add_on_notes: addOnNotes,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof j.error === 'string' ? j.error : 'Send failed');
        return;
      }
      onComplete?.();
      onOpenChange(false);
      reset();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <SheetContent className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle>Recommend coverage</SheetTitle>
          <SheetDescription>
            Suggestions are advisory unless you mark coverage as required for trip readiness.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 flex-1 min-h-0 py-2">
          <div className="flex gap-2 text-xs text-muted-foreground">
            {[1, 2, 3, 4].map((s) => (
              <span
                key={s}
                className={cn(
                  'rounded-full px-2 py-0.5 border',
                  step === s ? 'border-primary text-primary' : 'border-border',
                )}
              >
                {s}
              </span>
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="policy-label">Policy label or free text</Label>
                <Input
                  id="policy-label"
                  value={policyLabel}
                  onChange={(e) => setPolicyLabel(e.target.value)}
                  placeholder="e.g. Premier Medical + Trip Protect"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Coverage domains</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {DOMAIN_OPTIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDomain(d)}
                      className={cn(
                        'text-xs px-2 py-1 rounded-md border',
                        domains.includes(d) ? 'bg-primary/10 border-primary' : 'border-border',
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="mb-1 block">Itinerary activities (context)</Label>
                <ScrollArea className="h-24 rounded-md border p-2 text-xs text-muted-foreground">
                  {itineraryActivityNames.length === 0 ? (
                    <span>No activities loaded for this trip.</span>
                  ) : (
                    <ul className="list-disc pl-4 space-y-1">
                      {itineraryActivityNames.slice(0, 20).map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  )}
                </ScrollArea>
              </div>
              <Button type="button" onClick={() => setStep(2)} disabled={!policyLabel.trim()}>
                Next: add-ons
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3 flex flex-col min-h-0">
              <p className="text-sm text-muted-foreground">
                Per-participant notes based on planned activities vs. recommended policy (heuristic).
              </p>
              <ScrollArea className="h-64 rounded-md border">
                <ul className="p-3 space-y-2 text-sm">
                  {participants.map((p) => (
                    <li key={p.account_id} className="rounded-md bg-muted/40 p-2">
                      <strong>{p.display_name}</strong>
                      <div className="text-xs text-muted-foreground mt-1">
                        {addOnNotes[p.account_id]?.summary ?? 'No itinerary activities detected — standard recommendation.'}
                      </div>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button type="button" onClick={() => setStep(3)}>
                  Next
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <RadioGroup value={requirementLevel} onValueChange={(v) => setRequirementLevel(v as 'suggestion' | 'required')}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="suggestion" id="sug" />
                  <Label htmlFor="sug">Suggestion — participants can ignore</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="required" id="req" />
                  <Label htmlFor="req">Required for this trip — must confirm coverage before trip-ready</Label>
                </div>
              </RadioGroup>
              <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-md p-2">
                Wayfarer does not sell insurance. Required means participants must upload proof of equivalent coverage; it does not
                purchase policies on their behalf.
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button type="button" onClick={() => setStep(4)}>
                  Next
                </Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3 flex flex-col min-h-0">
              <Label>Recipients</Label>
              <ScrollArea className="h-52 rounded-md border p-2">
                <div className="space-y-2">
                  {participants.map((p) => (
                    <label key={p.account_id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={Boolean(selectedRecipients[p.account_id])}
                        onCheckedChange={() => toggleRecipient(p.account_id)}
                      />
                      {p.display_name}
                    </label>
                  ))}
                </div>
              </ScrollArea>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setStep(3)}>
                  Back
                </Button>
                <Button type="button" disabled={busy || recipientIds.length === 0} onClick={() => void send()}>
                  {busy ? 'Sending…' : 'Send recommendation to group'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
