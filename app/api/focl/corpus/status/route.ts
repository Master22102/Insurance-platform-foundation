import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function mustEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) return null;
  return { url, anon, service };
}

function relTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const diff = Date.now() - t;
  const days = Math.floor(diff / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 14) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 8) return `${weeks} wk ago`;
  return `${Math.floor(days / 30)} mo ago`;
}

export async function GET(request: NextRequest) {
  const env = mustEnv();
  if (!env) return NextResponse.json({ ok: false, error: 'Server configuration missing' }, { status: 500 });

  const authClient = createServerClient(env.url, env.anon, {
    cookies: {
      get: (name) => request.cookies.get(name)?.value,
      set: () => {},
      remove: () => {},
    },
  });
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await authClient
    .from('user_profiles')
    .select('membership_tier')
    .eq('user_id', user.id)
    .maybeSingle();
  if ((profile as { membership_tier?: string } | null)?.membership_tier !== 'FOUNDER') {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  const cwd = process.cwd();
  const corpusDir = path.join(cwd, 'corpus', 'active');
  const manifestPath = path.join(corpusDir, 'sources-manifest.json');
  const registryPath = path.join(corpusDir, 'corpus-registry.json');

  if (!fs.existsSync(manifestPath)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'sources-manifest.json not found. On local dev run: python3 scripts/corpus/acquire.py --validate-only. Many serverless deploys do not ship corpus/ — use a local or CI dashboard.',
      },
      { status: 503 },
    );
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as Record<string, unknown>[];
  let registry: { documents?: Record<string, unknown>[] } = { documents: [] };
  if (fs.existsSync(registryPath)) {
    try {
      registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8')) as { documents?: Record<string, unknown>[] };
    } catch {
      registry = { documents: [] };
    }
  }

  const registryDocs: Record<string, Record<string, unknown>> = {};
  for (const doc of registry.documents ?? []) {
    const fn = doc.filename as string;
    if (fn) registryDocs[fn] = doc;
  }

  const admin = createClient(env.url, env.service);
  const { data: recentJobs } = await admin
    .from('job_queue')
    .select('id, status, metadata, created_at, updated_at')
    .eq('job_type', 'corpus_acquisition')
    .order('created_at', { ascending: false })
    .limit(40);

  const sources = manifest.map((src) => {
    const id = String(src.id ?? '');
    const fn = String(src.output_filename ?? '');
    const filePath = path.join(corpusDir, fn);
    const onDisk = fs.existsSync(filePath);
    const fileSize = onDisk ? fs.statSync(filePath).size : null;

    let currentHash: string | null = null;
    if (onDisk) {
      const buf = fs.readFileSync(filePath);
      currentHash = crypto.createHash('sha256').update(buf).digest('hex');
    }

    const regEntry = registryDocs[fn];
    const registryHash = regEntry?.content_hash as string | null | undefined;
    const validated = regEntry?.validated === true;
    const stale = Boolean(onDisk && validated && registryHash != null && currentHash !== registryHash);

    const recentJob = recentJobs?.find((j) => (j.metadata as Record<string, unknown> | null)?.source_id === id);

    const strategy = (src.strategy as string) || 'page_html';
    const strategyLabel =
      strategy === 'direct_pdf' ? 'PDF' : strategy === 'navigate_then_download' ? 'Navigate' : 'Web';

    return {
      id,
      name: (src.name as string) || (src.product as string) || id.replace(/_/g, ' '),
      provider: (src.provider as string) || '—',
      document_type: (src.document_type as string) || 'other',
      catalog_type: (src.catalog_type as string) || 'other',
      extraction_priority: typeof src.extraction_priority === 'number' ? src.extraction_priority : 99,
      output_filename: fn,
      entry_url: (src.entry_url as string) || null,
      strategy,
      strategy_label: strategyLabel,
      corpus_notes: (src.corpus_notes as string) ?? null,
      on_disk: onDisk,
      file_size_bytes: fileSize,
      validated,
      corpus_status: (regEntry?.corpus_status as string) ?? null,
      retrieved_at: (regEntry?.retrieved_at as string) ?? null,
      retrieved_at_relative: relTime(regEntry?.retrieved_at as string),
      content_hash: currentHash,
      stale,
      recent_job: recentJob
        ? {
            job_id: recentJob.id,
            status: recentJob.status,
            queued_at: recentJob.created_at,
            completed_at: recentJob.updated_at,
            result: (recentJob.metadata as Record<string, unknown> | null)?.result_status ?? null,
          }
        : null,
    };
  });

  return NextResponse.json({ ok: true, sources, total: sources.length });
}
