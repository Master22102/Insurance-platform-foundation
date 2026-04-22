'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, Inbox, Wrench, LayoutGrid, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/auth/supabase-client';

interface DashboardCounts {
  openInbox: number;
  openMaintenance: number;
  liveFeatures: number;
  totalFeatures: number;
  degradedFeatures: number;
}

export default function FounderDashboardPage() {
  const [counts, setCounts] = useState<DashboardCounts | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [inbox, maint, reg, health] = await Promise.all([
          supabase.from('action_inbox_items').select('item_id', { count: 'exact', head: true }).eq('status', 'open'),
          supabase.from('maintenance_windows').select('window_id', { count: 'exact', head: true }).is('closed_at', null),
          supabase.from('feature_registry').select('feature_id', { count: 'exact', head: true }),
          supabase.from('feature_rollout_health_state').select('feature_id,health_status'),
        ]);

        const live = (health.data ?? []).filter((r: { health_status: string }) => r.health_status === 'HEALTHY').length;
        const degraded = (health.data ?? []).filter((r: { health_status: string }) => r.health_status !== 'HEALTHY').length;

        if (!mounted) return;
        setCounts({
          openInbox: inbox.count ?? 0,
          openMaintenance: maint.count ?? 0,
          liveFeatures: live,
          totalFeatures: reg.count ?? 0,
          degradedFeatures: degraded,
        });
      } catch (e) {
        if (mounted) setErr((e as Error).message);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <header className="space-y-1">
          <p className="text-xs uppercase tracking-widest text-neutral-400">FOCL &middot; F-6.5.16.a</p>
          <h1 className="text-2xl font-semibold text-neutral-900">Founder Dashboard</h1>
          <p className="text-sm text-neutral-500">Operational state at a glance. All writes recorded to the Founder Action Ledger.</p>
        </header>

        {err && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-5 py-4 text-sm text-red-700">{err}</div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Decision queue" value={counts?.openInbox ?? '—'} sub="open items" icon={Inbox} href="/focl/decision-queue" />
          <StatCard label="Maintenance" value={counts?.openMaintenance ?? '—'} sub="open windows" icon={Wrench} href="/focl/maintenance" />
          <StatCard label="Live features" value={counts ? `${counts.liveFeatures}/${counts.totalFeatures}` : '—'} sub="healthy" icon={Activity} href="/focl/features/intelligence" />
          <StatCard label="Degraded" value={counts?.degradedFeatures ?? '—'} sub="needs review" icon={LayoutGrid} href="/focl/features/intelligence" />
        </div>

        <nav className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SurfaceLink href="/focl/features/intelligence" title="Feature Intelligence" hint="F-6.5.16.j &middot; registry, activation, rollout" />
          <SurfaceLink href="/focl/decision-queue" title="Decision Queue" hint="F-6.5.16.b &middot; action inbox" />
          <SurfaceLink href="/focl/maintenance" title="Maintenance Windows" hint="§12.10 v2 &middot; Class A/B/C" />
          <SurfaceLink href="/focl/features/intelligence" title="Rollout & Health" hint="F-6.5.16.j &middot; percentage, scope" />
        </nav>
      </div>
    </div>
  );
}

function StatCard({
  label, value, sub, icon: Icon, href,
}: { label: string; value: number | string; sub: string; icon: React.ComponentType<{ className?: string }>; href: string }) {
  return (
    <Link
      href={href}
      className="bg-white border border-neutral-200 rounded-lg px-5 py-4 hover:border-neutral-300 hover:shadow-sm transition"
    >
      <div className="flex items-center justify-between">
        <div className="text-xs text-neutral-400 uppercase tracking-wide">{label}</div>
        <Icon className="w-4 h-4 text-neutral-400" />
      </div>
      <div className="text-2xl font-semibold text-neutral-900 leading-none mt-2">{value}</div>
      <div className="text-xs text-neutral-400 mt-1">{sub}</div>
    </Link>
  );
}

function SurfaceLink({ href, title, hint }: { href: string; title: string; hint: string }) {
  return (
    <Link
      href={href}
      className="group bg-white border border-neutral-200 rounded-lg p-5 hover:border-neutral-800 transition flex items-center justify-between"
    >
      <div>
        <div className="text-sm font-semibold text-neutral-900">{title}</div>
        <div className="text-xs text-neutral-500 mt-1">{hint}</div>
      </div>
      <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-neutral-800 transition" />
    </Link>
  );
}
