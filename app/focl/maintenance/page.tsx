'use client';

import { useCallback, useEffect, useState } from 'react';
import { Wrench, RefreshCw, CircleAlert as AlertCircle, CircleCheck as CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/auth/supabase-client';

interface MaintenanceWindow {
  window_id: string;
  class: 'A' | 'B' | 'C';
  region_id: string | null;
  opened_at: string;
  closed_at: string | null;
  reason_code: string;
}

const CLASS_LABEL: Record<string, string> = {
  A: 'Class A — global platform freeze',
  B: 'Class B — region-scoped pause',
  C: 'Class C — soft advisory',
};

export default function MaintenancePage() {
  const [rows, setRows] = useState<MaintenanceWindow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [cls, setCls] = useState<'A' | 'B' | 'C'>('C');
  const [region, setRegion] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const { data, error } = await supabase
      .from('maintenance_windows')
      .select('window_id,class,region_id,opened_at,closed_at,reason_code')
      .order('opened_at', { ascending: false })
      .limit(50);
    if (error) setErr(error.message);
    else setRows((data ?? []) as MaintenanceWindow[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openWindow = async () => {
    setSubmitting(true);
    setErr(null);
    setInfo(null);
    const { error } = await supabase.rpc('open_maintenance_window', {
      p_class: cls,
      p_region_id: region.trim() || null,
      p_reason_code: 'founder_opened',
      p_metadata: {},
    });
    setSubmitting(false);
    if (error) setErr(error.message);
    else {
      setInfo(`Opened Class ${cls} window.`);
      setRegion('');
      await load();
    }
  };

  const closeWindow = async (windowId: string) => {
    setErr(null);
    setInfo(null);
    const { error } = await supabase.rpc('close_maintenance_window', {
      p_window_id: windowId,
      p_reason_code: 'founder_closed',
    });
    if (error) setErr(error.message);
    else {
      setInfo('Window closed.');
      await load();
    }
  };

  const openWindows = rows.filter((r) => r.closed_at === null);
  const closedWindows = rows.filter((r) => r.closed_at !== null).slice(0, 20);

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-widest text-neutral-400">FOCL &middot; §12.10 v2</p>
            <h1 className="text-2xl font-semibold text-neutral-900 flex items-center gap-3">
              <Wrench className="w-5 h-5 text-neutral-700" /> Maintenance Windows
            </h1>
            <p className="text-sm text-neutral-500 mt-1">Open or close Class A/B/C maintenance windows. Every action is recorded to the ledger.</p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </header>

        {err && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-5 py-4 text-sm text-red-700 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>{err}</div>
          </div>
        )}
        {info && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-5 py-4 text-sm text-emerald-800 flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>{info}</div>
          </div>
        )}

        <section className="bg-white border border-neutral-200 rounded-lg p-6 space-y-4">
          <h2 className="text-sm font-semibold text-neutral-900">Open a new window</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div>
              <Label className="text-xs mb-1.5 block">Class</Label>
              <Select value={cls} onValueChange={(v) => setCls(v as 'A' | 'B' | 'C')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">{CLASS_LABEL.A}</SelectItem>
                  <SelectItem value="B">{CLASS_LABEL.B}</SelectItem>
                  <SelectItem value="C">{CLASS_LABEL.C}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">Region (optional)</Label>
              <Input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="eg. us-east, eu" />
            </div>
            <Button onClick={openWindow} disabled={submitting} className="w-full sm:w-auto">
              {submitting ? 'Opening…' : 'Open window'}
            </Button>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-neutral-900">Open windows</h2>
          {loading && <Skeleton className="h-20 w-full rounded-lg" />}
          {!loading && openWindows.length === 0 && (
            <div className="bg-white border border-neutral-200 rounded-lg py-10 text-center text-sm text-neutral-500">
              No open maintenance windows.
            </div>
          )}
          {!loading && openWindows.map((w) => (
            <WindowRow key={w.window_id} w={w} onClose={closeWindow} />
          ))}
        </section>

        {closedWindows.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-neutral-900">Recent closed</h2>
            {closedWindows.map((w) => <WindowRow key={w.window_id} w={w} onClose={closeWindow} />)}
          </section>
        )}
      </div>
    </div>
  );
}

function WindowRow({ w, onClose }: { w: MaintenanceWindow; onClose: (id: string) => void }) {
  const isOpen = w.closed_at === null;
  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-4 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        <span className={`text-[10px] font-semibold px-2 py-1 rounded border ${
          w.class === 'A' ? 'bg-red-50 text-red-700 border-red-200' :
          w.class === 'B' ? 'bg-amber-50 text-amber-700 border-amber-200' :
          'bg-blue-50 text-blue-700 border-blue-200'
        }`}>CLASS {w.class}</span>
        <div>
          <div className="text-sm text-neutral-900">{w.region_id ?? 'global'}</div>
          <div className="text-xs text-neutral-500">
            {new Date(w.opened_at).toLocaleString()}
            {w.closed_at && ` → ${new Date(w.closed_at).toLocaleString()}`}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-neutral-400 font-mono">{w.reason_code}</span>
        {isOpen && (
          <Button variant="outline" size="sm" onClick={() => onClose(w.window_id)}>Close</Button>
        )}
      </div>
    </div>
  );
}
