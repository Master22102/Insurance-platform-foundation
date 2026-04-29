'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import AppPageRoot from '@/components/layout/AppPageRoot';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { touch } from '@/lib/styles/tokens';

type VideoDetail = {
  paid: boolean;
  can_add_to_trip?: boolean | null;
  creator: any;
  video: any;
  location_tags: any[];
  activities: any[];
  free_tier_tag_limit_applied: boolean;
};

function youtubeEmbed(platformVideoId: string | null, startSeconds: number) {
  if (!platformVideoId) return null;
  const u = new URL(`https://www.youtube.com/embed/${platformVideoId}`);
  u.searchParams.set('start', String(Math.max(0, Math.floor(startSeconds))));
  u.searchParams.set('modestbranding', '1');
  u.searchParams.set('rel', '0');
  return u.toString();
}

export default function DiscoverVideoPage({ params }: { params: { video_id: string } }) {
  const sp = useSearchParams();
  const tripId = sp.get('trip_id') || undefined;
  const [data, setData] = useState<VideoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startSeconds, setStartSeconds] = useState(0);
  const [adding, setAdding] = useState(false);
  const isMobile = useIsMobile();

  const videoId = params.video_id;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const tid =
          tripId ||
          (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('trip_id') : null) ||
          undefined;
        const tripQs = tid ? `?trip_id=${encodeURIComponent(tid)}` : '';
        const res = await fetch(`/api/creators/videos/${encodeURIComponent(videoId)}${tripQs}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(json?.error || 'Failed to load');
          return;
        }
        if (json?.disabled) {
          setError('Creator discovery is disabled.');
          return;
        }
        if (!cancelled) setData(json as VideoDetail);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [videoId, tripId]);

  const iframeSrc = useMemo(() => {
    if (!data?.video) return null;
    const pv = data.video.platform_video_id || null;
    if (data.creator?.platform === 'youtube') return youtubeEmbed(pv, startSeconds);
    return data.video.video_url as string;
  }, [data, startSeconds]);

  async function addToTrip(activityName: string, tag: any | null, extraction: any | null) {
    const tid =
      tripId ||
      (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('trip_id') : null) ||
      undefined;
    if (!tid) {
      setError('Open this page from a trip (pass ?trip_id=...) to add activities.');
      return;
    }
    if (data?.can_add_to_trip !== true) {
      setError('Unlock this trip to add creator-linked activities.');
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const res = await fetch(`/api/creators/videos/${encodeURIComponent(videoId)}/add-to-trip`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          trip_id: tid,
          activity_name: activityName,
          city: tag?.city ?? null,
          country_code: tag?.country_code ?? null,
          source_tag_id: tag?.tag_id ?? null,
          source_extraction_id: extraction?.extraction_id ?? null,
          timestamp_seconds: tag?.timestamp_seconds ?? null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || 'Failed to add to trip');
        return;
      }
    } finally {
      setAdding(false);
    }
  }

  const linkBtn = {
    fontSize: 12,
    fontWeight: 900,
    textDecoration: 'none' as const,
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    padding: '10px 14px',
    background: 'white',
    color: '#111827',
    minHeight: touch.minTap,
    display: 'inline-flex' as const,
    alignItems: 'center' as const,
    boxSizing: 'border-box' as const,
  };

  const primaryBtn = (enabled: boolean) => ({
    border: '1px solid #111827',
    background: enabled ? '#111827' : '#f3f4f6',
    color: enabled ? 'white' : '#6b7280',
    borderRadius: 10,
    padding: '12px 14px',
    fontWeight: 950,
    fontSize: 12,
    minHeight: touch.minTap,
    cursor: enabled ? ('pointer' as const) : 'not-allowed',
    boxSizing: 'border-box' as const,
  });

  if (loading) {
    return (
      <AppPageRoot style={{ color: '#6b7280' }}>
        Loading…
      </AppPageRoot>
    );
  }
  if (error && !data) {
    return (
      <AppPageRoot style={{ color: '#991b1b' }}>
        {error}
      </AppPageRoot>
    );
  }
  if (!data) {
    return (
      <AppPageRoot style={{ color: '#6b7280' }}>
        Not found.
      </AppPageRoot>
    );
  }

  const gridCols = isMobile ? '1fr' : '1fr 1fr';

  return (
    <AppPageRoot>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error ? <div style={{ color: '#991b1b', fontSize: 13 }}>{error}</div> : null}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 950, color: '#111827' }}>{data.video?.title || 'Video'}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
              {data.creator?.creator_name ? (
                <>
                  <b>{data.creator.creator_name}</b> · {data.creator.platform}
                  {data.creator.platform_handle ? ` · @${data.creator.platform_handle}` : ''}
                </>
              ) : null}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {tripId ? (
              <Link href={`/trips/${encodeURIComponent(tripId)}/draft/activities`} style={linkBtn}>
                Back to trip
              </Link>
            ) : null}
            <a
              href={data.video?.video_url}
              target="_blank"
              rel="noreferrer"
              style={{
                ...linkBtn,
                border: 'none',
                color: '#1d4ed8',
                background: 'transparent',
                padding: '10px 8px',
              }}
            >
              Watch on platform
            </a>
          </div>
        </div>

        <div style={{ border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden', background: '#000' }}>
          {iframeSrc ? (
            <iframe
              key={`${iframeSrc}`}
              src={iframeSrc}
              style={{ width: '100%', aspectRatio: '16 / 9', border: 0 }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="Creator video"
            />
          ) : null}
        </div>

        {data.free_tier_tag_limit_applied ? (
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: 12, fontSize: 13, color: '#1e3a8a' }}>
            Free tier: only the first 2 location tags and activities are shown.
          </div>
        ) : null}

        <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 12 }}>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 14, padding: 12, background: 'white' }}>
            <div style={{ fontSize: 13, fontWeight: 950, color: '#111827' }}>Location tags</div>
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(data.location_tags || []).map((t) => (
                <div key={t.tag_id} style={{ border: '1px solid #f3f4f6', borderRadius: 12, padding: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: '#111827' }}>
                      {[t.place_name, t.city, t.country_code].filter(Boolean).join(' · ') || 'Tagged location'}
                    </div>
                    <button
                      type="button"
                      onClick={() => setStartSeconds(Number(t.timestamp_seconds || 0))}
                      style={{
                        border: '1px solid #e5e7eb',
                        background: 'white',
                        borderRadius: 10,
                        padding: '10px 12px',
                        fontWeight: 900,
                        fontSize: 12,
                        minHeight: touch.minTap,
                        cursor: 'pointer',
                        boxSizing: 'border-box',
                      }}
                    >
                      {Number(t.timestamp_seconds || 0)}s
                    </button>
                  </div>
                  {tripId ? (
                    <div style={{ marginTop: 10 }}>
                      <button
                        type="button"
                        disabled={adding || !data.can_add_to_trip}
                        onClick={() => addToTrip(`Visit ${t.place_name || t.city || 'this spot'}`, t, null)}
                        style={primaryBtn(Boolean(data.can_add_to_trip) && !adding)}
                      >
                        {adding ? 'Adding…' : 'Add to trip'}
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div style={{ border: '1px solid #e5e7eb', borderRadius: 14, padding: 12, background: 'white' }}>
            <div style={{ fontSize: 13, fontWeight: 950, color: '#111827' }}>Activities</div>
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(data.activities || []).map((a, idx) => (
                <div key={a.extraction_id || idx} style={{ border: '1px solid #f3f4f6', borderRadius: 12, padding: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: '#111827' }}>{a.activity_name}</div>
                  {a.activity_description ? <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>{a.activity_description}</div> : null}
                  {tripId ? (
                    <div style={{ marginTop: 10 }}>
                      <button
                        type="button"
                        disabled={adding || !data.can_add_to_trip}
                        onClick={() => addToTrip(a.activity_name, null, a)}
                        style={primaryBtn(Boolean(data.can_add_to_trip) && !adding)}
                      >
                        {adding ? 'Adding…' : 'Add to trip'}
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppPageRoot>
  );
}
