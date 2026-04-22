'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Inbox, RefreshCw, CircleAlert as AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/auth/supabase-client';

interface InboxItem {
  item_id: string;
  feature_id: string | null;
  item_type: string;
  status: string;
  priority: string | null;
  title: string;
  body: string | null;
  reason_code: string | null;
  next_step_hint: string | null;
  created_at: string;
}

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, normal: 2, low: 3 };

export default function DecisionQueuePage() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const { data, error } = await supabase
      .from('action_inbox_items')
      .select('item_id,feature_id,item_type,status,priority,title,body,reason_code,next_step_hint,created_at')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) setErr(error.message);
    else setItems((data ?? []) as InboxItem[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority ?? 'normal'] ?? 2;
      const pb = PRIORITY_ORDER[b.priority ?? 'normal'] ?? 2;
      if (pa !== pb) return pa - pb;
      return b.created_at.localeCompare(a.created_at);
    });
  }, [items]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-widest text-neutral-400">FOCL &middot; F-6.5.16.b</p>
            <h1 className="text-2xl font-semibold text-neutral-900 flex items-center gap-3">
              <Inbox className="w-5 h-5 text-neutral-700" /> Decision Queue
            </h1>
            <p className="text-sm text-neutral-500 mt-1">Open action inbox items. Sorted by priority, then recency.</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing || loading} className="gap-2">
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </header>

        {err && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-5 py-4 text-sm text-red-700 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>{err}</div>
          </div>
        )}

        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
          </div>
        )}

        {!loading && !err && sorted.length === 0 && (
          <div className="bg-white border border-neutral-200 rounded-lg py-16 text-center">
            <Inbox className="w-8 h-8 text-neutral-300 mx-auto mb-3" />
            <p className="text-sm text-neutral-500">Decision queue is clear.</p>
          </div>
        )}

        {!loading && sorted.length > 0 && (
          <div className="space-y-3">
            {sorted.map((item) => <InboxRow key={item.item_id} item={item} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function InboxRow({ item }: { item: InboxItem }) {
  const priority = item.priority ?? 'normal';
  const priorityColor =
    priority === 'critical' ? 'bg-red-50 text-red-700 border-red-200' :
    priority === 'high'     ? 'bg-amber-50 text-amber-700 border-amber-200' :
    priority === 'low'      ? 'bg-neutral-50 text-neutral-500 border-neutral-200' :
                              'bg-blue-50 text-blue-700 border-blue-200';
  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-5 hover:border-neutral-300 transition">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className={`text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded border ${priorityColor}`}>{priority}</span>
            {item.feature_id && (
              <span className="text-[10px] text-neutral-500 font-mono px-2 py-0.5 rounded bg-neutral-100 border border-neutral-200">{item.feature_id}</span>
            )}
            <span className="text-[10px] text-neutral-400 uppercase tracking-wide">{item.item_type}</span>
          </div>
          <h3 className="text-sm font-semibold text-neutral-900 truncate">{item.title}</h3>
          {item.body && <p className="text-sm text-neutral-600 mt-1 line-clamp-2">{item.body}</p>}
          {item.next_step_hint && (
            <p className="text-xs text-neutral-500 mt-2"><span className="font-medium">Next:</span> {item.next_step_hint}</p>
          )}
        </div>
        <div className="text-[11px] text-neutral-400 whitespace-nowrap">
          {new Date(item.created_at).toLocaleString()}
        </div>
      </div>
    </div>
  );
}
