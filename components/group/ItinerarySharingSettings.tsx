'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { SupabaseClient } from '@supabase/supabase-js';

type ShareMode = 'all' | 'selected' | 'none';

type ActivityRow = { candidate_id: string; activity_name: string | null };

type Props = {
  tripId: string;
  supabase: SupabaseClient;
  initial?: { share_mode: ShareMode; shared_item_ids: string[] };
};

export function ItinerarySharingSettings({ tripId, supabase, initial }: Props) {
  const [mode, setMode] = useState<ShareMode>(initial?.share_mode ?? 'all');
  const [items, setItems] = useState<ActivityRow[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>(
    () => Object.fromEntries((initial?.shared_item_ids ?? []).map((id) => [id, true])) ?? {},
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from('activity_candidates')
        .select('candidate_id, activity_name')
        .eq('trip_id', tripId)
        .order('sort_order', { ascending: true });
      setItems((data || []) as ActivityRow[]);
    })();
  }, [tripId, supabase]);

  const toggleItem = (id: string) => setSelected((s) => ({ ...s, [id]: !s[id] }));

  const save = async () => {
    setBusy(true);
    setMsg('');
    try {
      const sharedIds = mode === 'selected' ? Object.entries(selected).filter(([, v]) => v).map(([k]) => k) : [];
      const res = await fetch('/api/group/sharing-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          trip_id: tripId,
          share_mode: mode,
          shared_item_ids: sharedIds,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof j.error === 'string' ? j.error : 'Save failed');
      setMsg('Sharing preferences saved.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Itinerary sharing</CardTitle>
        <CardDescription>Control what other group members can see from your plans.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <RadioGroup value={mode} onValueChange={(v) => setMode(v as ShareMode)}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="all" id="share-all" />
            <Label htmlFor="share-all">Share all itinerary items with group</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="selected" id="share-sel" />
            <Label htmlFor="share-sel">Share selected items only</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="none" id="share-no" />
            <Label htmlFor="share-no">Don&apos;t share my itinerary (dates + trip name only)</Label>
          </div>
        </RadioGroup>

        {mode === 'selected' ? (
          <ScrollArea className="h-40 rounded-md border">
            <ul className="p-2 space-y-2">
              {items.map((it) => (
                <li key={it.candidate_id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">{it.activity_name || 'Activity'}</span>
                  <Switch checked={Boolean(selected[it.candidate_id])} onCheckedChange={() => toggleItem(it.candidate_id)} />
                </li>
              ))}
            </ul>
          </ScrollArea>
        ) : null}

        <Button type="button" size="sm" disabled={busy} onClick={() => void save()}>
          {busy ? 'Saving…' : 'Save sharing preferences'}
        </Button>
        {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
      </CardContent>
    </Card>
  );
}
