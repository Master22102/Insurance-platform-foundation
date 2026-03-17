import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  author: string;
  author_initials: string;
  category: string;
  read_minutes: number;
  published_at: string;
  cover_image_url: string | null;
}

const CATEGORY_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  Insurance: { color: '#2E5FA3', bg: '#eff4fc', border: '#bfdbfe' },
  Coverage: { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  Travel: { color: '#b45309', bg: '#fff7ed', border: '#fed7aa' },
  Security: { color: '#0369a1', bg: '#f0f9ff', border: '#bae6fd' },
};

function getCategoryStyle(category: string) {
  return CATEGORY_COLORS[category] ?? { color: '#888', bg: '#f5f5f5', border: '#e5e5e5' };
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

async function getPosts(): Promise<BlogPost[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
  const { data } = await supabase
    .from('blog_posts')
    .select('id, slug, title, excerpt, author, author_initials, category, read_minutes, published_at, cover_image_url')
    .not('published_at', 'is', null)
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false });
  return (data ?? []) as BlogPost[];
}

export default async function BlogIndexPage() {
  const posts = await getPosts();

  const featured = posts[0] ?? null;
  const rest = posts.slice(1);

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', background: 'white' }}>
      <section style={{
        background: 'linear-gradient(160deg, #0d1b2a 0%, #0f2518 50%, #0d1b2a 100%)',
        padding: '140px 24px 80px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(ellipse at 60% 40%, rgba(46,95,163,0.12) 0%, transparent 60%)',
          pointerEvents: 'none',
        }} />
        <div style={{ maxWidth: 800, margin: '0 auto', position: 'relative' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 20, padding: '6px 14px', marginBottom: 28,
          }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Blog</span>
          </div>
          <h1 style={{ fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 800, color: 'white', margin: '0 0 16px', letterSpacing: '-1.2px', lineHeight: 1.1 }}>
            Guides, coverage breakdowns, and travel insights
          </h1>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.5)', margin: 0, lineHeight: 1.65 }}>
            Practical advice on travel insurance, credit card benefits, and claim documentation.
          </p>
        </div>
      </section>

      <section style={{ padding: '72px 24px', background: 'white' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          {featured ? (
            <Link href={`/blog/${featured.slug}`} style={{ textDecoration: 'none', display: 'block' }}>
              <div style={{
                background: '#f7f8fa', border: '1px solid #e8e8e8', borderRadius: 20,
                padding: '40px 44px', marginBottom: 56,
                transition: 'box-shadow 0.2s ease',
              }} className="blog-card">
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
                  {(() => {
                    const cs = getCategoryStyle(featured.category);
                    return (
                      <span style={{ fontSize: 11, fontWeight: 700, color: cs.color, background: cs.bg, border: `1px solid ${cs.border}`, borderRadius: 20, padding: '4px 12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {featured.category}
                      </span>
                    );
                  })()}
                  <span style={{ fontSize: 13, color: '#aaa' }}>Featured</span>
                </div>
                <h2 style={{ fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: 800, color: '#0d1b2a', margin: '0 0 14px', letterSpacing: '-0.5px', lineHeight: 1.25 }}>
                  {featured.title}
                </h2>
                <p style={{ fontSize: 16, color: '#666', margin: '0 0 28px', lineHeight: 1.7, maxWidth: 680 }}>
                  {featured.excerpt}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #2E5FA3 0%, #1A2B4A 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, color: 'white', flexShrink: 0,
                  }}>
                    {featured.author_initials}
                  </div>
                  <span style={{ fontSize: 14, color: '#555', fontWeight: 500 }}>{featured.author}</span>
                  <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#ddd', display: 'inline-block' }} />
                  <span style={{ fontSize: 13, color: '#aaa' }}>{formatDate(featured.published_at)}</span>
                  <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#ddd', display: 'inline-block' }} />
                  <span style={{ fontSize: 13, color: '#aaa' }}>{featured.read_minutes} min read</span>
                </div>
              </div>
            </Link>
          ) : (
            <div style={{ padding: '60px', textAlign: 'center', color: '#aaa', fontSize: 15 }}>
              No posts published yet. Check back soon.
            </div>
          )}

          {rest.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24 }}>
              {rest.map((post) => {
                const cs = getCategoryStyle(post.category);
                return (
                  <Link key={post.slug} href={`/blog/${post.slug}`} style={{ textDecoration: 'none', display: 'block' }}>
                    <div style={{
                      background: 'white', border: '1px solid #e8e8e8', borderRadius: 16,
                      padding: '28px', height: '100%', boxSizing: 'border-box',
                      display: 'flex', flexDirection: 'column',
                    }} className="blog-card">
                      <span style={{ fontSize: 10, fontWeight: 700, color: cs.color, background: cs.bg, border: `1px solid ${cs.border}`, borderRadius: 20, padding: '3px 10px', display: 'inline-block', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em', width: 'fit-content' }}>
                        {post.category}
                      </span>
                      <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0d1b2a', margin: '0 0 10px', letterSpacing: '-0.2px', lineHeight: 1.3, flex: 1 }}>
                        {post.title}
                      </h3>
                      <p style={{ fontSize: 14, color: '#777', margin: '0 0 24px', lineHeight: 1.65 }}>
                        {post.excerpt}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto' }}>
                        <div style={{
                          width: 26, height: 26, borderRadius: '50%',
                          background: 'linear-gradient(135deg, #2E5FA3 0%, #1A2B4A 100%)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 9, fontWeight: 700, color: 'white', flexShrink: 0,
                        }}>
                          {post.author_initials}
                        </div>
                        <span style={{ fontSize: 13, color: '#888', fontWeight: 500 }}>{post.author}</span>
                        <span style={{ fontSize: 12, color: '#bbb', marginLeft: 'auto' }}>{post.read_minutes} min</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section style={{ padding: '64px 24px', background: '#f7f8fa', textAlign: 'center' }}>
        <div style={{ maxWidth: 540, margin: '0 auto' }}>
          <h2 style={{ fontSize: 26, fontWeight: 800, color: '#0d1b2a', margin: '0 0 10px', letterSpacing: '-0.4px' }}>
            Get new guides in your inbox
          </h2>
          <p style={{ fontSize: 15, color: '#888', margin: '0 0 24px', lineHeight: 1.6 }}>
            Practical travel protection advice, delivered occasionally. No spam.
          </p>
          <form action="/api/marketing/subscribe" method="POST" style={{ display: 'flex', gap: 10, maxWidth: 440, margin: '0 auto', flexWrap: 'wrap' }}>
            <input
              type="email" name="email" required placeholder="your@email.com"
              style={{
                flex: 1, minWidth: 200, padding: '12px 16px', fontSize: 14,
                border: '1px solid #e0e0e0', borderRadius: 10, outline: 'none',
                background: 'white',
              }}
            />
            <button type="submit" style={{
              padding: '12px 24px', background: '#1A2B4A', color: 'white',
              border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
              flexShrink: 0,
            }}>
              Subscribe
            </button>
          </form>
        </div>
      </section>

      <style>{`
        .blog-card:hover { box-shadow: 0 8px 32px rgba(0,0,0,0.07); }
      `}</style>
    </div>
  );
}
