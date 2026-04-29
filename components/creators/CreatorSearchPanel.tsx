'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type Creator = {
  creator_id: string;
  creator_name: string;
  platform: string;
  platform_handle: string | null;
  platform_url: string | null;
  avatar_url: string | null;
  subscriber_count: number | null;
  is_verified: boolean;
  region_focus?: string[] | null;
  travel_style?: string[] | null;
};

type Video = {
  video_id: string;
  creator_id: string;
  title: string;
  description: string | null;
  video_url: string;
  platform_video_id: string | null;
  thumbnail_url: string | null;
  published_at: string | null;
  view_count: number | null;
  creator: Creator | null;
};

export default function CreatorSearchPanel({ tripId }: { tripId?: string }) {
  const [q, setQ] = useState('');
  const [platform, setPlatform] = useState('');
  const [region, setRegion] = useState('');
  const [style, setStyle] = useState('');

  const [loading, setLoading] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [paid, setPaid] = useState(false);
  const [rateRemaining, setRateRemaining] = useState<number | null>(null);

  const [creators, setCreators] = useState<Creator[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const canSearch = q.trim().length >= 2 || platform || region || style;

  const queryUrl = useMemo(() => {
    const u = new URL('/api/creators/search', window.location.origin);
    if (q.trim()) u.searchParams.set('q', q.trim());
    if (platform) u.searchParams.set('platform', platform);
    if (region.trim()) u.searchParams.set('region', region.trim());
    if (style.trim()) u.searchParams.set('style', style.trim());
    u.searchParams.set('limit', '10');
    return u.toString();
  }, [q, platform, region, style]);

  async function runSearch() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(queryUrl, { method: 'GET' });
      const json = await res.json().catch(() => ({}));
      if (res.status === 429) {
        setError('You’ve reached the creator search daily limit (100/day). Try again tomorrow.');
        return;
      }
      if (!res.ok) {
        setError(json?.error || 'Search failed');
        return;
      }
      if (json?.disabled) {
        setDisabled(true);
        setCreators([]);
        setVideos([]);
        setTotalCount(0);
        return;
      }
      setDisabled(false);
      setPaid(Boolean(json?.paid));
      setRateRemaining(typeof json?.rate_limit_remaining === 'number' ? json.rate_limit_remaining : null);
      setCreators((json?.creators || []) as Creator[]);
      setVideos((json?.videos || []) as Video[]);
      setTotalCount(Number(json?.total_count || 0));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // No automatic search on mount (avoid consuming daily quota).
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {disabled ? (
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412', borderRadius: 12, padding: 12, fontSize: 13 }}>
          Creator discovery is currently disabled.
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 160px 160px auto', gap: 10, alignItems: 'end' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#374151', marginBottom: 6 }}>Search</div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Try: Bangkok street food, Kyoto temples, Bali surf…"
            style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 12px', fontSize: 14 }}
          />
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#374151', marginBottom: 6 }}>Platform</div>
          <select value={platform} onChange={(e) => setPlatform(e.target.value)} style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 10px', fontSize: 14 }}>
            <option value="">Any</option>
            <option value="youtube">YouTube</option>
            <option value="tiktok">TikTok</option>
            <option value="instagram">Instagram</option>
          </select>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#374151', marginBottom: 6 }}>Region</div>
          <input
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="e.g. Japan"
            style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 12px', fontSize: 14 }}
          />
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#374151', marginBottom: 6 }}>Style</div>
          <input
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            placeholder="e.g. food"
            style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 12px', fontSize: 14 }}
          />
        </div>
        <button
          disabled={disabled || loading || !canSearch}
          onClick={runSearch}
          style={{
            border: '1px solid #1f2937',
            background: disabled || loading || !canSearch ? '#f3f4f6' : '#111827',
            color: disabled || loading || !canSearch ? '#6b7280' : 'white',
            borderRadius: 10,
            padding: '10px 14px',
            fontWeight: 900,
            height: 42,
          }}
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
      </div>

      {error ? (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 12, padding: 12, fontSize: 13 }}>
          {error}
        </div>
      ) : null}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ fontSize: 12, color: '#6b7280' }}>
          {totalCount > 0 ? (
            <>
              Showing <b>{videos.length}</b> of <b>{totalCount}</b> videos{paid ? '' : ' (free tier)'}.
            </>
          ) : (
            'Search results will appear here.'
          )}
        </div>
        <div style={{ fontSize: 12, color: '#6b7280' }}>{rateRemaining != null ? <>Remaining today: <b>{rateRemaining}</b></> : null}</div>
      </div>

      {creators.length > 0 ? (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {creators.map((c) => (
            <div key={c.creator_id} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, minWidth: 260, background: '#fff' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ width: 36, height: 36, borderRadius: 999, background: '#f3f4f6', overflow: 'hidden', flexShrink: 0 }}>
                  {c.avatar_url ? <img src={c.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.creator_name} {c.is_verified ? '✓' : ''}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.platform}{c.platform_handle ? ` · @${c.platform_handle}` : ''}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Link href={`/focl/creators?creator_id=${encodeURIComponent(c.creator_id)}`} style={{ fontSize: 12, fontWeight: 900, color: '#1d4ed8', textDecoration: 'none' }}>
                  Manage (FOCL)
                </Link>
                {c.platform_url ? (
                  <a href={c.platform_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 900, color: '#111827', textDecoration: 'none' }}>
                    Platform page
                  </a>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {videos.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
          {videos.map((v) => (
            <div key={v.video_id} style={{ border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
              <div style={{ background: '#f3f4f6', height: 156, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {v.thumbnail_url ? <img src={v.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ color: '#6b7280', fontSize: 12 }}>No thumbnail</div>}
              </div>
              <div style={{ padding: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: '#111827' }}>{v.title}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
                  {v.creator ? <span><b>{v.creator.creator_name}</b></span> : null}
                  {v.view_count != null ? <span> · {Intl.NumberFormat().format(v.view_count)} views</span> : null}
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
                  <Link
                    href={`/discover/${encodeURIComponent(v.video_id)}${tripId ? `?trip_id=${encodeURIComponent(tripId)}` : ''}`}
                    style={{ fontSize: 12, fontWeight: 900, color: '#111827', textDecoration: 'none', border: '1px solid #e5e7eb', borderRadius: 10, padding: '7px 10px', background: '#fff' }}
                  >
                    Open details
                  </Link>
                  <a href={v.video_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 900, color: '#1d4ed8', textDecoration: 'none' }}>
                    Watch
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

