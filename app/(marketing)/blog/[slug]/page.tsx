import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  author: string;
  author_initials: string;
  category: string;
  read_minutes: number;
  published_at: string;
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

/** Escape user/DB-supplied HTML before lightweight markdown transforms (XSS hardening). */
function escapeHtmlForBlog(md: string): string {
  return md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderMarkdown(md: string): string {
  return escapeHtmlForBlog(md)
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]+?<\/li>)/g, (match) => `<ul>${match}</ul>`)
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hul])(.+)$/gm, (match) => match.trim() ? match : '')
    .replace(/<\/ul><ul>/g, '')
    .replace(/^<p><\/p>$/gm, '');
}

async function getPost(slug: string): Promise<BlogPost | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
  const { data } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', slug)
    .not('published_at', 'is', null)
    .lte('published_at', new Date().toISOString())
    .maybeSingle();
  return data as BlogPost | null;
}

async function getRelated(slug: string, category: string): Promise<BlogPost[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
  const { data } = await supabase
    .from('blog_posts')
    .select('id, slug, title, excerpt, author, author_initials, category, read_minutes, published_at')
    .neq('slug', slug)
    .not('published_at', 'is', null)
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false })
    .limit(3);
  return (data ?? []) as BlogPost[];
}

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug);
  if (!post) notFound();

  const related = await getRelated(post.slug, post.category);
  const cs = getCategoryStyle(post.category);

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
          backgroundImage: 'radial-gradient(ellipse at 40% 60%, rgba(46,95,163,0.12) 0%, transparent 60%)',
          pointerEvents: 'none',
        }} />
        <div style={{ maxWidth: 760, margin: '0 auto', position: 'relative' }}>
          <Link href="/blog" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'rgba(255,255,255,0.5)', textDecoration: 'none', marginBottom: 24 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            All posts
          </Link>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: cs.color, background: 'rgba(255,255,255,0.95)', border: 'none', borderRadius: 20, padding: '4px 12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {post.category}
            </span>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{post.read_minutes} min read</span>
          </div>
          <h1 style={{ fontSize: 'clamp(26px, 4vw, 44px)', fontWeight: 800, color: 'white', margin: '0 0 24px', letterSpacing: '-1px', lineHeight: 1.15 }}>
            {post.title}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: 'white', flexShrink: 0,
            }}>
              {post.author_initials}
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'white', margin: 0 }}>{post.author}</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', margin: 0 }}>{formatDate(post.published_at)}</p>
            </div>
          </div>
        </div>
      </section>

      <section style={{ padding: '64px 24px 80px', background: 'white' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{
            fontSize: 16, lineHeight: 1.8, color: '#444',
          }} dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content) }} className="blog-content" />
        </div>
      </section>

      {related.length > 0 && (
        <section style={{ padding: '64px 24px', background: '#f7f8fa', borderTop: '1px solid #f0f0f0' }}>
          <div style={{ maxWidth: 1000, margin: '0 auto' }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0d1b2a', margin: '0 0 28px', letterSpacing: '-0.3px' }}>
              More from the blog
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
              {related.map((r) => {
                const rcs = getCategoryStyle(r.category);
                return (
                  <Link key={r.slug} href={`/blog/${r.slug}`} style={{ textDecoration: 'none', display: 'block' }}>
                    <div style={{ background: 'white', border: '1px solid #e8e8e8', borderRadius: 14, padding: '22px', display: 'flex', flexDirection: 'column', gap: 10 }} className="blog-card">
                      <span style={{ fontSize: 10, fontWeight: 700, color: rcs.color, background: rcs.bg, border: `1px solid ${rcs.border}`, borderRadius: 20, padding: '3px 10px', display: 'inline-block', width: 'fit-content', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {r.category}
                      </span>
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0d1b2a', margin: 0, lineHeight: 1.4 }}>{r.title}</h3>
                      <p style={{ fontSize: 13, color: '#888', margin: 0, lineHeight: 1.6 }}>{r.excerpt}</p>
                      <span style={{ fontSize: 12, color: '#bbb', marginTop: 'auto' }}>{r.read_minutes} min read</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <style>{`
        .blog-content h1 { font-size: 28px; font-weight: 800; color: #0d1b2a; margin: 40px 0 16px; letter-spacing: -0.5px; line-height: 1.25; }
        .blog-content h2 { font-size: 22px; font-weight: 700; color: #0d1b2a; margin: 36px 0 14px; letter-spacing: -0.3px; line-height: 1.3; }
        .blog-content h3 { font-size: 18px; font-weight: 700; color: #0d1b2a; margin: 28px 0 12px; }
        .blog-content p { margin: 0 0 20px; }
        .blog-content ul { margin: 0 0 20px; padding-left: 24px; display: flex; flex-direction: column; gap: 8px; list-style: disc; }
        .blog-content li { color: #555; }
        .blog-content strong { color: #0d1b2a; font-weight: 700; }
        .blog-content em { font-style: italic; }
        .blog-card:hover { box-shadow: 0 6px 24px rgba(0,0,0,0.07); }
      `}</style>
    </div>
  );
}
