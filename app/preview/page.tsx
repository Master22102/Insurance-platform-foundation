'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Activity, Inbox, Wrench, LayoutGrid, ArrowRight, RefreshCw,
  CircleAlert as AlertCircle, CircleCheck as CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SplashScreen from '@/components/SplashScreen';

type Surface = 'gallery' | 'dashboard' | 'maintenance' | 'splash';

export default function PreviewPage() {
  const [surface, setSurface] = useState<Surface>('gallery');
  const [splashPlaying, setSplashPlaying] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-neutral-400">Design preview</div>
            <div className="text-sm font-semibold text-neutral-900">FOCL surfaces — visual walkthrough</div>
          </div>
          <div className="flex items-center gap-1 bg-neutral-100 rounded-md p-1">
            {(['gallery', 'dashboard', 'maintenance', 'splash'] as Surface[]).map((s) => (
              <button
                key={s}
                onClick={() => s === 'splash' ? setSplashPlaying(true) : setSurface(s)}
                className={`text-xs px-3 py-1.5 rounded capitalize transition ${
                  surface === s && s !== 'splash'
                    ? 'bg-white text-neutral-900 shadow-sm'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                {s === 'splash' ? 'Play splash' : s}
              </button>
            ))}
          </div>
        </div>
      </header>

      {splashPlaying && <SplashScreen onComplete={() => setSplashPlaying(false)} />}

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-16">
        {surface === 'gallery' && (
          <Gallery onJump={setSurface} onPlaySplash={() => setSplashPlaying(true)} />
        )}
        {surface === 'dashboard' && <DashboardPreview />}
        {surface === 'maintenance' && <MaintenancePreview />}
      </main>
    </div>
  );
}

function Gallery({ onJump, onPlaySplash }: { onJump: (s: Surface) => void; onPlaySplash: () => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <GalleryCard
        title="Founder Dashboard"
        hint="/focl — F-6.5.16.a"
        onClick={() => onJump('dashboard')}
        accent="from-slate-800 to-slate-950"
      />
      <GalleryCard
        title="Maintenance Windows"
        hint="/focl/maintenance — §12.10 v2"
        onClick={() => onJump('maintenance')}
        accent="from-amber-700 to-amber-900"
      />
      <GalleryCard
        title="Splash Screen"
        hint="components/SplashScreen — 2.2s"
        onClick={onPlaySplash}
        accent="from-blue-800 to-blue-950"
      />
    </div>
  );
}

function GalleryCard({ title, hint, onClick, accent }: { title: string; hint: string; onClick: () => void; accent: string }) {
  return (
    <button
      onClick={onClick}
      className="group text-left bg-white border border-neutral-200 rounded-xl overflow-hidden hover:border-neutral-800 hover:shadow-lg transition"
    >
      <div className={`h-40 bg-gradient-to-br ${accent} flex items-center justify-center`}>
        <div className="text-white/90 text-xs uppercase tracking-widest">Preview</div>
      </div>
      <div className="p-5">
        <div className="text-sm font-semibold text-neutral-900">{title}</div>
        <div className="text-xs text-neutral-500 mt-1 font-mono">{hint}</div>
        <div className="flex items-center gap-1 text-xs text-neutral-800 mt-4 group-hover:translate-x-0.5 transition">
          Open preview <ArrowRight className="w-3.5 h-3.5" />
        </div>
      </div>
    </button>
  );
}

/* ---------- Dashboard preview ---------- */

function DashboardPreview() {
  return (
    <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-8">
      <PreviewLabel>what founders see at /focl</PreviewLabel>
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="space-y-1">
          <p className="text-xs uppercase tracking-widest text-neutral-400">FOCL &middot; F-6.5.16.a</p>
          <h1 className="text-2xl font-semibold text-neutral-900">Founder Dashboard</h1>
          <p className="text-sm text-neutral-500">Operational state at a glance. All writes recorded to the Founder Action Ledger.</p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Decision queue" value={7} sub="open items" Icon={Inbox} />
          <StatCard label="Maintenance" value={1} sub="open windows" Icon={Wrench} />
          <StatCard label="Live features" value="42/58" sub="healthy" Icon={Activity} />
          <StatCard label="Degraded" value={3} sub="needs review" Icon={LayoutGrid} />
        </div>

        <nav className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SurfaceLink title="Feature Intelligence" hint="F-6.5.16.j · registry, activation, rollout" />
          <SurfaceLink title="Decision Queue" hint="F-6.5.16.b · action inbox" />
          <SurfaceLink title="Maintenance Windows" hint="§12.10 v2 · Class A/B/C" />
          <SurfaceLink title="Rollout & Health" hint="F-6.5.16.j · percentage, scope" />
        </nav>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, Icon }: { label: string; value: number | string; sub: string; Icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-lg px-5 py-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-neutral-400 uppercase tracking-wide">{label}</div>
        <Icon className="w-4 h-4 text-neutral-400" />
      </div>
      <div className="text-2xl font-semibold text-neutral-900 leading-none mt-2">{value}</div>
      <div className="text-xs text-neutral-400 mt-1">{sub}</div>
    </div>
  );
}

function SurfaceLink({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="group bg-white border border-neutral-200 rounded-lg p-5 hover:border-neutral-800 transition flex items-center justify-between">
      <div>
        <div className="text-sm font-semibold text-neutral-900">{title}</div>
        <div className="text-xs text-neutral-500 mt-1">{hint}</div>
      </div>
      <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-neutral-800 transition" />
    </div>
  );
}

/* ---------- Maintenance preview ---------- */

const SAMPLE_OPEN = [
  { window_id: 'w1', class: 'C' as const, region_id: 'eu-west', opened_at: new Date(Date.now() - 1000 * 60 * 42).toISOString(), closed_at: null, reason_code: 'founder_opened' },
];
const SAMPLE_CLOSED = [
  { window_id: 'w2', class: 'A' as const, region_id: null, opened_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), closed_at: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(), reason_code: 'founder_closed' },
  { window_id: 'w3', class: 'B' as const, region_id: 'us-east', opened_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), closed_at: new Date(Date.now() - 1000 * 60 * 60 * 47).toISOString(), reason_code: 'system_closed' },
];

function MaintenancePreview() {
  const [cls, setCls] = useState<'A' | 'B' | 'C'>('C');
  const [region, setRegion] = useState('');
  const [info] = useState<string | null>(null);

  return (
    <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-8">
      <PreviewLabel>what founders see at /focl/maintenance</PreviewLabel>
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-widest text-neutral-400">FOCL &middot; §12.10 v2</p>
            <h1 className="text-2xl font-semibold text-neutral-900 flex items-center gap-3">
              <Wrench className="w-5 h-5 text-neutral-700" /> Maintenance Windows
            </h1>
            <p className="text-sm text-neutral-500 mt-1">Open or close Class A/B/C maintenance windows. Every action is recorded to the ledger.</p>
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
        </header>

        {info && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-5 py-4 text-sm text-emerald-800 flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" /> <div>{info}</div>
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
                  <SelectItem value="A">Class A — global platform freeze</SelectItem>
                  <SelectItem value="B">Class B — region-scoped pause</SelectItem>
                  <SelectItem value="C">Class C — soft advisory</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">Region (optional)</Label>
              <Input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="eg. us-east, eu" />
            </div>
            <Button className="w-full sm:w-auto">Open window</Button>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-neutral-900">Open windows</h2>
          {SAMPLE_OPEN.map((w) => <WindowRow key={w.window_id} w={w} />)}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-neutral-900">Recent closed</h2>
          {SAMPLE_CLOSED.map((w) => <WindowRow key={w.window_id} w={w} />)}
        </section>
      </div>
    </div>
  );
}

function WindowRow({ w }: { w: { window_id: string; class: 'A'|'B'|'C'; region_id: string | null; opened_at: string; closed_at: string | null; reason_code: string } }) {
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
        {isOpen && <Button variant="outline" size="sm">Close</Button>}
      </div>
    </div>
  );
}

function PreviewLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-center gap-2">
      <div className="h-px bg-neutral-300 flex-1" />
      <span className="text-[10px] uppercase tracking-widest text-neutral-400">{children}</span>
      <div className="h-px bg-neutral-300 flex-1" />
    </div>
  );
}
